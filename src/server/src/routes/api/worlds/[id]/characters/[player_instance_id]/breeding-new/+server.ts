import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { splitGuids } from '$lib/guidUtils';
import { getPlayerPals } from '$lib/mappers';
import { palDatabase } from '$lib/palDatabase';
import { PalBreeder, type BreedingRoute, type FailureResult, type PalInfo, type Sex } from '$lib/breedingHelper';
import type { Player } from '$save-edit/models/Player';
export const GET: RequestHandler = async ({ params, locals, url }) => {
    try {
        const { id, player_instance_id } = params;
        const saveWatcher = locals.saveWatcher;
        if (!saveWatcher) {
            return json({ error: 'Save file watcher not available' }, { status: 503 });
        }
        const serverSave = saveWatcher.getServerSave(id);

        if (!serverSave) {
            return json({ error: `Server ${id} not found` }, { status: 404 });
        }
        const [playerId, instanceId] = splitGuids(player_instance_id);
        const pWorld = serverSave.Characters.find(a=> a.PlayerId === playerId && a.InstanceId === instanceId) as Player;
        const pSave = saveWatcher.getPlayers(id).find(a=> a.PlayerUid === playerId && a.InstanceId === instanceId);

        if(!pWorld || !pSave) {
            return json({ error: 'Player not found' }, { status: 404 });
        }
        const pals : PalInfo[] = getPlayerPals(pWorld, pSave, serverSave).map(a=>({
            id : a.id + '_' + a.instanceId,
            level: a.level,
            talents: {
                hp: a.talentHP,
                attack: a.talentShot,
                defense: a.talentDefense
            },
            tribeId: a.characterId,
            passives: a.passiveSkills?.map(a=> a.Id) || [],
            sex: (a.gender.replace('EPalGenderType::','')) == 'Male' ? 'Male' : 'Female',
            name: a.displayName || a.name,
            tribeName: a.name,
            }));           
        // Get desired character and passives from query params
        const targetCharacter = url.searchParams.get('characterId') || 'Anubis';
        const mode = url.searchParams.get('mode') || 'work';

        const species = Object.entries(palDatabase).map(([tribeId, tribe]) => ({
            tribeId,
            combiRank: tribe.CombiRank,
            maleProbability: 0.5,
            timeToHatch: tribe.BiologicalGrade / 5 * 3600,
            name: tribe.OverrideNameTextID,
        }));
            
        const breeder = new PalBreeder(species, {
            strategy: 'passivesFirst',          // <— use the new strategy
            minAdditionalDesiredPassives: 0,    // N optionals on top of mandatory (0 for work mode)
            phaseAMaxDepth: 3,                  // increased from 2 to 3 for deeper search
            phaseAFrontierSize: 25,             // increased from 15 to 25 for more candidates
            phaseAMatesPerState: 15,            // increased from 10 to 15 for more exploration
            beamWidthBase: 12,                  // increased from 8 to 12
            beamWidthMax: 30,                   // increased from 20 to 30
          });
          let route : BreedingRoute | FailureResult;
          if(mode == 'work') {

           route = breeder.GetBestBreedingRoute(
            pals,
            [
              { passiveId: 'CraftSpeed_up3', isMandatory: false },
              { passiveId: 'PAL_CorporateSlave', isMandatory: false },              
              { passiveId: 'CraftSpeed_up2', isMandatory: false },
              { passiveId: 'Rare', isMandatory: false },
              { passiveId: 'PAL_conceited', isMandatory: false },
              { passiveId: 'CraftSpeed_up1', isMandatory: false },
            ],
            targetCharacter,
            { hp: 0, attack: 0, defense: 0 },
            5
          );
        }
        else {
          route = breeder.GetBestBreedingRoute(
            pals,
            [
              { passiveId: 'CoolTimeReduction_Up_1', isMandatory: true },
              { passiveId: 'PAL_ALLAttack_up3', isMandatory: false },
              { passiveId: 'PAL_ALLAttack_up2', isMandatory: false },
              { passiveId: 'PAL_ALLAttack_up1', isMandatory: false },
            ],
            targetCharacter,
            { hp: 30, attack: 80, defense: 60 },
            5
          );
        }
          
        return json(route);

    } catch (err) {
        console.error(`Error getting breeding route for ${params.id}:`, err);
        return json({ error: 'Failed to calculate breeding route' }, { status: 500 });
    }
};
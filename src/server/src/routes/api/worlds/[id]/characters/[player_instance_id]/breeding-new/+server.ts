import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { splitGuids } from '$lib/guidUtils';
import { getPlayerPals } from '$lib/mappers';
import { palDatabase, palPassiveDatabase } from '$lib/palDatabase';
import { PalBreeder, type BreedingRoute, type BreedingRouteResult, type FailureResult, type GenealogyNode, type PalInfo, type Sex, type Talents } from '$lib/breedingHelper';
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
            
        // Create a custom child comparator for work mode (prioritizes work-related passives)
        const workChildComparator = (a: GenealogyNode, b: GenealogyNode) => {
          const scoreA = a.passives.map(x=> palPassiveDatabase[x].Buff.b_CraftSpeed).reduce((a, b) => a + b, 0);
          const scoreB = b.passives.map(x=> palPassiveDatabase[x].Buff.b_CraftSpeed).reduce((a, b) => a + b, 0);
          return scoreB - scoreA;
        };

        const attackChildComparator = (a: GenealogyNode, b: GenealogyNode) => {
          const scoreA = a.passives.map(x=> palPassiveDatabase[x].Buff.b_Attack).reduce((a, b) => a + b, 0);
          const scoreB = b.passives.map(x=> palPassiveDatabase[x].Buff.b_Attack).reduce((a, b) => a + b, 0);
          
          const aHasCoolTime = a.passives.includes('CoolTimeReduction_Up_1');
          const bHasCoolTime = b.passives.includes('CoolTimeReduction_Up_1');
          
          if (aHasCoolTime && bHasCoolTime) {
            return scoreB - scoreA;
          } else if (bHasCoolTime) {
            return 1;
          } else {
            return -1;
          }
        };

        const talentsComparator = (a: Talents, b: Talents) => {
          const scoreA = (a.hp + a.attack * 1.5 + a.defense) / 3.5;
          const scoreB = (b.hp + b.attack * 1.5 + b.defense) / 3.5;
          return scoreB - scoreA;
        }

        let route : BreedingRouteResult | FailureResult;
        if(mode == 'work') {

          const breeder = new PalBreeder(species, {
            strategy: 'passivesFirst',          // <— use the new strategy
            minAdditionalDesiredPassives: 0,    // N optionals on top of mandatory (0 for work mode)
            phaseAMaxDepth: 3,                  // increased from 2 to 3 for deeper search
            phaseAFrontierSize: 25,             // increased from 15 to 25 for more candidates
            phaseAMatesPerState: 15,            // increased from 10 to 15 for more exploration
            beamWidthBase: 12,                  // increased from 8 to 12
            beamWidthMax: 30,                   // increased from 20 to 30
            childComparator: workChildComparator, // Custom scoring for work mode
            debug: true,                        // Enable debug logging to see if comparator is used
            findPathMaxDepth: 5,
            desiredSet: new Set<string>([
              'CraftSpeed_up3',
              'PAL_CorporateSlave',
              'CraftSpeed_up2',
              'Rare',
              'PAL_conceited',
              'CraftSpeed_up1'
            ]),
            talentsComparator: talentsComparator
          });
          const result = breeder.GetBestPal(
            pals,
            2,
            targetCharacter,
            { hp: 0, attack: 0, defense: 0 }
          );
          route = result;
         
        }
        else {
          const breeder = new PalBreeder(species, {
            strategy: 'passivesFirst',          // <— use the new strategy
            minAdditionalDesiredPassives: 0,    // N optionals on top of mandatory (0 for work mode)
            phaseAMaxDepth: 3,                  // increased from 2 to 3 for deeper search
            phaseAFrontierSize: 25,             // increased from 15 to 25 for more candidates
            phaseAMatesPerState: 15,            // increased from 10 to 15 for more exploration
            beamWidthBase: 12,                  // increased from 8 to 12
            beamWidthMax: 30,                   // increased from 20 to 30
            childComparator: attackChildComparator, // Custom scoring for work mode
            debug: true,                        // Enable debug logging to see if comparator is used
            findPathMaxDepth: 5,
            desiredSet: new Set<string>([
              'CoolTimeReduction_Up_1',
              'PAL_ALLAttack_up3',
              'Rare',
              'Legend',
              'Noukin',
              'PAL_ALLAttack_up2',
              'PAL_ALLAttack_up1',
            ]),
            talentsComparator: talentsComparator
          });
          const result = breeder.GetBestPal(
            pals,
            2,
            targetCharacter,
            { hp: 80, attack: 90, defense: 80 }
          );
          route = result;
         
        }
          
        return json(route);

    } catch (err) {
        console.error(`Error getting breeding route for ${params.id}:`, err);
        return json({ error: 'Failed to calculate breeding route' }, { status: 500 });
    }
};
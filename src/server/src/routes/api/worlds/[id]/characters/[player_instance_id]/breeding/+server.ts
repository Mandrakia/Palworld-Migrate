import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {Pal} from "$save-edit/models/Pal";
import type {CharacterCardData, FullPlayerCardData, PalCardData, PlayerCardData} from '$lib/CharacterCardData';
import {toFullPlayerCard, toPalCard} from "$lib/mappers";
import type {Player} from "$save-edit/models/Player";
import {Buff, getPalData, getPassive, palDatabase, PalDatabaseEntry} from "$lib/palDatabase";
import type {ServerSave} from "$save-edit/models/ServerSave";
import type {Guild} from "$save-edit/models/Guild";

function splitGuids(encoded: string): [string, string] {
    // Parse base36 string as BigInt
    let combined = 0n;
    for (let i = 0; i < encoded.length; i++) {
        const digit = encoded.charCodeAt(i);
        const value = digit >= 48 && digit <= 57 ? digit - 48 : digit - 87; // 0-9, a-z
        combined = combined * 36n + BigInt(value);
    }

    const hex = combined.toString(16).padStart(64, '0');

    const guid1 = hex.slice(0, 32).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
    const guid2 = hex.slice(32).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');

    return [guid1, guid2];
}
function breed(pal1 : PalCardData, pal2 : PalCardData, serverSave : ServerSave) {
    if(pal1.characterId == null || pal2.characterId == null){
        console.log("null char");
    }
    var bData1 = getPalData(pal1.characterId);
    var bData2 = getPalData(pal2.characterId);

    var combination = bData1?.Combinations.filter(a=> (a.ParentTribeA == pal1.characterId && a.ParentTribeB == pal2.characterId) || (a.ParentTribeA == pal2.characterId && a.ParentTribeB == pal1.characterId));
    let closest: PalDatabaseEntry;
    if(combination?.length) {
        console.log(combination);
        var res = combination[0].ChildCharacterID;
        closest = getPalData(res);
    }
    else {
        var bFinal = Math.floor((bData1?.CombiRank + bData2?.CombiRank + 1) / 2);

        // Find the pal with CombiRank closest to bFinal
        // If there's equality in distance, select the one with lowest CombiRank
        closest = Object.values(palDatabase).filter(a=> a.Combinations.every(c=> c.ChildCharacterID !== a.Tribe.replace("EPalTribeID::",""))).sort((a, b) => {
            const distanceA = Math.abs(a.CombiRank - bFinal);
            const distanceB = Math.abs(b.CombiRank - bFinal);

            // If distances are equal, sort by CombiRank (lowest first)
            if (distanceA === distanceB) {
                return a.CombiRank - b.CombiRank;
            }

            // Otherwise sort by closest distance
            return distanceA - distanceB;
        })[0]; // Take the first (closest) result
    }
    let buff : Buff = {
        b_Attack : 0,
        b_CraftSpeed : 0,
        b_Defense : 0,
        b_MoveSpeed : 0
    };
    if(pal1.passiveSkills?.length) {
        for (let passive of pal1.passiveSkills) {
            let passStat = getPassive(passive.Id);
            if(!passStat?.Buff) {
                console.log("Missing passive :" + passive.Id);
                continue;
            }
            buff.b_Attack += passStat.Buff.b_Attack;
            buff.b_CraftSpeed += passStat.Buff.b_CraftSpeed;
            buff.b_Defense += passStat.Buff.b_Defense;
            buff.b_MoveSpeed += passStat.Buff.b_MoveSpeed;
        }
    }
    if(pal2.passiveSkills?.length) {
        for (let passive of pal2.passiveSkills) {
            let passStat = getPassive(passive.Id);
            if(!passStat?.Buff) {
                console.log("Missing passive :" + passive.Id);
                continue;
            }
            buff.b_Attack += passStat.Buff.b_Attack;
            buff.b_CraftSpeed += passStat.Buff.b_CraftSpeed;
            buff.b_Defense += passStat.Buff.b_Defense;
            buff.b_MoveSpeed += passStat.Buff.b_MoveSpeed;
        }
    }
    return {
        "Pal 1": pal1,
        "Pal 2": pal2,
        "Result": closest,
        "TalentScore" : (pal1.talentHP + pal2.talentHP + pal1.talentShot + pal2.talentShot + pal1.talentDefense + pal2.talentDefense) / 6,
        "AttackPassiveScore" : buff.b_Attack,
        "DefensePassiveScore" : buff.b_Defense,
        "CraftSpeedPassiveScore" : buff.b_CraftSpeed,
        "MoveSpeedPassiveScore" : buff.b_CraftSpeed,
    }
}
export const GET: RequestHandler = async ({ params, locals, url }) => {
    try {
        const { id, player_instance_id } = params;
        const version = url.searchParams.get('version') || 'Live';
        const saveWatcher = locals.saveWatcher;

        if (!saveWatcher) {
            return json({ error: 'Save file watcher not available' }, { status: 503 });
        }

        if (version !== 'Live') {
            return json({ error: 'Backup versions not yet supported' }, { status: 501 });
        }

        const serverSave = saveWatcher.getServerSave(id);

        if (!serverSave) {
            return error(404, `Server ${id} not found`);
        }

        const [playerId, instanceId] = splitGuids(player_instance_id);
        const pWorld = serverSave.Characters.find(a=> a.PlayerId === playerId && a.InstanceId === instanceId) as Player;
        const pSave = saveWatcher.getPlayers(id).find(a=> a.PlayerUid === playerId && a.InstanceId === instanceId);

        if (!pWorld) {
            return error(404, `Player not found with PlayerId: ${playerId} and InstanceId: ${instanceId}`);
        }

        if (!pSave) {
            return error(404, `Player save not found with PlayerUid: ${playerId} and InstanceId: ${instanceId}`);
        }

        // Use fallback for PlayerId - try pWorld.PlayerId first, then pSave.PlayerUid
        const playerIdForFilter = pWorld.PlayerId || pSave.PlayerUid || 'unknown';

        let playerContainers: string[] = [];
        let guild = serverSave.Groups.find(group => group.Id === pWorld.GroupId) as Guild;
        if(guild) {
            playerContainers = guild.BaseIds.map(bId => serverSave.BaseCamps.find(x => x.Id === bId)!.ContainerId)
        }
        playerContainers.push(pSave.CharacterPalsContainerId);
        playerContainers.push(pSave.PalStorageContainerId);
        console.log(playerContainers);
        const pals = serverSave.Characters.filter(a => a instanceof Pal && a.OwnerPlayerUId === playerId && playerContainers.includes(a.ContainerId)).map(a => toPalCard(a as Pal, serverSave));

        // Filter pals by gender
        const malePals = pals.filter(pal => pal.gender === "EPalGenderType::Male" && pal.characterId !== null);
        const femalePals = pals.filter(pal => pal.gender === "EPalGenderType::Female" && pal.characterId !== null);

        // Generate all breeding combinations
        const breedingResults = [];
        for (const malePal of malePals) {
            for (const femalePal of femalePals) {
                const result = breed(malePal, femalePal, serverSave);
                breedingResults.push(result);
            }
        }

        // Group results by BPClass/CharacterID and keep only the highest TalentScore for each unique result
        const uniqueResults = new Map<string, any>();
        
        for (const result of breedingResults) {
            const resultId = result.Result.BPClass; // Using BPClass as the unique identifier
            
            if (!uniqueResults.has(resultId) || uniqueResults.get(resultId).TalentScore < result.TalentScore) {
                uniqueResults.set(resultId, result);
            }
        }

        // Convert Map to array and return
        return json(Array.from(uniqueResults.values()));

    } catch (err) {
        console.error(`Error getting world details for ${params.id}:`, err);
        return error(500, 'Failed to load world details');
    }
};
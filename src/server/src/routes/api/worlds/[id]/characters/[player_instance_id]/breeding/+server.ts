import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {Pal} from "$save-edit/models/Pal";
import type {CharacterCardData, FullPlayerCardData, PalCardData, PlayerCardData} from '$lib/CharacterCardData';
import {getPlayerPals, toFullPlayerCard, toPalCard} from "$lib/mappers";
import type {Player} from "$save-edit/models/Player";
import {Buff, getPalData, getPassive, palDatabase, PalDatabaseEntry} from "$lib/palDatabase";
import type {ServerSave} from "$save-edit/models/ServerSave";
import type {Guild} from "$save-edit/models/Guild";
import type { BreedingSource } from '$lib/interfaces/index.js';

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
function getBreedingResult(pal1: PalCardData, pal2: PalCardData): string | null {
    if (pal1.characterId == null || pal2.characterId == null) {
        return null;
    }
    
    const bData1 = getPalData(pal1.characterId);
    const bData2 = getPalData(pal2.characterId);
    
    if (!bData1 || !bData2) {
        return null;
    }

    // Check for specific breeding combinations first
    const combination = bData1.Combinations.filter(a => 
        (a.ParentTribeA == pal1.characterId && a.ParentTribeB == pal2.characterId) || 
        (a.ParentTribeA == pal2.characterId && a.ParentTribeB == pal1.characterId)
    );
    
    if (combination.length > 0) {
        return combination[0].ChildCharacterID;
    }
    
    // Calculate breeding rank and find closest match
    const bFinal = Math.floor((bData1.CombiRank + bData2.CombiRank + 1) / 2);
    
    const closest = Object.values(palDatabase)
        .filter(a => a.Combinations.every(c => c.ChildCharacterID !== a.Tribe.replace("EPalTribeID::", "")))
        .sort((a, b) => {
            const distanceA = Math.abs(a.CombiRank - bFinal);
            const distanceB = Math.abs(b.CombiRank - bFinal);
            
            if (distanceA === distanceB) {
                return a.CombiRank - b.CombiRank;
            }
            
            return distanceA - distanceB;
        })[0];
    
    return closest ? closest.Tribe.replace("EPalTribeID::", "") : null;
}

function getPalDisplayName(characterId: string): string {
    const palData = getPalData(characterId);
    if (palData && palData.OverrideNameTextID && palData.OverrideNameTextID !== 'None') {
        return palData.OverrideNameTextID;
    }
    // Fallback to character ID if no display name found
    return characterId;
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
        const pals = getPlayerPals(pWorld, pSave, serverSave);

        // Filter pals to only include those with valid character IDs (ignore gender)
        const validPals = pals.filter(pal => pal.characterId !== null);

        // Generate all possible breeding combinations (ignore gender restrictions)
        const breedingResults: Record<string, {
            characterId: string;
            displayName: string;
            combinations: BreedingSource[];
        }> = {};
        
        for (let i = 0; i < validPals.length; i++) {
            for (let j = i + 1; j < validPals.length; j++) {
                const pal1 = validPals[i];
                const pal2 = validPals[j];
                
                const resultCharacterId = getBreedingResult(pal1, pal2);
                if (resultCharacterId) {
                    if (!breedingResults[resultCharacterId]) {
                        breedingResults[resultCharacterId] = {
                            characterId: resultCharacterId,
                            displayName: getPalDisplayName(resultCharacterId),
                            combinations: []
                        };
                    }
                    
                    breedingResults[resultCharacterId].combinations.push({
                        "Pal 1": pal1,
                        "Pal 2": pal2
                    });
                }
            }
        }

        return json(breedingResults);

    } catch (err) {
        console.error(`Error getting world details for ${params.id}:`, err);
        return error(500, 'Failed to load world details');
    }
};
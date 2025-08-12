import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {Pal} from "$save-edit/models/Pal";
import type {CharacterCardData, FullPlayerCardData, PalCardData, PlayerCardData} from '$lib/CharacterCardData';
import {getPlayerPals, toFullPlayerCard, toPalCard} from "$lib/mappers";
import type {Player} from "$save-edit/models/Player";
import {getLocalizedPassive, getPalData, getPassive, palDatabase} from "$lib/palDatabase";
import type {ServerSave} from "$save-edit/models/ServerSave";
import type {Guild} from "$save-edit/models/Guild";
import type { BreedingResponse, BreedingSource, PassiveSkill } from '$lib/interfaces/index.js';
import { GetPalStats } from '$lib/stats';
import { getBreedingResult } from '$lib/breedingHelper';
import type { LocalizedPassiveSkill } from '$lib/interfaces/passive-skills';

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

function getPalDisplayName(characterId: string): string {
    const palData = getPalData(characterId);
    if (palData && palData.OverrideNameTextID && palData.OverrideNameTextID !== 'None') {
        return palData.OverrideNameTextID;
    }
    // Fallback to character ID if no display name found
    return characterId;
}

// Generate all possible passive skill combinations (0 to 4 skills from parent pool)
function generatePassiveCombinations(parent1Passives: PassiveSkill[], parent2Passives: PassiveSkill[]): PassiveSkill[][] {
    // Combine all passives from both parents and remove duplicates based on Id
    const allPassives = [...parent1Passives, ...parent2Passives];
    const uniquePassives = allPassives.filter((passive, index, self) => 
        index === self.findIndex(p => p.Id === passive.Id)
    );

    const combinations: PassiveSkill[][] = [];
    
    // Generate all combinations from 0 to min(4, totalUniquePassives)
    const maxPassives = Math.min(4, uniquePassives.length);
    
    // Start with empty combination
    combinations.push([]);
    
    // Generate combinations of each size
    for (let size = 1; size <= maxPassives; size++) {
        generateCombinationsOfSize(uniquePassives, size, 0, [], combinations);
    }
    
    return combinations;
}

function generateCombinationsOfSize(
    passives: PassiveSkill[], 
    size: number, 
    start: number, 
    current: PassiveSkill[], 
    results: PassiveSkill[][]
): void {
    if (current.length === size) {
        results.push([...current]);
        return;
    }
    
    for (let i = start; i < passives.length; i++) {
        current.push(passives[i]);
        generateCombinationsOfSize(passives, size, i + 1, current, results);
        current.pop();
    }
}

// Calculate the best possible stats for a result character at level 30 with max talents
function calculateBestPossibleStats(
    resultCharacterId: string, 
    combinations: BreedingSource[], 
    mode: 'combat' | 'work'
): { 
    stats: { hp: number, attack: number, defense: number, craftSpeed: number }, 
    score: number, 
    bestPassives: LocalizedPassiveSkill[],
    bestCombination: BreedingSource | null
} {
    let bestScore = -Infinity;
    let bestStats = { hp: 0, attack: 0, defense: 0, craftSpeed: 0 };
    let bestPassives: LocalizedPassiveSkill[] = [];
    let bestCombination: BreedingSource | null = null;
    
    // Try each breeding combination
    for (const combo of combinations) {
        // Get max talents from parents
        const maxTalentHP = Math.max(combo["Pal 1"].talentHP || 0, combo["Pal 2"].talentHP || 0);
        const maxTalentShot = Math.max(combo["Pal 1"].talentShot || 0, combo["Pal 2"].talentShot || 0);
        const maxTalentDefense = Math.max(combo["Pal 1"].talentDefense || 0, combo["Pal 2"].talentDefense || 0);
        
        // Get parent passives
        const parent1Passives = combo["Pal 1"].passiveSkills || [];
        const parent2Passives = combo["Pal 2"].passiveSkills || [];
        
        // Generate all possible passive combinations
        const passiveCombinations = generatePassiveCombinations(parent1Passives, parent2Passives);
        
        // Test each passive combination
        for (const passives of passiveCombinations) {
            try {
                const stats = GetPalStats(
                    resultCharacterId, 
                    maxTalentHP, 
                    maxTalentShot, 
                    maxTalentDefense, 
                    passives, 
                    30, // Level 30
                    10  // Max friendship rank
                );
                
                let score: number;
                if (mode === 'combat') {
                    // Calculate what the base stats would be without talents/passives for comparison
                    const baseStats = GetPalStats(resultCharacterId, 0, 0, 0, [], 30, 10);
                    
                    // Calculate boost coefficients for each stat
                    const hpCoeff = stats.hp / baseStats.hp;
                    const attackCoeff = stats.attack / baseStats.attack;
                    const defenseCoeff = stats.defense / baseStats.defense;
                    
                    // Combat score: weighted average of boost coefficients (Attack gets 1.2x weight)
                    score = (hpCoeff + attackCoeff * 1.2 + defenseCoeff) / 3.2;
                } else {
                    // Work score: just maximize craft speed
                    score = stats.craftSpeed;
                }
                
                if (score > bestScore) {
                    bestScore = score;
                    bestStats = stats;
                    bestPassives = passives.map(a=> getLocalizedPassive(a.Id, "fr"));
                    bestCombination = combo;
                }
            } catch (error) {
                // Skip if GetPalStats fails for this character
                console.warn(`Failed to calculate stats for ${resultCharacterId}:`, error);
            }
        }
    }
    
    return { 
        stats: bestStats, 
        score: bestScore === -Infinity ? 0 : bestScore,
        bestPassives,
        bestCombination
    };
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
        const breedingCombinations: Record<string, BreedingSource[]> = {};
        
        const combiDone : Set<string> = new Set<string>();
        for (let i = 0; i < validPals.length; i++) {
            for (let j = i + 1; j < validPals.length; j++) {
                const pal1 = validPals[i];
                const pal2 = validPals[j];
                if(pal1.gender === pal2.gender) continue;
                
                const resultCharacterId = getBreedingResult(pal1.characterId!, pal2.characterId!);
                const key = [pal1.instanceId, pal2.instanceId].sort().join('-');
                if (resultCharacterId) {
                    if (!breedingCombinations[resultCharacterId]) {
                        breedingCombinations[resultCharacterId] = [];
                    }
                    if(!combiDone.has(key)){
                    breedingCombinations[resultCharacterId].push({
                        "Pal 1": pal1,
                        "Pal 2": pal2
                    });
                    combiDone.add(key);
                }
                }
            }
        }

        // Calculate optimized results for each character
        const breedingResults: BreedingResponse = {};

        for (const [resultCharacterId, combinations] of Object.entries(breedingCombinations)) {
            const combatResult = calculateBestPossibleStats(resultCharacterId, combinations, 'combat');
            const workResult = calculateBestPossibleStats(resultCharacterId, combinations, 'work');
            
            // Get work suitability data for this pal
            const palData = getPalData(resultCharacterId);
            const workSuitabilities = palData ? {
                emitFlame: palData.WorkSuitability_EmitFlame || 0,
                watering: palData.WorkSuitability_Watering || 0,
                seeding: palData.WorkSuitability_Seeding || 0,
                generateElectricity: palData.WorkSuitability_GenerateElectricity || 0,
                handcraft: palData.WorkSuitability_Handcraft || 0,
                collection: palData.WorkSuitability_Collection || 0,
                deforest: palData.WorkSuitability_Deforest || 0,
                mining: palData.WorkSuitability_Mining || 0,
                transport: palData.WorkSuitability_Transport || 0,
                monsterFarm: palData.WorkSuitability_MonsterFarm || 0,
                cool: palData.WorkSuitability_Cool || 0,
                productMedicine: palData.WorkSuitability_ProductMedicine || 0
            } : {
                emitFlame: 0, watering: 0, seeding: 0, generateElectricity: 0,
                handcraft: 0, collection: 0, deforest: 0, mining: 0,
                transport: 0, monsterFarm: 0, cool: 0, productMedicine: 0
            };
            
            breedingResults[resultCharacterId] = {
                characterId: resultCharacterId,
                displayName: getPalDisplayName(resultCharacterId),
                combinationCount: combinations.length,
                workSuitabilities,
                combatOptimization: {
                    stats: combatResult.stats,
                    score: combatResult.score,
                    improvementPercentage: Math.round((combatResult.score - 1) * 100),
                    bestPassives: combatResult.bestPassives,
                    bestCombination: combatResult.bestCombination!
                },
                workOptimization: {
                    stats: workResult.stats,
                    score: Math.round(workResult.score),
                    bestPassives: workResult.bestPassives,
                    bestCombination: workResult.bestCombination!
                },
                allCombinations: combinations
            };
        }

        return json(breedingResults);

    } catch (err) {
        console.error(`Error getting world details for ${params.id}:`, err);
        return error(500, 'Failed to load world details');
    }
};
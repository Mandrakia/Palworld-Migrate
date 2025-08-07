import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Pal } from "$save-edit/models/Pal";
import type { PalCardData } from '$lib/CharacterCardData';
import {getDisplayedPassive, getPlayerPals} from "$lib/mappers";
import type { Player } from "$save-edit/models/Player";
import { getPalData, getPassive, palDatabase } from "$lib/palDatabase";
import type { BreedingPair, WorkSpeedRoute } from '$lib/interfaces/breeding';
import { GetPalStats } from '$lib/stats';
import type {PassiveSkill} from "$lib/interfaces";
import {splitGuids} from "$lib/guidUtils";
import { getBreedingResult } from "$lib/breedingUtils";

// Cached breeding combinations map
let breedingCombinationsCache: Map<string, {parent1: string, parent2: string}[]> | null = null;

// Build cached breeding combinations map from palDatabase
function getBreedingCombinationsMap(): Map<string, {parent1: string, parent2: string}[]> {
    if (breedingCombinationsCache) {
        return breedingCombinationsCache;
    }

    console.log('Building breeding combinations cache...');
    const combinationsMap = new Map<string, {parent1: string, parent2: string}[]>();

    const exclusiveCombinations = new Set<string>();
    // Initialize map for all known characters
    for (const [_, palData] of Object.entries(palDatabase)) {
        const characterId = palData.Tribe.replace("EPalTribeID::", "");
        if (!combinationsMap.has(characterId)) {
            combinationsMap.set(characterId, [ { parent1: characterId, parent2: characterId }]);
        }
    }

    // Add explicit combinations from .Combinations in palDatabase
    for (const [_, palData] of Object.entries(palDatabase)) {
        for (const combination of palData.Combinations) {
            const childId = combination.ChildCharacterID;
            exclusiveCombinations.add(childId);
            const parent1 = combination.ParentTribeA;
            const parent2 = combination.ParentTribeB;

            if (!combinationsMap.has(childId)) {
                combinationsMap.set(childId, []);
            }
            const existing = combinationsMap.get(childId);
            const alreadyExists = existing.some(combo =>
                (combo.parent1 === parent1 && combo.parent2 === parent2) ||
                (combo.parent1 === parent2 && combo.parent2 === parent1)
            );
            if (!alreadyExists) {
                existing.push({ parent1, parent2 });
            }
        }
    }

    // Add CombiRank-based combinations
    const palEntries = Object.values(palDatabase);

    for (const targetPal of palEntries) {
        const targetCharacterId = targetPal.Tribe.replace("EPalTribeID::", "");
        if(exclusiveCombinations.has(targetCharacterId)) continue;
        const targetRank = targetPal.CombiRank;

        // Find all pairs that produce this target rank
        for (let i = 0; i < palEntries.length; i++) {
            for (let j = i; j < palEntries.length; j++) {
                const pal1 = palEntries[i];
                const pal2 = palEntries[j];

                const predictedRank = Math.floor((pal1.CombiRank + pal2.CombiRank + 1) / 2);

                if (predictedRank === targetRank) {
                    const parent1 = pal1.Tribe.replace("EPalTribeID::", "");
                    const parent2 = pal2.Tribe.replace("EPalTribeID::", "");

                    // Skip if already exists from explicit combinations
                    const existing = combinationsMap.get(targetCharacterId) || [];
                    const alreadyExists = existing.some(combo =>
                        (combo.parent1 === parent1 && combo.parent2 === parent2) ||
                        (combo.parent1 === parent2 && combo.parent2 === parent1)
                    );

                    if (!alreadyExists) {
                        combinationsMap.get(targetCharacterId)!.push({ parent1, parent2 });
                    }
                }
            }
        }
    }

    // Log statistics
    let totalCombinations = 0;
    for (const [characterId, combinations] of combinationsMap) {
        totalCombinations += combinations.length;
        if (combinations.length > 0) {
            console.log(`${characterId}: ${combinations.length} breeding combinations`);
        }
    }

    console.log(`Cached ${totalCombinations} total breeding combinations for ${combinationsMap.size} characters`);

    breedingCombinationsCache = combinationsMap;
    return combinationsMap;
}


// Collect all work speed boosting passives from owned pals
function collectAvailableWorkSpeedPassives(pals: PalCardData[]): {passive: PassiveSkill, count: number, sources: PalCardData[]}[] {
    const workSpeedPassives = new Map<string, {passive: PassiveSkill, count: number, sources: PalCardData[]}>();
    
    for (const pal of pals) {
        if (!pal.passiveSkills) continue;
        
        for (const passive of pal.passiveSkills) {
            if (!passive.Id) continue;
            
            try {
                const passiveData = getPassive(passive.Id);
                if (passiveData && passiveData.Buff && passiveData.Buff.b_CraftSpeed > 0) {
                    const key = passive.Id;
                    if (!workSpeedPassives.has(key)) {
                        workSpeedPassives.set(key, {
                            passive: passive,
                            count: 0,
                            sources: []
                        });
                    }
                    const entry = workSpeedPassives.get(key)!;
                    entry.count++;
                    entry.sources.push(pal);
                }
            } catch (error) {
                // Skip unknown passive skills
            }
        }
    }
    
    // Sort by craft speed bonus (highest first)
    return Array.from(workSpeedPassives.values()).sort((a, b) => {
        const buffA = getPassive(a.passive.Id)?.Buff?.b_CraftSpeed || 0;
        const buffB = getPassive(b.passive.Id)?.Buff?.b_CraftSpeed || 0;
        return buffB - buffA;
    });
}

export interface SimplePal {
    characterId: string,
    gender: "Male" | "Female" | "Neutral",
    passives: string[],
    level: number
}
export interface PalWithGenealogy extends SimplePal{
    parent1?: PalWithGenealogy,
    parent2?: PalWithGenealogy,
    probability?: number // Probability of getting this specific passive combination
}

export interface BreedingRoute {
    target: PalWithGenealogy;
    steps: BreedingStep[];
}

export interface BreedingStep {
    parent1: PalWithGenealogy;
    parent2: PalWithGenealogy;
    result: PalWithGenealogy;
    generation: number;
}
// Find ALL available optimal passives for maximum work speed
function findOptimalPassiveCombination(availablePassives: {passive: PassiveSkill, count: number, sources: PalCardData[]}[]): PassiveSkill[] {
    console.log(`Analyzing ${availablePassives.length} available work speed passives:`);
    
    // Log all available passives with their buff values
    for (const entry of availablePassives) {
        const passiveData = getPassive(entry.passive.Id);
        const craftSpeedBuff = passiveData?.Buff?.b_CraftSpeed || 0;
        console.log(`  ${entry.passive.Name}: +${(craftSpeedBuff * 100).toFixed(1)}% craft speed (${entry.count} sources)`);
    }
    
    // Instead of just taking top 4, find the best combination considering synergies
    const allCombinations: PassiveSkill[][] = [];
    
    // Generate all possible combinations of 1-4 passives
    for (let size = 1; size <= Math.min(4, availablePassives.length); size++) {
        const combinations = generateCombinations(availablePassives, size);
        allCombinations.push(...combinations);
    }
    
    // Score each combination
    let bestCombination: PassiveSkill[] = [];
    let bestScore = 0;
    
    for (const combination of allCombinations) {
        const totalCraftSpeedBuff = combination.reduce((sum, passive) => {
            const passiveData = getPassive(passive.Id);
            return sum + (passiveData?.Buff?.b_CraftSpeed || 0);
        }, 0);
        
        // Score based on craft speed buff and availability of sources
        const availabilityScore = combination.reduce((sum, passive) => {
            const entry = availablePassives.find(e => e.passive.Id === passive.Id);
            return sum + (entry?.count || 0);
        }, 0);
        
        const score = (totalCraftSpeedBuff * 1000) + availabilityScore; // Prioritize craft speed, then availability
        
        if (score > bestScore) {
            bestScore = score;
            bestCombination = combination;
        }
    }
    
    console.log(`Selected optimal combination: ${bestCombination.map(p => p.Name).join(', ')}`);
    console.log(`Total craft speed bonus: +${(bestCombination.reduce((sum, p) => sum + (getPassive(p.Id)?.Buff?.b_CraftSpeed || 0), 0) * 100).toFixed(1)}%`);
    
    return bestCombination;
}

// Generate all possible passive combinations (1-4 passives) from parent pool
function generatePassiveCombinations(parent1Passives: string[], parent2Passives: string[]): {passives: string[], probability: number}[] {
    // Combine parent passives and remove duplicates
    const passivePool = [...new Set([...parent1Passives, ...parent2Passives])];
    
    if (passivePool.length === 0) {
        return [{passives: [], probability: 1.0}];
    }
    
    const combinations: {passives: string[], probability: number}[] = [];
    
    // Generate all possible combinations of 1-4 passives
    for (let numPassives = 1; numPassives <= Math.min(4, passivePool.length); numPassives++) {
        const combos = getCombinations(passivePool, numPassives);
        
        // Each combination has equal probability within its size group
        // Real game probably has different probabilities, but this is a reasonable approximation
        const probabilityPerCombo = 1 / (4 * combos.length); // Assuming equal chance for 1, 2, 3, or 4 passives
        
        for (const combo of combos) {
            combinations.push({
                passives: combo,
                probability: probabilityPerCombo
            });
        }
    }
    
    // Also include the possibility of no passives (though rare)
    combinations.push({passives: [], probability: 0.05});
    
    // Normalize probabilities so they sum to 1
    const totalProb = combinations.reduce((sum, c) => sum + c.probability, 0);
    combinations.forEach(c => c.probability = c.probability / totalProb);
    
    return combinations;
}

// Helper function to get all combinations of k items from array
function getCombinations<T>(array: T[], k: number): T[][] {
    if (k === 0) return [[]];
    if (k > array.length) return [];
    
    const result: T[][] = [];
    
    function backtrack(start: number, currentCombo: T[]) {
        if (currentCombo.length === k) {
            result.push([...currentCombo]);
            return;
        }
        
        for (let i = start; i < array.length; i++) {
            currentCombo.push(array[i]);
            backtrack(i + 1, currentCombo);
            currentCombo.pop();
        }
    }
    
    backtrack(0, []);
    return result;
}


function findBreedingRoute2(characterId: string, passives: string[], pals: SimplePal[]) {
    const algorithmStart = Date.now();
    const breedingRoutes = getBreedingCombinationsMap();
    const palsWithPassives = pals.filter(a=> a.passives.some(ps=> passives.some(p=> p === ps)));
    
    console.log(`  Starting with ${palsWithPassives.length} pals that have desired passives (from ${pals.length} total)`);
    
    // Keep track of all discovered pals across all generations
    const allDiscoveredPals: PalWithGenealogy[] = [];
    let currentGeneration = [...palsWithPassives];
    let generationCount = 0;
    const maxGenerations = 5; // Reduced from 10 - diminishing returns after gen 3-4
    const maxCombinationsPerGen = 50000; // Prevent runaway combinations
    const maxPalsPerGeneration = 100; // Limit generation size
    
    while (generationCount < maxGenerations) {
        const generationStart = Date.now();
        const nextGeneration: PalWithGenealogy[] = [];
        let foundNewCombinations = false;
        let combinationsAttempted = 0;
        
        // Try all combinations of current generation pals
        for (let i = 0; i < currentGeneration.length; i++) {
            for (let j = i + 1; j < currentGeneration.length; j++) {
                combinationsAttempted++;
                
                // Early exit if we've hit the combination limit
                if (combinationsAttempted > maxCombinationsPerGen) {
                    console.log(`    Hit combination limit (${maxCombinationsPerGen}) - stopping generation early`);
                    break;
                }
                
                const palA = currentGeneration[i];
                const palB = currentGeneration[j];
                
                // Check if they have different genders or can breed together
                const canBreed = palA.gender !== palB.gender || palA.gender === "Neutral";
                if (!canBreed) continue;
                
                // Get what breeding result would be
                const breedingResult = getBreedingResult(palA, palB);
                if (!breedingResult) continue;
                
                // Generate all possible offspring passive combinations
                const possibleCombinations = generatePassiveCombinations(palA.passives, palB.passives);
                
                // Filter for combinations that have desired passives
                const beneficialCombinations = possibleCombinations.filter(combo => {
                    const desiredPassivesInCombo = combo.passives.filter(p => passives.includes(p));
                    const palADesiredCount = palA.passives.filter(p => passives.includes(p)).length;
                    const palBDesiredCount = palB.passives.filter(p => passives.includes(p)).length;
                    
                    // Only keep if we get more desired passives than either parent
                    return desiredPassivesInCombo.length > Math.max(palADesiredCount, palBDesiredCount);
                });
                
                // Add all beneficial combinations to next generation
                for (const combo of beneficialCombinations) {
                    // Check if this exact combination already exists
                    const alreadyExists = [...allDiscoveredPals, ...nextGeneration].some(existing => 
                        existing.characterId === breedingResult && 
                        existing.passives.length === combo.passives.length &&
                        existing.passives.every(p => combo.passives.includes(p))
                    );
                    
                    if (!alreadyExists && combo.probability > 0.01) { // Only include combinations with reasonable probability
                        const newPal: PalWithGenealogy = {
                            parent1: palA,
                            parent2: palB,
                            characterId: breedingResult,
                            passives: combo.passives,
                            gender: 'Neutral',
                            level: 1,
                            probability: combo.probability
                        };
                        
                        nextGeneration.push(newPal);
                        foundNewCombinations = true;
                    }
                }
            }
            // Break out of outer loop too if we hit the limit
            if (combinationsAttempted > maxCombinationsPerGen) break;
        }
        
        // Sort next generation by number of desired passives (keep best ones)
        nextGeneration.sort((a, b) => {
            const aDesired = a.passives.filter(p => passives.includes(p)).length;
            const bDesired = b.passives.filter(p => passives.includes(p)).length;
            return bDesired - aDesired;
        });
        
        // Limit generation size to prevent explosion
        const limitedGeneration = nextGeneration.slice(0, maxPalsPerGeneration);
        
        // Add this generation's results to our total collection
        allDiscoveredPals.push(...limitedGeneration);
        const generationTime = Date.now() - generationStart;
        console.log(`  Gen ${generationCount + 1}: ${generationTime}ms - ${combinationsAttempted} combinations attempted, ${limitedGeneration.length}/${nextGeneration.length} beneficial results kept`);
        
        // If no new combinations were found, we're done
        if (!foundNewCombinations) {
            break;
        }
        
        // Prepare for next generation: Use only the limited generation + best from current
        // Keep only the best performers from current generation to prevent explosion
        const currentBest = currentGeneration
            .sort((a, b) => {
                const aDesired = a.passives.filter(p => passives.includes(p)).length;
                const bDesired = b.passives.filter(p => passives.includes(p)).length;
                return bDesired - aDesired;
            })
            .slice(0, 50); // Keep top 50 from current generation
            
        currentGeneration = [...currentBest, ...limitedGeneration];
        generationCount++;
    }
    
    const algorithmTime = Date.now() - algorithmStart;
    console.log(`  Discovery algorithm completed: ${algorithmTime}ms - ${generationCount} generations, ${allDiscoveredPals.length} total discovered combinations`);
    
    return allDiscoveredPals;
}

function findRoutesToTarget(targetCharacterId: string, existingPals: SimplePal[], bredPals: PalWithGenealogy[], desiredPassives: string[]): BreedingRoute[] {
    const pathfindingStart = Date.now();
    const breedingRoutes = getBreedingCombinationsMap();
    
    // Sort bred pals by number of desired passives (best first)
    const sortStart = Date.now();
    const sortedBredPals = bredPals.sort((a, b) => {
        const aDesired = a.passives.filter(p => desiredPassives.includes(p)).length;
        const bDesired = b.passives.filter(p => desiredPassives.includes(p)).length;
        return bDesired - aDesired;
    });
    const sortTime = Date.now() - sortStart;
    
    console.log(`  Pathfinding: Sorted ${bredPals.length} bred pals in ${sortTime}ms`);
    
    const validRoutes: BreedingRoute[] = [];
    let directRoutesFound = 0;
    let indirectRoutesFound = 0;
    let palsProcessed = 0;
    
    // Try to find paths from each bred pal to the target
    for (const bredPal of sortedBredPals) {
        palsProcessed++;
        const desiredPassivesInBred = bredPal.passives.filter(p => desiredPassives.includes(p));
        if (desiredPassivesInBred.length === 0) continue; // Skip if no desired passives
        
        // Try direct path: can this bred pal be used directly to breed the target?
        const directStart = Date.now();
        const route = findDirectPath(bredPal, targetCharacterId, existingPals, bredPals, breedingRoutes, desiredPassives);
        if (route) {
            validRoutes.push(route);
            directRoutesFound++;
        } else {
            // Try indirect path: find intermediate breeding steps
            const indirectRoute = findIndirectPath(bredPal, targetCharacterId, existingPals, bredPals, breedingRoutes, desiredPassives);
            if (indirectRoute) {
                validRoutes.push(indirectRoute);
                indirectRoutesFound++;
            }
        }
    }
    
    const pathfindingTime = Date.now() - pathfindingStart;
    console.log(`  Pathfinding completed: ${pathfindingTime}ms - Processed ${palsProcessed} pals, found ${directRoutesFound} direct + ${indirectRoutesFound} indirect routes`);
    
    return validRoutes;
}

// Try to find a direct breeding path using the bred pal as one parent
function findDirectPath(bredPal: PalWithGenealogy, targetCharacterId: string, existingPals: SimplePal[], bredPals: PalWithGenealogy[], breedingRoutes: Map<string, {parent1: string, parent2: string}[]>, desiredPassives: string[]): BreedingRoute | null {
    const targetCombinations = breedingRoutes.get(targetCharacterId);
    if (!targetCombinations) return null;
    
    const allAvailablePals = [...existingPals, ...bredPals];
    
    for (const combination of targetCombinations) {
        const { parent1, parent2 } = combination;
        
        // Check if bred pal matches one of the required parents
        if (bredPal.characterId === parent1) {
            // Find a suitable second parent
            const secondParent = allAvailablePals.find(pal => 
                pal.characterId === parent2 && 
                (pal.gender !== bredPal.gender || pal.gender === "Neutral")
            );
            
            if (secondParent) {
                return createRoute(bredPal, secondParent, targetCharacterId, desiredPassives);
            }
        } else if (bredPal.characterId === parent2) {
            // Find a suitable first parent
            const firstParent = allAvailablePals.find(pal => 
                pal.characterId === parent1 && 
                (pal.gender !== bredPal.gender || pal.gender === "Neutral")
            );
            
            if (firstParent) {
                return createRoute(firstParent, bredPal, targetCharacterId, desiredPassives);
            }
        }
    }
    
    return null;
}

// Try to find an indirect path through intermediate breeding steps
function findIndirectPath(bredPal: PalWithGenealogy, targetCharacterId: string, existingPals: SimplePal[], bredPals: PalWithGenealogy[], breedingRoutes: Map<string, {parent1: string, parent2: string}[]>, desiredPassives: string[]): BreedingRoute | null {
    const targetCombinations = breedingRoutes.get(targetCharacterId);
    if (!targetCombinations) return null;
    
    const allAvailablePals = [...existingPals, ...bredPals];
    
    // For each target combination, see if we can breed the required parents
    for (const combination of targetCombinations) {
        const { parent1, parent2 } = combination;
        
        // Try to breed parent1 using our bred pal
        const parent1Route = findDirectPath(bredPal, parent1, existingPals, bredPals, breedingRoutes, desiredPassives);
        if (parent1Route) {
            // Find parent2 from available pals
            const secondParent = allAvailablePals.find(pal => 
                pal.characterId === parent2 && 
                (pal.gender !== 'Neutral' || parent1Route.target.gender !== 'Neutral')
            );
            
            if (secondParent) {
                // Create route: bred steps -> parent1, then parent1 + parent2 -> target
                const finalStep: BreedingStep = {
                    parent1: parent1Route.target,
                    parent2: secondParent,
                    result: {
                        characterId: targetCharacterId,
                        gender: 'Neutral',
                        level: 1,
                        passives: [...new Set([...parent1Route.target.passives, ...secondParent.passives])]
                    },
                    generation: 0
                };
                
                return {
                    target: finalStep.result,
                    steps: [...parent1Route.steps, finalStep]
                };
            }
        }
        
        // Try to breed parent2 using our bred pal
        const parent2Route = findDirectPath(bredPal, parent2, existingPals, bredPals, breedingRoutes, desiredPassives);
        if (parent2Route) {
            // Find parent1 from available pals
            const firstParent = allAvailablePals.find(pal => 
                pal.characterId === parent1 && 
                (pal.gender !== 'Neutral' || parent2Route.target.gender !== 'Neutral')
            );
            
            if (firstParent) {
                // Create route: bred steps -> parent2, then parent1 + parent2 -> target
                const finalStep: BreedingStep = {
                    parent1: firstParent,
                    parent2: parent2Route.target,
                    result: {
                        characterId: targetCharacterId,
                        gender: 'Neutral', 
                        level: 1,
                        passives: [...new Set([...firstParent.passives, ...parent2Route.target.passives])]
                    },
                    generation: 0
                };
                
                return {
                    target: finalStep.result,
                    steps: [...parent2Route.steps, finalStep]
                };
            }
        }
    }
    
    return null;
}

function createRoute(parent1: SimplePal | PalWithGenealogy, parent2: SimplePal | PalWithGenealogy, targetCharacterId: string, desiredPassives: string[]): BreedingRoute | null {
    // Generate all possible passive combinations for this breeding
    const possibleCombinations = generatePassiveCombinations(parent1.passives, parent2.passives);
    
    // Find the combination with the most desired passives and reasonable probability
    let bestCombo: {passives: string[], probability: number} | null = null;
    let maxDesiredCount = 0;
    
    for (const combo of possibleCombinations) {
        const desiredCount = combo.passives.filter(p => desiredPassives.includes(p)).length;
        if (desiredCount > maxDesiredCount && combo.probability > 0.01) {
            maxDesiredCount = desiredCount;
            bestCombo = combo;
        }
    }
    
    if (!bestCombo || maxDesiredCount === 0) return null;
    
    const targetPal: PalWithGenealogy = {
        characterId: targetCharacterId,
        gender: 'Neutral',
        level: 1,
        passives: bestCombo.passives,
        probability: bestCombo.probability,
        parent1: parent1 as PalWithGenealogy,
        parent2: parent2 as PalWithGenealogy
    };
    
    const step: BreedingStep = {
        parent1: parent1 as PalWithGenealogy,
        parent2: parent2 as PalWithGenealogy,
        result: targetPal,
        generation: 0
    };
    
    // Include breeding steps from parent genealogies
    const parent1Steps = 'parent1' in parent1 && 'parent2' in parent1 ? buildBreedingSteps(parent1) : [];
    const parent2Steps = 'parent1' in parent2 && 'parent2' in parent2 ? buildBreedingSteps(parent2) : [];
    
    return {
        target: targetPal,
        steps: [...parent1Steps, ...parent2Steps, step]
    };
}

function buildBreedingSteps(pal: PalWithGenealogy, generation: number = 0): BreedingStep[] {
    const steps: BreedingStep[] = [];
    
    if (pal.parent1 && pal.parent2) {
        // Recursively build steps for parents first
        const parent1Steps = buildBreedingSteps(pal.parent1, generation + 1);
        const parent2Steps = buildBreedingSteps(pal.parent2, generation + 1);
        
        // Add parent steps first
        steps.push(...parent1Steps);
        steps.push(...parent2Steps);
        
        // Add the current breeding step
        steps.push({
            parent1: pal.parent1,
            parent2: pal.parent2,
            result: pal,
            generation: generation
        });
    }
    
    return steps;
}

function findBreedingRoute(characterId: string, passives: PassiveSkill[], pals: PalCardData[]) {
    const breedingRoutes = getBreedingCombinationsMap();
    const palsWithPassives = pals.filter(a=> a.passiveSkills.some(ps=> passives.some(p=> p.name === ps.name)));
    console.log("Passives parent:", palsWithPassives.map(a=> a.characterId));
    const ascendants = new Set<string>();
    for(let breedingRoute of breedingRoutes.get(characterId)) {
        console.log("Route : ", breedingRoute);
        ascendants.add(breedingRoute.parent1);
        ascendants.add(breedingRoute.parent2);
        if(palsWithPassives.map(a=> a.characterId).includes(breedingRoute.parent1) || palsWithPassives.map(a=> a.characterId).includes(breedingRoute.parent2)){



            return true;
        }
    }
    //Else
    for(let ascendant of ascendants) {
        var found = findBreedingRoute(ascendant, passives, pals);
        if(found) {
            return true;
        }
    }
}

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
        const pals = getPlayerPals(pWorld, pSave, serverSave).map(p => ({
            characterId: p.characterId,
            gender: p.gender.replace('EPalGenderType::','') as "Male" | "Female" | "Neutral",
            passives: p.passiveSkills.map(a=> a.Id),
            level: p.level
        }));
        
        // Get desired character and passives from query params
        const targetCharacter = url.searchParams.get('characterId');
        const desiredPassives = url.searchParams.get('passives')?.split(',') || collectAvailableWorkSpeedPassives(getPlayerPals(pWorld, pSave, serverSave)).map(a=> a.passive.Id);
        if(!targetCharacter) {
            return json({ error: 'Must specify the character ID' }, { status: 400 });
        }
        const startTime = Date.now();
        console.log(`Finding breeding route for ${targetCharacter} with passives: ${desiredPassives.join(', ')}`);
        
        // Step 1: Generate all possible breeding combinations with desired passives
        const step1Start = Date.now();
        const discoveredPals = findBreedingRoute2(targetCharacter, desiredPassives, pals);
        const step1Time = Date.now() - step1Start;
        console.log(`Step 1 (Discovery): ${step1Time}ms - Found ${discoveredPals.length} discovered pals`);
        
        // Step 2: Find routes from discovered pals to target character
        const step2Start = Date.now();
        const routesToTarget = findRoutesToTarget(targetCharacter, pals, discoveredPals, desiredPassives);
        const step2Time = Date.now() - step2Start;
        console.log(`Step 2 (Pathfinding): ${step2Time}ms - Found ${routesToTarget.length} routes`);
        
        // Step 3: Filter routes with desired passives
        const step3Start = Date.now();
        
        if (routesToTarget.length === 0) {
            return json({ 
                error: `No breeding routes found for ${targetCharacter} with the specified passives`,
                discoveredPals: discoveredPals.length,
                targetCharacter,
                desiredPassives
            }, { status: 404 });
        }
        
        // Filter routes that actually have desired passives
        const routesWithDesiredPassives = routesToTarget.filter(route => {
            const desiredPassivesInTarget = route.target.passives.filter(passive => 
                desiredPassives.includes(passive)
            );
            return desiredPassivesInTarget.length > 0;
        });
        const step3Time = Date.now() - step3Start;
        console.log(`Step 3 (Filtering): ${step3Time}ms - ${routesWithDesiredPassives.length} valid routes after filtering`);
        
        // Convert to WorkSpeedRoute format that frontend expects
        if (routesWithDesiredPassives.length === 0) {
            // Convert passive IDs to actual passive data for empty case too
            const getPassiveData = (passiveId: string) => {
                try {
                    const passiveData = getPassive(passiveId);
                    return {
                        Id: passiveId,
                        Name: passiveData?.Name || passiveId,
                        Rating: passiveData?.Rank || 0, // Use Rating instead of Rank
                        Description: passiveData?.Description || '',
                        Buff: passiveData?.Buff || {}
                    };
                } catch {
                    return { 
                        Id: passiveId, 
                        Name: passiveId, 
                        Rating: 0,
                        Description: '',
                        Buff: {} 
                    };
                }
            };

            return json({
                targetCharacterId: targetCharacter,
                finalWorkSpeed: 0,
                breedingSteps: [],
                totalGenerations: 0,
                requiredPassives: desiredPassives.map(getPassiveData)
            });
        }

        // Take the best route (first one after sorting)
        const bestRoute = routesWithDesiredPassives[0];
        const desiredPassivesInTarget = bestRoute.target.passives.filter(passive => 
            desiredPassives.includes(passive)
        );

        // Convert passive IDs to actual passive data with proper calculation
        const getPassiveData = (passiveId: string) => {
            try {
                return getDisplayedPassive(passiveId);

            } catch {
                return { 
                    Id: passiveId, 
                    Name: passiveId, 
                    Rating: 0,
                    Description: '',
                    Buff: {} 
                };
            }
        };

        // Helper function to get display name
        const getDisplayName = (characterId: string): string => {
            try {
                const palData = getPalData(characterId);
                return palData?.Name || characterId;
            } catch {
                return characterId;
            }
        };

        // Convert steps to BreedingPair format
        const breedingSteps = bestRoute.steps.map((step, index) => {
            const expectedPassives = step.result.passives.filter(p => desiredPassives.includes(p))
                .map(getPassiveData);
            
            // Find the parent pal data for more complete information
            const parent1Data = pals.find(p => p.characterId === step.parent1.characterId) || step.parent1;
            const parent2Data = pals.find(p => p.characterId === step.parent2.characterId) || step.parent2;

            // Calculate work speed score based on actual craft speed buffs
            const workSpeedScore = expectedPassives.reduce((total, passive) => {
                const craftSpeedBuff = passive.Buff?.b_CraftSpeed || 0;
                return total + (craftSpeedBuff * 100);
            }, 0);

            return {
                parent1: {
                    characterId: step.parent1.characterId,
                    name: getDisplayName(step.parent1.characterId),
                    level: parent1Data.level || step.parent1.level || 1,
                    gender: parent1Data.gender || step.parent1.gender || 'Neutral',
                    passiveSkills: step.parent1.passives.map(getPassiveData)
                },
                parent2: {
                    characterId: step.parent2.characterId,
                    name: getDisplayName(step.parent2.characterId),
                    level: parent2Data.level || step.parent2.level || 1,
                    gender: parent2Data.gender || step.parent2.gender || 'Neutral',
                    passiveSkills: step.parent2.passives.map(getPassiveData)
                },
                resultCharacterId: step.result.characterId,
                generation: step.generation,
                expectedPassives,
                passiveProbability: step.result.probability || Math.pow(0.5, expectedPassives.length), // Use calculated probability
                workSpeedScore: Math.round(workSpeedScore)
            };
        });

        // Calculate final work speed based on actual craft speed buffs
        const finalWorkSpeedBuff = desiredPassivesInTarget.reduce((total, passiveId) => {
            try {
                const passiveData = getPassive(passiveId);
                return total + (passiveData?.Buff?.b_CraftSpeed || 0);
            } catch {
                return total;
            }
        }, 0);
        
        const finalWorkSpeed = Math.round(100 + (finalWorkSpeedBuff * 100)); // Base 100 + buff percentage

        // Step 4: Data conversion and response preparation
        const step4Time = Date.now() - step3Start - step3Time;
        const totalTime = Date.now() - startTime;
        
        console.log(`Step 4 (Response prep): ${step4Time}ms`);
        console.log(`Total processing time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
        console.log(`Performance breakdown: Discovery ${Math.round(step1Time/totalTime*100)}% | Pathfinding ${Math.round(step2Time/totalTime*100)}% | Filtering ${Math.round(step3Time/totalTime*100)}% | Response ${Math.round(step4Time/totalTime*100)}%`);

        return json({
            targetCharacterId: targetCharacter,
            finalWorkSpeed,
            breedingSteps,
            totalGenerations: breedingSteps.length,
            requiredPassives: desiredPassivesInTarget.map(getPassiveData)
        });

    } catch (err) {
        console.error(`Error getting breeding route for ${params.id}:`, err);
        return json({ error: 'Failed to calculate breeding route' }, { status: 500 });
    }
};
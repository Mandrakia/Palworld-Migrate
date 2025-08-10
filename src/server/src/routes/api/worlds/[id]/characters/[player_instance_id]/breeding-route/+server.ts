import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { PalCardData } from '$lib/CharacterCardData';
import {getPlayerPals} from "$lib/mappers";
import type { Player } from "$save-edit/models/Player";
import { getLocalizedPassive, getPalData, getPassive, palDatabase } from "$lib/palDatabase";
import type {BreedingRoute, BreedingStep, PalWithGenealogy, PassiveSkill, SimplePal, BreedingRouteResponse} from "$lib/interfaces";
import {splitGuids} from "$lib/guidUtils";
import { getBreedingResult } from "$lib/breedingUtils";
import type { LocalizedPassiveSkill } from '$lib/interfaces/passive-skills';

// Cached breeding combinations map

/**
 * Determine if two pal references represent the same in-world instance.
 * They are considered the same if both have playerId and instanceId and they match,
 * or if they are the exact same object reference.
 */
function isSameInstance(a: SimplePal | PalWithGenealogy, b: SimplePal | PalWithGenealogy): boolean {
    if (a === b) return true;
    const aPlayer = (a as any).playerId;
    const bPlayer = (b as any).playerId;
    const aInstance = (a as any).instanceId;
    const bInstance = (b as any).instanceId;
    return Boolean(aPlayer && bPlayer && aInstance && bInstance && aPlayer === bPlayer && aInstance === bInstance);
}

const getDisplayName = (characterId: string, pal?: PalCardData): string => {
    try {
        const palData = getPalData(characterId);
        return pal?.name || palData?.OverrideNameTextID || characterId;
    } catch {
        return characterId;
    }
};



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



// Generate all possible passive combinations (1-4 passives) from parent pool
function generatePassiveCombinations(parent1Passives: LocalizedPassiveSkill[], parent2Passives: LocalizedPassiveSkill[]): {passives: LocalizedPassiveSkill[], probability: number}[] {
    // Combine parent passives and remove duplicates by Id (not by reference)
    const poolMap = new Map<string, LocalizedPassiveSkill>();
    for (const p of [...parent1Passives, ...parent2Passives]) {
        if (p && typeof (p as any).Id === 'string' && !poolMap.has(p.Id)) {
            poolMap.set(p.Id, p);
        }
    }
    const passivePool = Array.from(poolMap.values());

    // If no passives from parents, the only possible result is no passives
    if (passivePool.length === 0) {
        return [{ passives: [], probability: 1.0 }];
    }

    // User-specified distribution for number of inherited passives
    const baseWeights: Record<number, number> = { 1: 0.4, 2: 0.3, 3: 0.2, 4: 0.1 };
    // Only k up to the available pool size are possible; renormalize weights over valid k's
    const validKs = [1, 2, 3, 4].filter(k => k <= passivePool.length);
    const weightSum = validKs.reduce((sum, k) => sum + (baseWeights[k] || 0), 0);

    const combinations: { passives: LocalizedPassiveSkill[], probability: number }[] = [];

    for (const k of validKs) {
        const combos = getCombinations(passivePool, k);
        const normalizedWeight = (baseWeights[k] || 0) / (weightSum || 1);
        const probabilityPerCombo = combos.length > 0 ? (normalizedWeight / combos.length) : 0;

        for (const combo of combos) {
            combinations.push({ passives: combo, probability: probabilityPerCombo });
        }
    }

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


function findBreedingRoute2(characterId: string, passives: LocalizedPassiveSkill[], pals: SimplePal[]) {
    const algorithmStart = Date.now();
    const palsWithPassives = pals.filter(a=> a.passives.some(ps=> passives.some(p=> p.Id === ps.Id)));
    
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
                    const desiredPassivesInCombo = combo.passives.filter(p => passives.some(dp => dp.Id === p.Id));
                    const palADesiredCount = palA.passives.filter(p => passives.some(dp => dp.Id === p.Id)).length;
                    const palBDesiredCount = palB.passives.filter(p => passives.some(dp => dp.Id === p.Id)).length;
                    
                    // Only keep if we get more desired passives than either parent
                    return desiredPassivesInCombo.length > Math.max(palADesiredCount, palBDesiredCount);
                });
                
                // Add all beneficial combinations to next generation
                for (const combo of beneficialCombinations) {
                    // Check if this exact combination already exists
                    const alreadyExists = [...allDiscoveredPals, ...nextGeneration].some(existing => 
                        existing.characterId === breedingResult && 
                        existing.passives.length === combo.passives.length &&
                        existing.passives.every(p => combo.passives.some(cp => cp.Id === p.Id))
                    );
                    
                    if (!alreadyExists && combo.probability > 0.001) { // Only include combinations with reasonable probability
                        // Sum probabilities across all offspring combos that include at least the desired passives
                        // present in this combo (supersets allowed), by Id
                        const desiredInCombo = combo.passives.filter(p => passives.some(dp => dp.Id === p.Id));
                        const aggregatedProb = possibleCombinations
                            .filter(c => desiredInCombo.every(dp => c.passives.some(p => p.Id === dp.Id)))
                            .reduce((acc, c) => acc + c.probability, 0);
                        const newPal: PalWithGenealogy = {
                            parent1: palA,
                            parent2: palB,
                            characterId: breedingResult,
                            passives: combo.passives,
                            gender: 'Neutral',
                            level: 1,
                            probability: aggregatedProb,
                            name: getDisplayName(breedingResult)
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
            const aDesired = a.passives.filter(p => passives.some(dp => dp.Id === p.Id)).length;
            const bDesired = b.passives.filter(p => passives.some(dp => dp.Id === p.Id)).length;
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
                const aDesired = a.passives.filter(p => passives.some(dp => dp.Id === p.Id)).length;
                const bDesired = b.passives.filter(p => passives.some(dp => dp.Id === p.Id)).length;
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

function findRoutesToTarget(targetCharacterId: string, existingPals: SimplePal[], bredPals: PalWithGenealogy[], desiredPassives: LocalizedPassiveSkill[]): BreedingRoute[] {
    const pathfindingStart = Date.now();
    const breedingRoutes = getBreedingCombinationsMap();
    
    // Sort bred pals by number of desired passives (best first)
    const sortStart = Date.now();
    const sortedBredPals = bredPals.sort((a, b) => {
        const aDesired = a.passives.filter(p => desiredPassives.some(dp => dp.Id === p.Id)).length;
        const bDesired = b.passives.filter(p => desiredPassives.some(dp => dp.Id === p.Id)).length;
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
        const desiredPassivesInBred = bredPal.passives.filter(p => desiredPassives.some(dp => dp.Id === p.Id));
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
function findDirectPath(bredPal: PalWithGenealogy, targetCharacterId: string, existingPals: SimplePal[], bredPals: PalWithGenealogy[], breedingRoutes: Map<string, {parent1: string, parent2: string}[]>, desiredPassives: LocalizedPassiveSkill[]): BreedingRoute | null {
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
                (pal.gender !== bredPal.gender || pal.gender === "Neutral") &&
                !isSameInstance(pal, bredPal)
            );
            
            if (secondParent) {
                return createRoute(bredPal, secondParent, targetCharacterId, desiredPassives);
            }
        } else if (bredPal.characterId === parent2) {
            // Find a suitable first parent
            const firstParent = allAvailablePals.find(pal => 
                pal.characterId === parent1 && 
                (pal.gender !== bredPal.gender || pal.gender === "Neutral") &&
                !isSameInstance(pal, bredPal)
            );
            
            if (firstParent) {
                return createRoute(firstParent, bredPal, targetCharacterId, desiredPassives);
            }
        }
    }
    
    return null;
}

// Try to find an indirect path through intermediate breeding steps
function findIndirectPath(bredPal: PalWithGenealogy, targetCharacterId: string, existingPals: SimplePal[], bredPals: PalWithGenealogy[], breedingRoutes: Map<string, {parent1: string, parent2: string}[]>, desiredPassives: LocalizedPassiveSkill[]): BreedingRoute | null {
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
                // Use createRoute to generate the final step with proper passive combinations and probability
                const route = createRoute(parent1Route.target, secondParent, targetCharacterId, desiredPassives);
                if (route) return route;
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
                // Use createRoute to generate the final step with proper passive combinations and probability
                const route = createRoute(firstParent, parent2Route.target, targetCharacterId, desiredPassives);
                if (route) return route;
            }
        }
    }
    
    return null;
}

function createRoute(parent1: SimplePal | PalWithGenealogy, parent2: SimplePal | PalWithGenealogy, targetCharacterId: string, desiredPassives: LocalizedPassiveSkill[]): BreedingRoute | null {
    // Do not allow breeding with the exact same pal instance
    if (isSameInstance(parent1, parent2)) {
        return null;
    }
    // Generate all possible passive combinations for this breeding
    const possibleCombinations = generatePassiveCombinations(parent1.passives, parent2.passives);
    
    // Find the combination with the most desired passives, then highest probability, then highest craft speed
    const PROB_THRESHOLD = 0.001;
    let bestCombo: { passives: LocalizedPassiveSkill[]; probability: number } | null = null;
    let bestDesiredCount = -1;
    let bestProb = -1;
    let bestCraft = -1;

    for (const combo of possibleCombinations) {
        if (combo.probability < PROB_THRESHOLD) continue;
        const desiredCount = combo.passives.filter(p => desiredPassives.some(dp => dp.Id === p.Id)).length;
        const craftSum = combo.passives.reduce((sum, p) => sum + (p.Buff?.CraftSpeed || 0), 0);

        if (
            desiredCount > bestDesiredCount ||
            (desiredCount === bestDesiredCount && combo.probability > bestProb) ||
            (desiredCount === bestDesiredCount && combo.probability === bestProb && craftSum > bestCraft)
        ) {
            bestDesiredCount = desiredCount;
            bestProb = combo.probability;
            bestCraft = craftSum;
            bestCombo = combo;
        }
    }

    if (!bestCombo || bestDesiredCount <= 0) return null;

    // Success should include any offspring that contains ALL desired passives (supersets allowed)
    // Sum probabilities across all enumerated combinations that include the full desired set by Id
    const successProbability = possibleCombinations
        .filter(c => desiredPassives.every(dp => c.passives.some(p => p.Id === dp.Id)))
        .reduce((acc, c) => acc + c.probability, 0);

    const targetPal: PalWithGenealogy = {
        characterId: targetCharacterId,
        gender: 'Neutral',
        level: 1,
        passives: bestCombo.passives,
        probability: successProbability,
        parent1: parent1 as PalWithGenealogy,
        parent2: parent2 as PalWithGenealogy,
        name: getDisplayName(targetCharacterId)
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

        const locale = url.searchParams.get('locale') || 'fr';
        const [playerId, instanceId] = splitGuids(player_instance_id);
        const pWorld = serverSave.Characters.find(a=> a.PlayerId === playerId && a.InstanceId === instanceId) as Player;
        const pSave = saveWatcher.getPlayers(id).find(a=> a.PlayerUid === playerId && a.InstanceId === instanceId);

        if(!pWorld || !pSave) {
            return json({ error: 'Player not found' }, { status: 404 });
        }
        const pals = getPlayerPals(pWorld, pSave, serverSave).map(p => ({
            characterId: p.characterId,
            gender: (p.gender?.replace('EPalGenderType::','') || "Neutral") as "Male" | "Female" | "Neutral",
            passives: p.passiveSkills?.map(a=> getLocalizedPassive(a.Id, locale)) || [],
            level: p.level,
            playerId: p.id,
            instanceId: p.instanceId,
            name : p.name
        }));
        
        // Get desired character and passives from query params
        const targetCharacter = url.searchParams.get('characterId');
        const desiredPassives = url.searchParams.get('passives')?.split(',').map(a=> getLocalizedPassive(a, locale)) || collectAvailableWorkSpeedPassives(getPlayerPals(pWorld, pSave, serverSave)).slice(0,4).map(a=> getLocalizedPassive(a.passive.Id, locale));
        console.log(desiredPassives);
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
        
        let result: BreedingRouteResponse | null = null;

        if (routesToTarget.length === 0) {
            result = { 
                error: `No breeding routes found for ${targetCharacter} with the specified passives`,
                targetCharacterId: targetCharacter,
                requiredPassives: desiredPassives,
                finalWorkSpeed: 0,
                breedingSteps: [],
                totalGenerations: 0
            };
            return json(result, { status: 404 });
        }
        
        // Filter routes that actually have desired passives
        const routesWithDesiredPassives = routesToTarget.filter(route => {
            const desiredPassivesInTarget = route.target.passives.filter(passive => 
                desiredPassives.some(dp => dp.Id === passive.Id)
            );
            return desiredPassivesInTarget.length > 0;
        });
        const step3Time = Date.now() - step3Start;
        console.log(`Step 3 (Filtering): ${step3Time}ms - ${routesWithDesiredPassives.length} valid routes after filtering`);
        
        // Convert to WorkSpeedRoute format that frontend expects
        if (routesWithDesiredPassives.length === 0) {
            result = {
                targetCharacterId: targetCharacter,
                finalWorkSpeed: 0,
                breedingSteps: [],
                totalGenerations: 0,
                requiredPassives: desiredPassives
            };
            return json(result);
        }

        // Sort candidate routes by quality before selecting the best one
        const scoredRoutes = routesWithDesiredPassives.map(route => {
            const desiredCount = route.target.passives.filter(passive => desiredPassives.some(dp => dp.Id === passive.Id)).length;
            // Route probability is the product of step probabilities (fallback to a small value if missing)
            const routeProbability = route.steps.reduce((prod, step) => {
                const p = (step.result as PalWithGenealogy).probability ?? 0.01;
                return prod * p;
            }, 1);
            const stepsCount = route.steps.length;
            const targetCraftBuff = route.target.passives.reduce((acc, p) => acc + (getPassive(p.Id)?.Buff?.b_CraftSpeed || 0), 0);
            return { route, desiredCount, routeProbability, stepsCount, targetCraftBuff };
        });

        scoredRoutes.sort((a, b) => {
            // 1) higher work speed buff on target; 2) fewer steps; 3) higher total route probability
            if (b.targetCraftBuff !== a.targetCraftBuff) return b.targetCraftBuff - a.targetCraftBuff;
            if (a.stepsCount !== b.stepsCount) return a.stepsCount - b.stepsCount;
            return b.routeProbability - a.routeProbability;
        });

        const bestRoute = scoredRoutes[0].route;
        
        const desiredPassivesInTarget = bestRoute.target.passives.filter(passive => 
            desiredPassives.some(dp => dp.Id === passive.Id)
        );

        // Convert steps to BreedingPair format
        const breedingSteps: BreedingStep[] = bestRoute.steps.map((step, index) => {
            const expectedPassives = step.result.passives.filter(p => desiredPassives.some(dp => dp.Id === p.Id))
            
            // Find the parent pal data for more complete information
            const parent1Data = pals.find(p => p.playerId === step.parent1.playerId && p.instanceId === step.parent1.instanceId && p.characterId === step.parent1.characterId) || step.parent1;
            const parent2Data = pals.find(p => p.playerId === step.parent2.playerId && p.instanceId === step.parent2.instanceId && p.characterId === step.parent2.characterId) || step.parent2;

            // Calculate work speed score based on actual craft speed buffs
            const workSpeedScore = expectedPassives.reduce((total, passive) => {
                const craftSpeedBuff = passive.Buff?.CraftSpeed || 0;
                return total + (craftSpeedBuff * 100);
            }, 0);

            return {
                ...step,
                expectedPassives,
                passiveProbability: (step.result as PalWithGenealogy).probability ?? Math.pow(0.5, expectedPassives.length), // Use calculated probability; respect 0
                workSpeedScore: Math.round(workSpeedScore)
            };
        });

        // Calculate final work speed based on actual craft speed buffs
        const finalWorkSpeedBuff = desiredPassivesInTarget.reduce((total, passiveId) => {
            try {
                const passiveData = getPassive(passiveId.Id);
                return total + (passiveData?.Buff?.b_CraftSpeed || 0);
            } catch {
                return total;
            }
        }, 0);
        
        const finalWorkSpeed = Math.round(70 * (finalWorkSpeedBuff + 1)); // Base 100 + buff percentage

        // Step 4: Data conversion and response preparation
        const step4Time = Date.now() - step3Start - step3Time;
        const totalTime = Date.now() - startTime;
        
        console.log(`Step 4 (Response prep): ${step4Time}ms`);
        console.log(`Total processing time: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);
        console.log(`Performance breakdown: Discovery ${Math.round(step1Time/totalTime*100)}% | Pathfinding ${Math.round(step2Time/totalTime*100)}% | Filtering ${Math.round(step3Time/totalTime*100)}% | Response ${Math.round(step4Time/totalTime*100)}%`);

        result = {
            targetCharacterId: targetCharacter,
            finalWorkSpeed,
            breedingSteps,
            totalGenerations: breedingSteps.length,
            requiredPassives: desiredPassivesInTarget
        };
        return json(result);

    } catch (err) {
        console.error(`Error getting breeding route for ${params.id}:`, err);
        return json({ error: 'Failed to calculate breeding route' }, { status: 500 });
    }
};
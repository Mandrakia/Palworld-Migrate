import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Pal } from "$save-edit/models/Pal";
import type { PalCardData } from '$lib/CharacterCardData';
import { getPlayerPals } from "$lib/mappers";
import type { Player } from "$save-edit/models/Player";
import { getPalData, getPassive, palDatabase } from "$lib/palDatabase";
import type { BreedingPair, WorkSpeedRoute } from '$lib/interfaces/breeding';
import { GetPalStats } from '$lib/stats';
import type {PassiveSkill} from "$lib/interfaces";

function splitGuids(encoded: string): [string, string] {
    let combined = 0n;
    for (let i = 0; i < encoded.length; i++) {
        const digit = encoded.charCodeAt(i);
        const value = digit >= 48 && digit <= 57 ? digit - 48 : digit - 87;
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

// Find the optimal combination of passives for maximum work speed
function findOptimalPassiveCombination(availablePassives: {passive: PassiveSkill, count: number, sources: PalCardData[]}[]): PassiveSkill[] {
    // Take the top 4 work speed passives (Palworld allows max 4 passives)
    const bestPassives = availablePassives.slice(0, 4).map(entry => {
        // Ensure the passive has all required fields
        const passive = entry.passive;
        return {
            Id: passive.Id || '',
            Name: passive.Name || 'Unknown',
            Rating: passive.Rating || 0,
            Description: passive.Description || ''
        };
    });
    
    return bestPassives;
}

// Calculate the probability of getting specific passives from breeding
function calculatePassiveProbability(targetPassives: PassiveSkill[], parent1Passives: PassiveSkill[], parent2Passives: PassiveSkill[]): number {
    const allParentPassives = [...parent1Passives, ...parent2Passives];
    const uniqueParentPassives = allParentPassives.filter((passive, index, self) => 
        index === self.findIndex(p => p.Id === passive.Id)
    );
    
    const targetPassiveIds = new Set(targetPassives.map(p => p.Id));
    const availableTargetPassives = uniqueParentPassives.filter(p => targetPassiveIds.has(p.Id));
    
    if (availableTargetPassives.length < targetPassives.length) {
        return 0; // Impossible to get all target passives
    }
    
    const numTargetPassives = targetPassives.length;
    
    // Probability distribution: 40% for 1, 30% for 2, 20% for 3, 10% for 4
    const baseProbabilities = [0, 0.4, 0.3, 0.2, 0.1];
    
    if (numTargetPassives === 0) return baseProbabilities[1] + baseProbabilities[2] + baseProbabilities[3] + baseProbabilities[4];
    if (numTargetPassives > 4) return 0;
    
    // Calculate combination probability for getting exactly the target passives
    const totalUniquePassives = uniqueParentPassives.length;
    const combinations = (n: number, r: number): number => {
        if (r > n) return 0;
        if (r === 0 || r === n) return 1;
        let result = 1;
        for (let i = 0; i < r; i++) {
            result = result * (n - i) / (i + 1);
        }
        return result;
    };
    
    let probability = 0;
    
    // For each possible number of passives inherited (1-4)
    for (let numInherited = numTargetPassives; numInherited <= Math.min(4, totalUniquePassives); numInherited++) {
        const probOfGettingThisMany = baseProbabilities[numInherited];
        
        // Probability of getting our target passives among the inherited ones
        const waysToGetTargets = combinations(availableTargetPassives.length, numTargetPassives);
        const waysToFillRemaining = combinations(totalUniquePassives - availableTargetPassives.length, numInherited - numTargetPassives);
        const totalWays = combinations(totalUniquePassives, numInherited);
        
        const probOfGettingTargets = totalWays > 0 ? (waysToGetTargets * waysToFillRemaining) / totalWays : 0;
        
        probability += probOfGettingThisMany * probOfGettingTargets;
    }
    
    return probability;
}

// Find what parent combinations can produce the target character
function findParentsForTarget(targetCharacterId: string, allPals: PalCardData[]): {parent1: string, parent2: string}[] {
    const possibleParents: {parent1: string, parent2: string}[] = [];
    
    // Normalize target character ID for comparison (try both cases)
    const targetPalData = getPalData(targetCharacterId) || getPalData(targetCharacterId.charAt(0).toUpperCase() + targetCharacterId.slice(1).toLowerCase());
    if (!targetPalData) {
        console.log(`No pal data found for target: ${targetCharacterId}`);
        return possibleParents;
    }
    
    // Check all pal combinations in the database to see what can produce our target
    for (const [_, palData] of Object.entries(palDatabase)) {
        for (const combination of palData.Combinations) {
            // Case-insensitive comparison
            if (combination.ChildCharacterID.toLowerCase() === targetCharacterId.toLowerCase()) {
                const parent1 = combination.ParentTribeA;
                const parent2 = combination.ParentTribeB;
                
                // Allow all valid parent combinations, including same-species breeding
                possibleParents.push({
                    parent1: parent1,
                    parent2: parent2
                });
            }
        }
    }
    
    // Also check CombiRank method - find pals that when bred together produce target rank
    const targetRank = targetPalData.CombiRank;
    for (const [_, palData1] of Object.entries(palDatabase)) {
        for (const [_, palData2] of Object.entries(palDatabase)) {
            const predictedRank = Math.floor((palData1.CombiRank + palData2.CombiRank + 1) / 2);
            if (predictedRank === targetRank) {
                const char1 = palData1.Tribe.replace("EPalTribeID::", "");
                const char2 = palData2.Tribe.replace("EPalTribeID::", "");
                
                // Allow all combinations except identical pairs (same individual, not same species)
                if (char1 !== char2) {
                    possibleParents.push({parent1: char1, parent2: char2});
                }
            }
        }
    }
    
    // Add explicit same-species breeding if target species exists in owned pals
    const normalizedTarget = targetCharacterId.toLowerCase();
    const targetSpeciesOwned = allPals.filter(pal => 
        pal.characterId && pal.characterId.toLowerCase() === normalizedTarget
    );
    
    if (targetSpeciesOwned.length >= 2) {
        // Add same-species breeding as a possibility
        const targetSpeciesId = targetSpeciesOwned[0].characterId; // Use the actual case from owned pal
        possibleParents.push({
            parent1: targetSpeciesId,
            parent2: targetSpeciesId
        });
        console.log(`Added same-species breeding: ${targetSpeciesId} + ${targetSpeciesId} = ${targetSpeciesId}`);
    }
    
    // Remove duplicates
    const uniqueParents = possibleParents.filter((parent, index, self) => 
        index === self.findIndex(p => 
            (p.parent1 === parent.parent1 && p.parent2 === parent.parent2) ||
            (p.parent1 === parent.parent2 && p.parent2 === parent.parent1)
        )
    );
    
    console.log(`Found ${uniqueParents.length} unique parent combinations for ${targetCharacterId}:`, uniqueParents);
    return uniqueParents;
}

// Find pals that have the desired passives and can be used as breeding sources
function findPalsWithPassives(pals: PalCardData[], desiredPassives: PassiveSkill[]): Map<string, PalCardData[]> {
    const passiveSourceMap = new Map<string, PalCardData[]>();
    
    // Initialize map for each desired passive
    for (const passive of desiredPassives) {
        passiveSourceMap.set(passive.Id, []);
    }
    
    // Find pals that have each desired passive
    for (const pal of pals) {
        if (!pal.passiveSkills) continue;
        
        for (const passive of pal.passiveSkills) {
            if (passiveSourceMap.has(passive.Id)) {
                passiveSourceMap.get(passive.Id)!.push(pal);
            }
        }
    }
    
    return passiveSourceMap;
}

// Find the best pair of same-species pals for breeding with complementary passives
function findBestSameSpeciesBreeding(
    targetSpecies: string, 
    pals: PalCardData[], 
    desiredPassives: PassiveSkill[]
): { parent1: PalCardData, parent2: PalCardData } | null {
    // Get all pals of the target species
    const speciesPals = pals.filter(pal => 
        pal.characterId && pal.characterId.toLowerCase() === targetSpecies.toLowerCase()
    );
    
    if (speciesPals.length < 2) {
        console.log(`Not enough ${targetSpecies} for same-species breeding (found ${speciesPals.length})`);
        return null;
    }
    
    console.log(`Found ${speciesPals.length} ${targetSpecies} for same-species breeding`);
    
    // Find the best pair with complementary desired passives
    let bestPair: { parent1: PalCardData, parent2: PalCardData } | null = null;
    let bestScore = 0;
    
    for (let i = 0; i < speciesPals.length; i++) {
        for (let j = i + 1; j < speciesPals.length; j++) {
            const pal1 = speciesPals[i];
            const pal2 = speciesPals[j];
            
            // Calculate combined unique passives
            const pal1Passives = pal1.passiveSkills || [];
            const pal2Passives = pal2.passiveSkills || [];
            const combinedPassives = [...pal1Passives, ...pal2Passives];
            const uniquePassives = combinedPassives.filter((passive, index, self) => 
                index === self.findIndex(p => p.Id === passive.Id)
            );
            
            // Count desired passives available
            const availableDesiredPassives = uniquePassives.filter(passive =>
                desiredPassives.some(desired => desired.Id === passive.Id)
            );
            
            // Calculate breeding probability
            const probability = calculatePassiveProbability(availableDesiredPassives, pal1Passives, pal2Passives);
            
            // Score: (available desired passives) * probability
            const score = availableDesiredPassives.length * probability;
            
            if (score > bestScore) {
                bestScore = score;
                bestPair = { parent1: pal1, parent2: pal2 };
            }
        }
    }
    
    if (bestPair) {
        const parent1Passives = bestPair.parent1.passiveSkills?.map(p => p.Name).join(', ') || 'none';
        const parent2Passives = bestPair.parent2.passiveSkills?.map(p => p.Name).join(', ') || 'none';
        console.log(`Best ${targetSpecies} pair: [${parent1Passives}] + [${parent2Passives}], score: ${bestScore}`);
    }
    
    return bestPair;
}

// Find breeding route to get optimal passives into the target character
function findBreedingRouteForTarget(
    targetCharacterId: string,
    pals: PalCardData[],
    optimalPassives: PassiveSkill[],
    maxDepth: number = 3
): BreedingPair[] {
    console.log(`Finding route to get passives ${optimalPassives.map(p => p.Name).join(', ')} into ${targetCharacterId}`);
    
    // Step 1: Find pals that have the optimal passives we want
    const passiveSourceMap = new Map<string, PalCardData[]>();
    for (const passive of optimalPassives) {
        passiveSourceMap.set(passive.Id, []);
    }
    
    for (const pal of pals) {
        if (!pal.passiveSkills) continue;
        for (const passive of pal.passiveSkills) {
            if (passiveSourceMap.has(passive.Id)) {
                passiveSourceMap.get(passive.Id)!.push(pal);
            }
        }
    }
    
    console.log('Passive sources found:');
    for (const [passiveId, sources] of passiveSourceMap) {
        const passiveName = optimalPassives.find(p => p.Id === passiveId)?.Name || passiveId;
        console.log(`  ${passiveName}: ${sources.length} sources`);
    }
    
    // Step 2: Find what parent combinations can breed the target
    const possibleParentCombinations = findParentsForTarget(targetCharacterId, pals);
    console.log(`Found ${possibleParentCombinations.length} ways to breed ${targetCharacterId}`);
    
    if (possibleParentCombinations.length === 0) {
        console.log('No breeding combinations found for target character');
        return [];
    }
    
    // Step 3: Try to get the optimal passives into the required parent types
    const route: BreedingPair[] = [];
    let bestFinalStep: BreedingPair | null = null;
    let bestScore = 0;
    
    for (const parentCombo of possibleParentCombinations) {
        const { parent1: parent1Type, parent2: parent2Type } = parentCombo;
        console.log(`Trying to get optimal passives into ${parent1Type} and ${parent2Type}`);
        
        // Allow all parent combinations, including same-species breeding
        
        // Handle same-species breeding specially
        if (parent1Type.toLowerCase() === parent2Type.toLowerCase()) {
            // Same species breeding - find two different individuals with complementary passives
            const sameSpeciesResult = findBestSameSpeciesBreeding(parent1Type, pals, optimalPassives);
            if (sameSpeciesResult) {
                const parent1WithPassives = { pal: sameSpeciesResult.parent1, steps: [] };
                const parent2WithPassives = { pal: sameSpeciesResult.parent2, steps: [] };
                
                // Calculate the combined passive pool
                const parent1Passives = parent1WithPassives.pal.passiveSkills || [];
                const parent2Passives = parent2WithPassives.pal.passiveSkills || [];
                const combinedPassives = [...parent1Passives, ...parent2Passives];
                const uniquePassives = combinedPassives.filter((passive, index, self) => 
                    index === self.findIndex(p => p.Id === passive.Id)
                );
                
                const availableOptimalPassives = uniquePassives.filter(passive =>
                    optimalPassives.some(optimal => optimal.Id === passive.Id)
                );
                
                const probability = calculatePassiveProbability(availableOptimalPassives, parent1Passives, parent2Passives);
                const score = availableOptimalPassives.length * probability;
                
                if (score > bestScore) {
                    bestScore = score;
                    
                    const finalStep: BreedingPair = {
                        parent1: parent1WithPassives.pal,
                        parent2: parent2WithPassives.pal,
                        resultCharacterId: targetCharacterId,
                        generation: 1, // Direct breeding
                        expectedPassives: availableOptimalPassives.map(passive => ({
                            Id: passive.Id || '',
                            Name: passive.Name || 'Unknown',
                            Rating: passive.Rating || 0,
                            Description: passive.Description || ''
                        })),
                        passiveProbability: probability,
                        workSpeedScore: GetPalStats(targetCharacterId, 100, 100, 100, availableOptimalPassives, 30, 10).craftSpeed
                    };
                    
                    bestFinalStep = finalStep;
                    route.length = 0; // Clear previous route
                    route.push(finalStep);
                }
                continue;
            }
        }
        
        // Regular cross-species breeding or fallback
        const parent1WithPassives = findOrBreedPalWithPassives(parent1Type, pals, optimalPassives, maxDepth - 1);
        const parent2WithPassives = findOrBreedPalWithPassives(parent2Type, pals, optimalPassives, maxDepth - 1);
        
        if (!parent1WithPassives.pal || !parent2WithPassives.pal) {
            continue;
        }
        
        // Calculate the final breeding step
        const parent1Passives = parent1WithPassives.pal.passiveSkills || [];
        const parent2Passives = parent2WithPassives.pal.passiveSkills || [];
        const combinedPassives = [...parent1Passives, ...parent2Passives];
        const uniquePassives = combinedPassives.filter((passive, index, self) => 
            index === self.findIndex(p => p.Id === passive.Id)
        );
        
        const availableOptimalPassives = uniquePassives.filter(passive =>
            optimalPassives.some(optimal => optimal.Id === passive.Id)
        );
        
        const probability = calculatePassiveProbability(availableOptimalPassives, parent1Passives, parent2Passives);
        const score = availableOptimalPassives.length * probability;
        
        if (score > bestScore) {
            bestScore = score;
            
            const finalStep: BreedingPair = {
                parent1: parent1WithPassives.pal,
                parent2: parent2WithPassives.pal,
                resultCharacterId: targetCharacterId,
                generation: Math.max(parent1WithPassives.steps.length, parent2WithPassives.steps.length) + 1,
                expectedPassives: availableOptimalPassives.map(passive => ({
                    Id: passive.Id || '',
                    Name: passive.Name || 'Unknown',
                    Rating: passive.Rating || 0,
                    Description: passive.Description || ''
                })),
                passiveProbability: probability,
                workSpeedScore: GetPalStats(targetCharacterId, 100, 100, 100, availableOptimalPassives, 30, 10).craftSpeed
            };
            
            bestFinalStep = finalStep;
            // Build the complete route
            route.length = 0; // Clear previous route
            route.push(...parent1WithPassives.steps);
            route.push(...parent2WithPassives.steps);
            route.push(finalStep);
        }
    }
    
    console.log(`Final breeding route has ${route.length} steps`);
    return route;
}

// Find or breed a specific pal type with desired passives
function findOrBreedPalWithPassives(
    targetType: string,
    pals: PalCardData[],
    desiredPassives: PassiveSkill[],
    maxDepth: number
): { pal: PalCardData | null, steps: BreedingPair[] } {
    
    // First, check if we already own this pal type with some of the desired passives
    const ownedPalsOfType = pals.filter(pal => pal.characterId === targetType);
    let bestOwnedPal: PalCardData | null = null;
    let bestOwnedScore = 0;
    
    for (const pal of ownedPalsOfType) {
        const palPassives = pal.passiveSkills || [];
        const matchingPassives = palPassives.filter(passive =>
            desiredPassives.some(desired => desired.Id === passive.Id)
        );
        const score = matchingPassives.length;
        
        if (score > bestOwnedScore) {
            bestOwnedScore = score;
            bestOwnedPal = pal;
        }
    }
    
    // If we have a decent pal already, or we've hit max depth, use what we have
    if (bestOwnedPal && (bestOwnedScore >= desiredPassives.length * 0.5 || maxDepth <= 0)) {
        return { pal: bestOwnedPal, steps: [] };
    }
    
    // Otherwise, try to breed this pal type with better passives
    if (maxDepth <= 0) {
        return { pal: bestOwnedPal, steps: [] };
    }
    
    const parentCombinations = findParentsForTarget(targetType, pals);
    
    for (const combo of parentCombinations) {
        const type1Pals = pals.filter(pal => pal.characterId === combo.parent1);
        const type2Pals = pals.filter(pal => pal.characterId === combo.parent2);
        
        if (type1Pals.length === 0 || type2Pals.length === 0) continue;
        
        // Find the best parent combination for getting desired passives
        let bestParent1: PalCardData | null = null;
        let bestParent2: PalCardData | null = null;
        let bestCombinedScore = 0;
        
        for (const parent1 of type1Pals) {
            for (const parent2 of type2Pals) {
                const combinedPassives = [...(parent1.passiveSkills || []), ...(parent2.passiveSkills || [])];
                const uniquePassives = combinedPassives.filter((passive, index, self) => 
                    index === self.findIndex(p => p.Id === passive.Id)
                );
                const matchingCount = uniquePassives.filter(passive =>
                    desiredPassives.some(desired => desired.Id === passive.Id)
                ).length;
                
                if (matchingCount > bestCombinedScore) {
                    bestCombinedScore = matchingCount;
                    bestParent1 = parent1;
                    bestParent2 = parent2;
                }
            }
        }
        
        if (bestParent1 && bestParent2 && bestCombinedScore > bestOwnedScore) {
            const breedingStep: BreedingPair = {
                parent1: bestParent1,
                parent2: bestParent2,
                resultCharacterId: targetType,
                generation: 1,
                expectedPassives: desiredPassives.filter(desired =>
                    [...(bestParent1.passiveSkills || []), ...(bestParent2.passiveSkills || [])].some(passive => passive.Id === desired.Id)
                ).map(passive => ({
                    Id: passive.Id || '',
                    Name: passive.Name || 'Unknown',
                    Rating: passive.Rating || 0,
                    Description: passive.Description || ''
                })),
                passiveProbability: calculatePassiveProbability(
                    desiredPassives.filter(desired =>
                        [...(bestParent1.passiveSkills || []), ...(bestParent2.passiveSkills || [])].some(passive => passive.Id === desired.Id)
                    ), 
                    bestParent1.passiveSkills || [], 
                    bestParent2.passiveSkills || []
                ),
                workSpeedScore: 0
            };
            
            // Create virtual result pal
            const resultPal: PalCardData = {
                id: 'bred-' + targetType,
                instanceId: 'bred',
                name: 'Bred ' + targetType,
                characterId: targetType,
                passiveSkills: breedingStep.expectedPassives,
                level: 30,
                talentHP: Math.max(bestParent1.talentHP || 0, bestParent2.talentHP || 0),
                talentShot: Math.max(bestParent1.talentShot || 0, bestParent2.talentShot || 0),
                talentDefense: Math.max(bestParent1.talentDefense || 0, bestParent2.talentDefense || 0)
            };
            
            return { pal: resultPal, steps: [breedingStep] };
        }
    }
    
    return { pal: bestOwnedPal, steps: [] };
}


// Main method to get the best work speed route
function getBestWorkSpeedRoute(
    characterId: string,
    playerId: string,
    worldId: string,
    pals: PalCardData[],
    maxDepth: number = 3
): WorkSpeedRoute {
    console.log(`Starting WorkSpeed route calculation for ${characterId}`);
    console.log(`Player has ${pals.length} pals`);
    
    const availablePassives = collectAvailableWorkSpeedPassives(pals);
    console.log(`Found ${availablePassives.length} available work speed passives:`, availablePassives.map(p => `${p.passive.Name} (${p.count} sources)`));
    
    const optimalPassives = findOptimalPassiveCombination(availablePassives);
    console.log(`Optimal passives selected:`, optimalPassives.map(p => p.Name));
    
    const breedingSteps = findBreedingRouteForTarget(characterId, pals, optimalPassives, maxDepth);
    
    const finalWorkSpeed = GetPalStats(characterId, 100, 100, 100, optimalPassives, 30, 10).craftSpeed;
    
    return {
        targetCharacterId: characterId,
        finalWorkSpeed: finalWorkSpeed,
        breedingSteps: breedingSteps,
        totalGenerations: breedingSteps.length,
        requiredPassives: optimalPassives
    };
}

export const GET: RequestHandler = async ({ params, locals, url }) => {
    try {
        const { id, player_instance_id } = params;
        const targetCharacterId = url.searchParams.get('characterId');
        const maxDepthParam = url.searchParams.get('maxDepth');
        const maxDepth = maxDepthParam ? parseInt(maxDepthParam) : 3;
        const saveWatcher = locals.saveWatcher;

        if (!saveWatcher) {
            return json({ error: 'Save file watcher not available' }, { status: 503 });
        }

        if (!targetCharacterId) {
            return json({ error: 'characterId parameter is required' }, { status: 400 });
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

        const pals = getPlayerPals(pWorld, pSave, serverSave);
        const validPals = pals.filter(pal => pal.characterId !== null);

        const route = getBestWorkSpeedRoute(targetCharacterId, playerId, id, validPals, maxDepth);

        return json(route);

    } catch (err) {
        console.error(`Error getting breeding route for ${params.id}:`, err);
        return error(500, 'Failed to calculate breeding route');
    }
};
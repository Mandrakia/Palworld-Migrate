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

// Generate all combinations of given size from available passives
function generateCombinations(availablePassives: {passive: PassiveSkill, count: number, sources: PalCardData[]}[], size: number): PassiveSkill[][] {
    const combinations: PassiveSkill[][] = [];
    
    function backtrack(start: number, currentCombination: PassiveSkill[]) {
        if (currentCombination.length === size) {
            combinations.push([...currentCombination]);
            return;
        }
        
        for (let i = start; i < availablePassives.length; i++) {
            const passive = {
                Id: availablePassives[i].passive.Id || '',
                Name: availablePassives[i].passive.Name || 'Unknown',
                Rating: availablePassives[i].passive.Rating || 0,
                Description: availablePassives[i].passive.Description || ''
            };
            currentCombination.push(passive);
            backtrack(i + 1, currentCombination);
            currentCombination.pop();
        }
    }
    
    backtrack(0, []);
    return combinations;
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

// Comprehensive breeding route explorer that finds all possible paths
function findExhaustiveBreedingRoutes(
    targetCharacterId: string,
    pals: PalCardData[],
    optimalPassives: PassiveSkill[],
    maxDepth: number = 5
): BreedingPair[][] {
    console.log(`Starting exhaustive search for ${targetCharacterId} with ${optimalPassives.length} optimal passives`);
    
    const allRoutes: BreedingPair[][] = [];
    const visitedStates = new Set<string>();
    
    // Find all possible parent combinations for target
    const parentCombinations = findParentsForTarget(targetCharacterId, pals);
    
    // Recursively explore all possible breeding paths
    function exploreBreedingPath(
        currentTarget: string,
        currentPals: PalCardData[],
        desiredPassives: PassiveSkill[],
        currentRoute: BreedingPair[],
        depth: number
    ): void {
        if (depth > maxDepth) return;
        
        // Create state key to avoid infinite loops
        const stateKey = `${currentTarget}-${desiredPassives.map(p => p.Id).sort().join(',')}-${depth}`;
        if (visitedStates.has(stateKey)) return;
        visitedStates.add(stateKey);
        
        // Find parent combinations for current target
        const targetParentCombos = findParentsForTarget(currentTarget, currentPals);
        
        for (const parentCombo of targetParentCombos) {
            const { parent1: parent1Type, parent2: parent2Type } = parentCombo;
            
            // Try all possible parent pairs of these types
            const parent1Candidates = currentPals.filter(p => 
                p.characterId && p.characterId.toLowerCase() === parent1Type.toLowerCase()
            );
            const parent2Candidates = currentPals.filter(p => 
                p.characterId && p.characterId.toLowerCase() === parent2Type.toLowerCase()
            );
            
            // Also try breeding to create better parents
            if (depth < maxDepth) {
                // Recursively try to breed better parent1
                exploreBreedingPath(parent1Type, currentPals, desiredPassives, currentRoute, depth + 1);
                // Recursively try to breed better parent2  
                exploreBreedingPath(parent2Type, currentPals, desiredPassives, currentRoute, depth + 1);
            }
            
            // Try all combinations of existing parent candidates
            for (const parent1 of parent1Candidates) {
                for (const parent2 of parent2Candidates) {
                    // Skip identical individuals (but allow same species)
                    if (parent1.id === parent2.id) continue;
                    
                    const parent1Passives = parent1.passiveSkills || [];
                    const parent2Passives = parent2.passiveSkills || [];
                    const combinedPassives = [...parent1Passives, ...parent2Passives];
                    const uniquePassives = combinedPassives.filter((passive, index, self) => 
                        index === self.findIndex(p => p.Id === passive.Id)
                    );
                    
                    const availableDesiredPassives = uniquePassives.filter(passive =>
                        desiredPassives.some(desired => desired.Id === passive.Id)
                    );
                    
                    if (availableDesiredPassives.length > 0) {
                        const probability = calculatePassiveProbability(availableDesiredPassives, parent1Passives, parent2Passives);
                        
                        const breedingStep: BreedingPair = {
                            parent1,
                            parent2,
                            resultCharacterId: currentTarget,
                            generation: depth,
                            expectedPassives: availableDesiredPassives.map(passive => ({
                                Id: passive.Id || '',
                                Name: passive.Name || 'Unknown',
                                Rating: passive.Rating || 0,
                                Description: passive.Description || ''
                            })),
                            passiveProbability: probability,
                            workSpeedScore: GetPalStats(currentTarget, 100, 100, 100, availableDesiredPassives, 30, 10).craftSpeed
                        };
                        
                        const newRoute = [...currentRoute, breedingStep];
                        allRoutes.push(newRoute);
                    }
                }
            }
        }
    }
    
    // Start the exhaustive exploration
    exploreBreedingPath(targetCharacterId, pals, optimalPassives, [], 1);
    
    console.log(`Found ${allRoutes.length} total breeding routes`);
    return allRoutes;
}

// Simple 2-step breeding: 1) Breed pals with different optimal passives together, 2) Breed result to target
function findBreedingRouteForTarget(
    targetCharacterId: string,
    pals: PalCardData[],
    optimalPassives: PassiveSkill[],
    maxDepth: number = 3
): BreedingPair[] {
    console.log(`Step 1: Find pals with different optimal passives and breed them together`);
    console.log(`Step 2: Breed the result to get ${targetCharacterId}`);
    
    const route: BreedingPair[] = [];
    
    // Step 1: Find two pals with different optimal passives and breed them
    const combinationStep = combineOptimalPassives(pals, optimalPassives);
    if (!combinationStep) {
        console.log('Cannot combine optimal passives - no compatible pals found');
        return [];
    }
    
    route.push(combinationStep);
    console.log(`Step 1: Breed ${combinationStep.parent1.name || combinationStep.parent1.characterId} + ${combinationStep.parent2.name || combinationStep.parent2.characterId} → ${combinationStep.resultCharacterId} with ${combinationStep.expectedPassives?.map(p => p.Name).join(', ')}`);
    
    // Step 2: Create virtual result pal from step 1
    const combinedPal: PalCardData = {
        id: `bred-${combinationStep.resultCharacterId}`,
        instanceId: 'bred',
        name: `Bred ${combinationStep.resultCharacterId}`,
        characterId: combinationStep.resultCharacterId,
        passiveSkills: combinationStep.expectedPassives || [],
        level: 30,
        talentHP: 100,
        talentShot: 100,
        talentDefense: 100
    };
    
    // Step 3: Breed combined pal to target character
    const targetStep = breedToTargetCharacter(targetCharacterId, combinedPal, pals);
    if (targetStep) {
        route.push(targetStep);
        console.log(`Step 2: Breed ${combinedPal.characterId} → ${targetCharacterId} with ${targetStep.expectedPassives?.map(p => p.Name).join(', ')}`);
    } else {
        console.log(`Cannot breed ${combinedPal.characterId} to ${targetCharacterId}`);
    }
    
    console.log(`Final route has ${route.length} steps`);
    return route;
}

// Breed pals with different optimal passives - DON'T CARE WHAT INTERMEDIATE PAL WE GET
function combineOptimalPassives(pals: PalCardData[], optimalPassives: PassiveSkill[]): BreedingPair | null {
    console.log(`Breeding pals with optimal passives together - don't care what intermediate we get`);
    
    // Find all pals that have ANY optimal passive
    const palsWithOptimalPassives: PalCardData[] = [];
    
    for (const pal of pals) {
        if (!pal.passiveSkills) continue;
        
        const hasOptimalPassive = pal.passiveSkills.some(passive =>
            optimalPassives.some(optimal => optimal.Id === passive.Id)
        );
        
        if (hasOptimalPassive) {
            palsWithOptimalPassives.push(pal);
        }
    }
    
    console.log(`Found ${palsWithOptimalPassives.length} pals with optimal passives`);
    
    // Try breeding any two of them together
    let bestPair: { parent1: PalCardData, parent2: PalCardData } | null = null;
    let bestPassiveCount = 0;
    let bestResult: string | null = null;
    
    for (let i = 0; i < palsWithOptimalPassives.length; i++) {
        for (let j = i + 1; j < palsWithOptimalPassives.length; j++) {
            const pal1 = palsWithOptimalPassives[i];
            const pal2 = palsWithOptimalPassives[j];
            
            // What would breeding these two produce? DON'T CARE WHAT IT IS
            const breedingResult = getBreedingResult(pal1, pal2);
            if (!breedingResult) continue;
            
            // Count combined optimal passives
            const combinedPassives = [...(pal1.passiveSkills || []), ...(pal2.passiveSkills || [])];
            const uniquePassives = combinedPassives.filter((passive, index, self) => 
                index === self.findIndex(p => p.Id === passive.Id)
            );
            
            const optimalPassivesAvailable = uniquePassives.filter(passive =>
                optimalPassives.some(optimal => optimal.Id === passive.Id)
            );
            
            if (optimalPassivesAvailable.length > bestPassiveCount) {
                bestPassiveCount = optimalPassivesAvailable.length;
                bestPair = { parent1: pal1, parent2: pal2 };
                bestResult = breedingResult;
            }
        }
    }
    
    if (!bestPair || !bestResult) {
        console.log('No valid breeding combination found');
        return null;
    }
    
    const parent1Passives = bestPair.parent1.passiveSkills || [];
    const parent2Passives = bestPair.parent2.passiveSkills || [];
    const combinedPassives = [...parent1Passives, ...parent2Passives];
    const uniquePassives = combinedPassives.filter((passive, index, self) => 
        index === self.findIndex(p => p.Id === passive.Id)
    );
    
    const expectedPassives = uniquePassives.filter(passive =>
        optimalPassives.some(optimal => optimal.Id === passive.Id)
    ).map(passive => ({
        Id: passive.Id || '',
        Name: passive.Name || 'Unknown',
        Rating: passive.Rating || 0,
        Description: passive.Description || ''
    }));
    
    console.log(`BREED: ${bestPair.parent1.name || bestPair.parent1.characterId} + ${bestPair.parent2.name || bestPair.parent2.characterId} = ${bestResult} (INTERMEDIATE, DON'T CARE) with passives: ${expectedPassives.map(p => p.Name).join(', ')}`);
    
    return {
        parent1: bestPair.parent1,
        parent2: bestPair.parent2,
        resultCharacterId: bestResult,
        generation: 1,
        expectedPassives,
        passiveProbability: calculatePassiveProbability(expectedPassives, parent1Passives, parent2Passives),
        workSpeedScore: GetPalStats(bestResult, 100, 100, 100, expectedPassives, 30, 10).craftSpeed
    };
}

// Find the best intermediate species that can hold all optimal passives
function findBestIntermediateSpecies(pals: PalCardData[], optimalPassives: PassiveSkill[]): string | null {
    const speciesScores = new Map<string, number>();
    
    // Score each species by how many optimal passives it can access
    for (const pal of pals) {
        if (!pal.characterId) continue;
        
        const matchingPassives = (pal.passiveSkills || []).filter(passive =>
            optimalPassives.some(optimal => optimal.Id === passive.Id)
        );
        
        const currentScore = speciesScores.get(pal.characterId) || 0;
        speciesScores.set(pal.characterId, Math.max(currentScore, matchingPassives.length));
    }
    
    // Find species with highest score
    let bestSpecies: string | null = null;
    let bestScore = 0;
    
    for (const [species, score] of speciesScores) {
        if (score > bestScore) {
            bestScore = score;
            bestSpecies = species;
        }
    }
    
    return bestSpecies;
}

// Create a pal of given species with optimal passives
function createPalWithOptimalPassives(species: string, pals: PalCardData[], optimalPassives: PassiveSkill[]): BreedingPair | null {
    const speciesPals = pals.filter(p => p.characterId?.toLowerCase() === species.toLowerCase());
    
    if (speciesPals.length < 2) return null;
    
    let bestPair: { parent1: PalCardData, parent2: PalCardData } | null = null;
    let bestPassiveCount = 0;
    
    // Try all pairs of this species
    for (let i = 0; i < speciesPals.length; i++) {
        for (let j = i + 1; j < speciesPals.length; j++) {
            const parent1 = speciesPals[i];
            const parent2 = speciesPals[j];
            
            const combinedPassives = [...(parent1.passiveSkills || []), ...(parent2.passiveSkills || [])];
            const uniquePassives = combinedPassives.filter((passive, index, self) => 
                index === self.findIndex(p => p.Id === passive.Id)
            );
            
            const optimalPassivesAvailable = uniquePassives.filter(passive =>
                optimalPassives.some(optimal => optimal.Id === passive.Id)
            );
            
            if (optimalPassivesAvailable.length > bestPassiveCount) {
                bestPassiveCount = optimalPassivesAvailable.length;
                bestPair = { parent1, parent2 };
            }
        }
    }
    
    if (!bestPair) return null;
    
    const parent1Passives = bestPair.parent1.passiveSkills || [];
    const parent2Passives = bestPair.parent2.passiveSkills || [];
    const combinedPassives = [...parent1Passives, ...parent2Passives];
    const uniquePassives = combinedPassives.filter((passive, index, self) => 
        index === self.findIndex(p => p.Id === passive.Id)
    );
    
    const expectedPassives = uniquePassives.filter(passive =>
        optimalPassives.some(optimal => optimal.Id === passive.Id)
    ).map(passive => ({
        Id: passive.Id || '',
        Name: passive.Name || 'Unknown',
        Rating: passive.Rating || 0,
        Description: passive.Description || ''
    }));
    
    return {
        parent1: bestPair.parent1,
        parent2: bestPair.parent2,
        resultCharacterId: species,
        generation: 1,
        expectedPassives,
        passiveProbability: calculatePassiveProbability(expectedPassives, parent1Passives, parent2Passives),
        workSpeedScore: GetPalStats(species, 100, 100, 100, expectedPassives, 30, 10).craftSpeed
    };
}

// Find ANY route from intermediate pal to target character - BRUTE FORCE ALL POSSIBILITIES
function breedToTargetCharacter(targetCharacterId: string, intermediatePal: PalCardData, pals: PalCardData[]): BreedingPair | null {
    console.log(`Finding ANY route from ${intermediatePal.characterId} to ${targetCharacterId}`);
    
    // Try breeding intermediate pal with EVERY other pal to see if we get target
    for (const otherPal of pals) {
        if (otherPal.id === intermediatePal.id) continue;
        
        const breedingResult1 = getBreedingResult(intermediatePal, otherPal);
        if (breedingResult1?.toLowerCase() === targetCharacterId.toLowerCase()) {
            console.log(`FOUND ROUTE: ${intermediatePal.characterId} + ${otherPal.characterId} = ${targetCharacterId}`);
            
            const combinedPassives = [...(intermediatePal.passiveSkills || []), ...(otherPal.passiveSkills || [])];
            const uniquePassives = combinedPassives.filter((passive, index, self) => 
                index === self.findIndex(p => p.Id === passive.Id)
            );
            
            return {
                parent1: intermediatePal,
                parent2: otherPal,
                resultCharacterId: targetCharacterId,
                generation: 2,
                expectedPassives: uniquePassives.map(p => ({
                    Id: p.Id || '',
                    Name: p.Name || 'Unknown',
                    Rating: p.Rating || 0,
                    Description: p.Description || ''
                })),
                passiveProbability: calculatePassiveProbability(uniquePassives, intermediatePal.passiveSkills || [], otherPal.passiveSkills || []),
                workSpeedScore: GetPalStats(targetCharacterId, 100, 100, 100, uniquePassives, 30, 10).craftSpeed
            };
        }
    }
    
    console.log(`No direct route found from ${intermediatePal.characterId} to ${targetCharacterId}`);
    return null;
}

// Enhance a route by adding intermediate breeding steps to consolidate more passives
function enhanceRouteWithIntermediateSteps(
    baseRoute: BreedingPair[],
    pals: PalCardData[],
    optimalPassives: PassiveSkill[],
    maxDepth: number
): BreedingPair[] {
    const finalStep = baseRoute[baseRoute.length - 1];
    const currentPassives = finalStep.expectedPassives || [];
    const missingPassives = optimalPassives.filter(optimal => 
        !currentPassives.some(current => current.Id === optimal.Id)
    );
    
    if (missingPassives.length === 0) {
        return baseRoute; // Already optimal
    }
    
    console.log(`Trying to enhance route to include missing passives: ${missingPassives.map(p => p.Name).join(', ')}`);
    
    // Try to breed intermediate parents that have the missing passives
    const enhancedRoute = [...baseRoute];
    
    // Look for ways to get missing passives into the parent types
    const parentType1 = finalStep.parent1.characterId!;
    const parentType2 = finalStep.parent2.characterId!;
    
    // Try to breed better parent1 with missing passives
    const betterParent1 = findOrCreatePalWithPassives(parentType1, pals, [...currentPassives, ...missingPassives], maxDepth - baseRoute.length);
    if (betterParent1.steps.length > 0) {
        enhancedRoute.splice(-1, 0, ...betterParent1.steps); // Insert before final step
        finalStep.parent1 = betterParent1.pal!;
    }
    
    // Try to breed better parent2 with missing passives
    const betterParent2 = findOrCreatePalWithPassives(parentType2, pals, [...currentPassives, ...missingPassives], maxDepth - enhancedRoute.length);
    if (betterParent2.steps.length > 0) {
        enhancedRoute.splice(-1, 0, ...betterParent2.steps); // Insert before final step
        finalStep.parent2 = betterParent2.pal!;
    }
    
    // Recalculate final step with potentially better parents
    if (betterParent1.pal || betterParent2.pal) {
        const parent1Passives = finalStep.parent1.passiveSkills || [];
        const parent2Passives = finalStep.parent2.passiveSkills || [];
        const combinedPassives = [...parent1Passives, ...parent2Passives];
        const uniquePassives = combinedPassives.filter((passive, index, self) => 
            index === self.findIndex(p => p.Id === passive.Id)
        );
        
        const availableOptimalPassives = uniquePassives.filter(passive =>
            optimalPassives.some(optimal => optimal.Id === passive.Id)
        );
        
        finalStep.expectedPassives = availableOptimalPassives.map(passive => ({
            Id: passive.Id || '',
            Name: passive.Name || 'Unknown',
            Rating: passive.Rating || 0,
            Description: passive.Description || ''
        }));
        finalStep.passiveProbability = calculatePassiveProbability(availableOptimalPassives, parent1Passives, parent2Passives);
        finalStep.workSpeedScore = GetPalStats(finalStep.resultCharacterId, 100, 100, 100, availableOptimalPassives, 30, 10).craftSpeed;
    }
    
    return enhancedRoute;
}

// Enhanced function to find or create a pal with specific passives
function findOrCreatePalWithPassives(
    targetType: string,
    pals: PalCardData[],
    desiredPassives: PassiveSkill[],
    maxDepth: number
): { pal: PalCardData | null, steps: BreedingPair[] } {
    if (maxDepth <= 0) {
        // Just return best existing pal of this type
        const existing = pals.filter(p => p.characterId?.toLowerCase() === targetType.toLowerCase());
        let bestPal: PalCardData | null = null;
        let bestScore = 0;
        
        for (const pal of existing) {
            const matchingPassives = (pal.passiveSkills || []).filter(passive =>
                desiredPassives.some(desired => desired.Id === passive.Id)
            );
            if (matchingPassives.length > bestScore) {
                bestScore = matchingPassives.length;
                bestPal = pal;
            }
        }
        
        return { pal: bestPal, steps: [] };
    }
    
    // Try to breed this type with the desired passives
    const parentCombinations = findParentsForTarget(targetType, pals);
    
    let bestResult: { pal: PalCardData | null, steps: BreedingPair[] } = { pal: null, steps: [] };
    let bestScore = 0;
    
    for (const combo of parentCombinations) {
        const parent1Candidates = pals.filter(p => p.characterId?.toLowerCase() === combo.parent1.toLowerCase());
        const parent2Candidates = pals.filter(p => p.characterId?.toLowerCase() === combo.parent2.toLowerCase());
        
        for (const parent1 of parent1Candidates) {
            for (const parent2 of parent2Candidates) {
                if (parent1.id === parent2.id) continue;
                
                const combinedPassives = [...(parent1.passiveSkills || []), ...(parent2.passiveSkills || [])];
                const uniquePassives = combinedPassives.filter((passive, index, self) => 
                    index === self.findIndex(p => p.Id === passive.Id)
                );
                
                const matchingPassives = uniquePassives.filter(passive =>
                    desiredPassives.some(desired => desired.Id === passive.Id)
                );
                
                if (matchingPassives.length > bestScore) {
                    bestScore = matchingPassives.length;
                    
                    const breedingStep: BreedingPair = {
                        parent1,
                        parent2,
                        resultCharacterId: targetType,
                        generation: maxDepth,
                        expectedPassives: matchingPassives.map(passive => ({
                            Id: passive.Id || '',
                            Name: passive.Name || 'Unknown',
                            Rating: passive.Rating || 0,
                            Description: passive.Description || ''
                        })),
                        passiveProbability: calculatePassiveProbability(matchingPassives, parent1.passiveSkills || [], parent2.passiveSkills || []),
                        workSpeedScore: GetPalStats(targetType, 100, 100, 100, matchingPassives, 30, 10).craftSpeed
                    };
                    
                    const resultPal: PalCardData = {
                        id: `bred-${targetType}-${Date.now()}`,
                        instanceId: 'bred',
                        name: `Bred ${targetType}`,
                        characterId: targetType,
                        passiveSkills: matchingPassives,
                        level: 30,
                        talentHP: Math.max(parent1.talentHP || 0, parent2.talentHP || 0),
                        talentShot: Math.max(parent1.talentShot || 0, parent2.talentShot || 0),
                        talentDefense: Math.max(parent1.talentDefense || 0, parent2.talentDefense || 0)
                    };
                    
                    bestResult = { pal: resultPal, steps: [breedingStep] };
                }
            }
        }
    }
    
    return bestResult;
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
    console.log(`Theoretical optimal passives:`, optimalPassives.map(p => p.Name));
    
    const breedingSteps = findBreedingRouteForTarget(characterId, pals, optimalPassives, Math.max(maxDepth, 5));
    
    // Calculate actual achievable results from the breeding steps
    let actualFinalPassives: PassiveSkill[] = [];
    let actualFinalWorkSpeed = 70; // Base work speed
    
    if (breedingSteps.length > 0) {
        // Get passives from the final breeding step
        const finalStep = breedingSteps[breedingSteps.length - 1];
        actualFinalPassives = finalStep.expectedPassives || [];
        actualFinalWorkSpeed = finalStep.workSpeedScore || 70;
        
        console.log(`Actual achievable passives:`, actualFinalPassives.map(p => p.Name));
        console.log(`Actual final work speed: ${actualFinalWorkSpeed}`);
    } else {
        // No breeding route found, check if we already own optimal version
        const ownedTarget = pals.find(pal => pal.characterId?.toLowerCase() === characterId.toLowerCase());
        if (ownedTarget && ownedTarget.passiveSkills) {
            const ownedWorkSpeedPassives = ownedTarget.passiveSkills.filter(passive => 
                optimalPassives.some(optimal => optimal.Id === passive.Id)
            );
            if (ownedWorkSpeedPassives.length > 0) {
                actualFinalPassives = ownedWorkSpeedPassives;
                actualFinalWorkSpeed = GetPalStats(characterId, 100, 100, 100, ownedWorkSpeedPassives, 30, 10).craftSpeed;
                console.log(`Already own target with passives:`, actualFinalPassives.map(p => p.Name));
            }
        }
    }
    
    return {
        targetCharacterId: characterId,
        finalWorkSpeed: Math.round(actualFinalWorkSpeed),
        breedingSteps: breedingSteps,
        totalGenerations: breedingSteps.length,
        requiredPassives: actualFinalPassives // Use actual achievable passives, not theoretical optimal
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
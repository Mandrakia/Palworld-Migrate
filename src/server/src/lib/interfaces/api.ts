import type { PalWithGenealogy } from "./pals";
import type { LocalizedPassiveSkill } from "./passive-skills";

export interface BreedingRouteResponse {
    error?: string;
    targetCharacterId: string;
    finalWorkSpeed: number;
    breedingSteps: BreedingStep[];
    totalGenerations: number;
    requiredPassives: LocalizedPassiveSkill[];
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
    passiveProbability?: number;
}

export interface BreedingResponse extends Record<string, {
            characterId: string;
            displayName: string;
            combinationCount: number;
            workSuitabilities: {
                emitFlame: number;
                watering: number;
                seeding: number;
                generateElectricity: number;
                handcraft: number;
                collection: number;
                deforest: number;
                mining: number;
                transport: number;
                monsterFarm: number;
                cool: number;
                productMedicine: number;
            };
            combatOptimization: {
                stats: { hp: number, attack: number, defense: number, craftSpeed: number };
                score: number;
                improvementPercentage: number;
                bestPassives: LocalizedPassiveSkill[];
                bestCombination: BreedingSource;
            };
            workOptimization: {
                stats: { hp: number, attack: number, defense: number, craftSpeed: number };
                score: number;
                bestPassives: LocalizedPassiveSkill[];
                bestCombination: BreedingSource;
            };
            allCombinations: BreedingSource[];
        }> {}
    
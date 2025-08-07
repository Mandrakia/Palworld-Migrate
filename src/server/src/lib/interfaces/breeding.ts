// Breeding related interfaces

import type { PalCardData } from './character';
import type {PassiveSkill} from "$lib/interfaces";

export interface BreedingSource {
	"Pal 1": PalCardData;
	"Pal 2": PalCardData;
}

export interface BreedingResult {
	characterId: string;
	palName: string;
	combinations: BreedingSource[];
	isOwned: boolean;
}

export interface Combination {
	ParentTribeA: string;
	ParentTribeB: string;
	ParentGenderA: string;
	ParentGenderB: string;
	ChildCharacterID: string;
}

export interface BreedingPair {
	parent1: PalCardData;
	parent2: PalCardData;
	resultCharacterId: string;
	generation: number;
	expectedPassives: PassiveSkill[];
	passiveProbability: number;
	workSpeedScore: number;
}

export interface WorkSpeedRoute {
	targetCharacterId: string;
	finalWorkSpeed: number;
	breedingSteps: BreedingPair[];
	totalGenerations: number;
	requiredPassives: PassiveSkill[];
}
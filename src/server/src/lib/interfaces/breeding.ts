// Breeding related interfaces

import type { PalCardData } from './character';

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
// Pal database related interfaces

import type { StringDesc, Buff } from './common';
import type { PalPassiveSkill } from './passive-skills';
import type { Combination } from './breeding';

export interface PalDatabaseEntry {
	InternalName: string;
	ZukanIndex: number;
	ZukanIndexSuffix: string;
	Tribe: string;
	Name: string;
	I18n: string;
	OverviewDescription: StringDesc;
	DetailedDescription: StringDesc;
	Genus: StringDesc;
	Size: string;
	Rarity: number;
	HP: number;
	MeleeAttack: number;
	ShotAttack: number;
	Defense: number;
	Support: number;
	CraftSpeed: number;
    Friendship_HP: number,
    Friendship_ShotAttack: number,
    Friendship_Defense: number,
    Friendship_CraftSpeed: number,
	Price: number;
	SlowWalkSpeed: number;
	RunSpeed: number;
	RideSprintSpeed: number;
	TransportSpeed: number;
	Affinity: number;
	WorkingAnimationSpeedRate: number;
	MiningEfficiency: number;
	Stamina: number;
	IsNocturnal: boolean;
	BiologicalGrade: number;
	Predator: boolean;
	EdibleItem: boolean;
	CaptureRateCorrect: number;
	ExperienceRatio: number;
	MaleProbability: number;
	CombiRank: number;
	GenusCategory: string;
	OrganizationCategory: string;
	SpawnerCategory: string;
	AIResponse: string;
	AISight: number;
	AIHearing: number;
	AIThinkInterval: number;
	AIActionInterval: number;
	Elements: string[];
	WorkSuitability: Record<string, number>;
	FoodAmount: number;
	IsPal: boolean;
	IsTower: boolean;
	IsRare: boolean;
	IsLucky: boolean;
	PassiveSkills: PalPassiveSkill[];
	Combinations: Combination[];
}

export type PalDatabase = Record<string, PalDatabaseEntry>;
// Character, player, and pal related interfaces

import type { StatPoint } from './common';
import type { PassiveSkill } from './passive-skills';

export interface BaseCharacterCardData {
	id: string;
	instanceId: string;
	name: string;
	level: number;
	stats: StatPoint[];
	addedStats: StatPoint[];
	type: 'player' | 'pal';
}

export interface PlayerCardData extends BaseCharacterCardData {
	type: 'player';
	palCount: number;
	gold: number;
	foodRegenEffectTime?: number;
}

export interface FullPlayerCardData extends PlayerCardData {
	pals: PalCardData[];
}

export interface WorkSuitabilities {
	emitFlame?: number;
	watering?: number;
	seeding?: number;
	generateElectricity?: number;
	handcraft?: number;
	collection?: number;
	deforest?: number;
	mining?: number;
	productMedicine?: number;
	cool?: number;
	transport?: number;
	monsterFarm?: number;
}

export interface PalCardData extends BaseCharacterCardData {
	type: 'pal';
	isInCamp: boolean;
	characterId: string;
	gender?: string;
	equipWaza?: string[];
	talentHP?: number;
	talentShot?: number;
	talentDefense?: number;
	passiveSkills?: PassiveSkill[];
	rank: number;
	ownerPlayerId?: string;
	friendshipPoint?: number;
	ownedTime?: Date;
	// Additional data from pals.json
	displayName?: string;
	tribe?: string;
	zukanIndex?: number;
	size?: string;
	rarity?: number;
	elementType1?: string;
	elementType2?: string;
	genusCategory?: string;
	baseHp?: number;
	baseMeleeAttack?: number;
	baseShotAttack?: number;
	baseDefense?: number;
	baseSupport?: number;
	baseCraftSpeed?: number;
	workSuitabilities?: WorkSuitabilities;
	isBoss?: boolean;
	price?: number;
}

export type CharacterCardData = PlayerCardData | PalCardData;
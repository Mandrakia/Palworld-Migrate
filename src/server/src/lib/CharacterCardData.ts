export interface StatPoint {
	Name: string;
	Value: number;
}

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

export interface PalCardData extends BaseCharacterCardData {
	type: 'pal';
    isInCamp: boolean;
	characterId: string;
	gender?: string;
	equipWaza?: string[];
	talentHP?: number;
	talentShot?: number;
	talentDefense?: number;
	passiveSkills?: {
        Name: string;
        Description: string;
        Rating: number;
        Id: string;
    }[];
    rank: number;
	ownerPlayerId?: string;
	friendshipPoint?: number;
	ownedTime?: Date;
	// Additional data from pals.json
	displayName?: string;          // OverrideNameTextID
	tribe?: string;               // Tribe
	zukanIndex?: number;          // ZukanIndex (Pokedex number)
	size?: string;                // Size (S/M/L/XL)
	rarity?: number;              // Rarity (1-10)
	elementType1?: string;        // Primary element
	elementType2?: string;        // Secondary element
	genusCategory?: string;       // Body type (FourLegged, etc)
	baseHp?: number;              // Base HP stat
	baseMeleeAttack?: number;     // Base melee attack
	baseShotAttack?: number;      // Base shot attack
	baseDefense?: number;         // Base defense
	baseSupport?: number;         // Base support
	baseCraftSpeed?: number;      // Base craft speed
	workSuitabilities?: {         // Work capabilities
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
	};
	isBoss?: boolean;
	price?: number;               // Market value
}

export type CharacterCardData = PlayerCardData | PalCardData;
// Component-specific prop interfaces

import type { PassiveSkill } from './passive-skills';
import type { BreedingSource } from './breeding';
import type { PlayerCardData, PalCardData, FullPlayerCardData } from './character';

// PassiveSkill component props
export interface PassiveSkillProps {
	skill: PassiveSkill;
	onClick?: (skillName: string) => void;
	clickable?: boolean;
	size?: 'sm' | 'md' | 'lg';
	showDescription?: boolean;
}

// CombinationDetails component props
export interface CombinationDetailsProps {
	combination: BreedingSource;
}

// PlayerCard component props
export interface PlayerCardProps {
	player: PlayerCardData | FullPlayerCardData;
	[key: string]: any;
}
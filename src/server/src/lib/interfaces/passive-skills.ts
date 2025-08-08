// Passive skill related interfaces

export interface Buff {
	Attack: number;
	Defense: number;
	CraftSpeed: number;
	MoveSpeed: number;
}

export interface PassiveSkillBase {
	Name: string;
	Rating: number;
}

export interface PassiveSkill extends PassiveSkillBase {
	Id: string;
	Description?: string;
}

export interface PalPassiveSkill extends PassiveSkillBase {
	InternalName: string;
	I18n: string;
	Buff: Buff;
}

export interface LocalizedPassiveSkill {
	Name: string;
	Description: string;
	Rating: number;
	Buff: Buff;
	Id: string;
}
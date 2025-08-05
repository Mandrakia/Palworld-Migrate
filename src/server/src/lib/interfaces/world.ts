// World and server related interfaces

export interface World {
	id: string;
	name: string;
	description: string;
	created: string;
	lastModified: string;
	playerCount: number;
	palCount: number;
}

export interface Player {
	id: string;
	name: string;
	level: number;
	lastSeen: string;
}

export interface WorldSettings {
	difficulty: string;
	pvpEnabled: boolean;
	maxPlayers: number;
}

export interface WorldDetail extends World {
	players: Player[];
	settings: WorldSettings;
}

export interface Dungeon {
	Name: string;
	Id: string;
	X: number;
	Y: number;
	Z: number;
}

export interface DungeonWithState extends Dungeon {
	IsActive: boolean;
	DisappearAtTicks: number;
	RespawnAtTicks: number;
	DisappearAt: number;
	RespawnAt: number;
}

export interface CampDTO {
	Coords: {
		X: number;
		Y: number;
		Z: number;
	};
	GroupId: string;
}
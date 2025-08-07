// World and server related interfaces

export interface World {
	id: string;
	name?: string;
	description?: string;
	lastModified: Date;
	palCount: number;
}

export interface Player {
	id: string;
  fileId: string;
	name: string;
	level: number;
	lastSeen?: Date;
  isOnline?: boolean;
  instanceId: string;
  accountName?: string;
  x?: number;
  y?: number;
}

export interface WorldSettings {
	difficulty: string;
	pvpEnabled: boolean;
	maxPlayers: number;
}

export interface WorldDetail extends World {
	players: Player[];
	settings?: WorldSettings;
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
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

export interface ApiError {
  message: string;
  code?: string;
}
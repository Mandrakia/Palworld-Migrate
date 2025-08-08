import type { LocalizedPassiveSkill } from "./passive-skills"

export interface SimplePal {
    characterId: string,
    gender: "Male" | "Female" | "Neutral",
    passives: LocalizedPassiveSkill[],
    level: number,
    playerId?: string,
    instanceId?: string,
    name: string
}
export interface PalWithGenealogy extends SimplePal{
    parent1?: PalWithGenealogy,
    parent2?: PalWithGenealogy,
    probability?: number // Probability of getting this specific passive combination
}
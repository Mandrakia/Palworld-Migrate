// Character stats calculation functions

import type { CharacterStats, PassiveSkill } from './interfaces/index';
import { getPalData, getPassive } from './palDatabase';

/**
 * Calculate Pal stats based on character ID, talents, passive skills, level, and trust level
 * 
 * Formula based on: https://palworld.wiki.gg/wiki/Pal_Stats and https://paldb.cc/en/Pal_Calc
 * 
 * Trust Level modifies base stats first:
 * - Modified_HP_Stat = HP_Stat + Friendship_HP * Trust_Level
 * - Modified_Attack_Stat = Attack_Stat + Friendship_ShotAttack * Trust_Level
 * - Modified_Defense_Stat = Defense_Stat + Friendship_Defense * Trust_Level
 * - Modified_CraftSpeed_Stat = CraftSpeed_Stat + Friendship_CraftSpeed * Trust_Level
 * 
 * Then final stats are calculated:
 * - Health = (500 + 5 * Level + Modified_HP_Stat * 0.5 * Level * (1 + HP_IV%)) * (1 + HP_Bonus%)
 * - Attack = (100 + Modified_Attack_Stat * 0.075 * Level * (1 + Attack_IV%)) * (1 + Attack_Bonus%)
 * - Defense = (100 + Modified_Defense_Stat * 0.075 * Level * (1 + Defense_IV%)) * (1 + Defense_Bonus%)
 * - Work Speed = Modified_CraftSpeed_Stat * PassiveMultipliers
 * 
 * Where IV% = TalentInt * 0.3 / 100
 */
export function GetPalStats(
	character_id: string,
	talent_hp: number,
	talent_attack: number, 
	talent_defense: number,
	skills: PassiveSkill[],
	level: number,
	trust_level: number = 0
): CharacterStats {
	// Get pal species data
	const palData = getPalData(character_id);
	if (!palData) {
		throw new Error(`Pal data not found for character_id: ${character_id}`);
	}

	// Calculate Trust Level modified base stats
	const trust_modified_hp = palData.Hp + palData.Friendship_HP * trust_level;
	const trust_modified_attack = palData.ShotAttack + palData.Friendship_ShotAttack * trust_level;
	const trust_modified_defense = palData.Defense + palData.Friendship_Defense * trust_level;
	const trust_modified_craftspeed = palData.CraftSpeed + palData.Friendship_CraftSpeed * trust_level;

	// Calculate IV percentages from talent integers
	const hp_iv_percent = talent_hp * 0.3 / 100;
	const attack_iv_percent = talent_attack * 0.3 / 100;
	const defense_iv_percent = talent_defense * 0.3 / 100;

	// Calculate passive skill multipliers (HP_Bonus%, Attack_Bonus%, Defense_Bonus%)
	let hpBonusMultiplier = 1.0;      // No HP bonus in Buff interface, but keeping for future
	let attackBonusMultiplier = 1.0;
	let defenseBonusMultiplier = 1.0;
	let craftSpeedMultiplier = 1.0;

	// Sum up all passive skill buffs
	for (const skill of skills) {
		if (!skill.Id) continue;
		
		try {
			const passiveData = getPassive(skill.Id);
			if (passiveData && passiveData.Buff) {
				// Buff values are already in decimal format (0.15 = 15%)
				attackBonusMultiplier += passiveData.Buff.b_Attack;
				defenseBonusMultiplier += passiveData.Buff.b_Defense;
				craftSpeedMultiplier += passiveData.Buff.b_CraftSpeed;
			}
		} catch (error) {
			// Skip unknown passive skills
			console.warn(`Unknown passive skill: ${skill.Name}`);
		}
	}

	// Calculate stats using the correct wiki formulas with Trust Level modified base stats
	// HP: (500 + 5 * Level + (HP_Stat + Friendship_HP * Trust) * 0.5 * Level * (1 + HP_IV%)) * (1 + HP_Bonus%)
	const hp = Math.floor(
		(500 + 5 * level + trust_modified_hp * 0.5 * level * (1 + hp_iv_percent)) * 
		hpBonusMultiplier
		// Omitting SoulBonus and CondenserBonus as specified
	);

	// Attack: (100 + (Attack_Stat + Friendship_Attack * Trust) * 0.075 * Level * (1 + Attack_IV%)) * (1 + Attack_Bonus%)
	const attack = Math.floor(
		(100 + trust_modified_attack * 0.075 * level * (1 + attack_iv_percent)) * 
		attackBonusMultiplier
		// Omitting SoulBonus and CondenserBonus as specified
	);

	// Defense: (100 + (Defense_Stat + Friendship_Defense * Trust) * 0.075 * Level * (1 + Defense_IV%)) * (1 + Defense_Bonus%)
	const defense = Math.floor(
		(50 + trust_modified_defense * 0.075 * level * (1 + defense_iv_percent)) *
		defenseBonusMultiplier
		// Omitting SoulBonus and CondenserBonus as specified
	);

	// Work speed: (CraftSpeed + Friendship_CraftSpeed * Trust) * PassiveMultipliers
	const craftSpeed = 70 * craftSpeedMultiplier;
	return {
		hp,
		attack,
		defense,
        craftSpeed
	};
}
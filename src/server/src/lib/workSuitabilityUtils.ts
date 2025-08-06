/**
 * Work suitability utility functions for consistent icon and name mapping
 */

export interface WorkSuitability {
	key: string;
	name: string;
	icon: string;
	iconIndex: number;
}

export const WORK_SUITABILITIES: Record<string, WorkSuitability> = {
	emitFlame: { key: 'emitFlame', name: 'Fire', icon: '/T_icon_palwork_00.png', iconIndex: 0 },
	watering: { key: 'watering', name: 'Watering', icon: '/T_icon_palwork_01.png', iconIndex: 1 },
	seeding: { key: 'seeding', name: 'Seeding', icon: '/T_icon_palwork_02.png', iconIndex: 2 },
	generateElectricity: { key: 'generateElectricity', name: 'Electricity', icon: '/T_icon_palwork_03.png', iconIndex: 3 },
	handcraft: { key: 'handcraft', name: 'Handiwork', icon: '/T_icon_palwork_04.png', iconIndex: 4 },
	collection: { key: 'collection', name: 'Gathering', icon: '/T_icon_palwork_05.png', iconIndex: 5 },
	deforest: { key: 'deforest', name: 'Lumbering', icon: '/T_icon_palwork_06.png', iconIndex: 6 },
	mining: { key: 'mining', name: 'Mining', icon: '/T_icon_palwork_07.png', iconIndex: 7 },
	productMedicine: { key: 'productMedicine', name: 'Medicine', icon: '/T_icon_palwork_08.png', iconIndex: 8 },
	cool: { key: 'cool', name: 'Cooling', icon: '/T_icon_palwork_10.png', iconIndex: 10 },
	transport: { key: 'transport', name: 'Transport', icon: '/T_icon_palwork_11.png', iconIndex: 11 },
	monsterFarm: { key: 'monsterFarm', name: 'Farming', icon: '/T_icon_palwork_12.png', iconIndex: 12 }
};

/**
 * Get work skill icon using the same pattern as the character route
 */
export function getWorkSkillIcon(skillName: string): string {
	const skill = WORK_SUITABILITIES[skillName];
	if (skill) {
		return `/T_icon_palwork_${skill.iconIndex.toString().padStart(2, '0')}.png`;
	}
	return '';
}

/**
 * Get work skill display name
 */
export function getWorkSkillName(skillName: string): string {
	const skill = WORK_SUITABILITIES[skillName];
	return skill?.name || skillName;
}

/**
 * Get work skills with icons for display
 */
export function getWorkIcons(workSuitabilities: Record<string, number>): Array<{ icon: string, value: number, name: string, key: string }> {
	return Object.entries(WORK_SUITABILITIES)
		.filter(([key]) => workSuitabilities[key] > 0)
		.map(([key, skill]) => ({
			icon: skill.icon,
			value: workSuitabilities[key],
			name: skill.name,
			key: key
		}))
		.sort((a, b) => b.value - a.value); // Sort by value descending
}
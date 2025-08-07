import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { palDatabase } from '$lib/palDatabase';

interface CharacterInfo {
	id: string;
	displayName: string;
	tribe: string;
	workSuitabilities: {
		emitFlame: number;
		watering: number;
		seeding: number;
		generateElectricity: number;
		handcraft: number;
		collection: number;
		deforest: number;
		mining: number;
		productMedicine: number;
		cool: number;
		transport: number;
		monsterFarm: number;
	};
	elementType1: string;
	elementType2: string;
	rarity: number;
}

export const GET: RequestHandler = async () => {
	try {
		const characters: CharacterInfo[] = [];
		
		// Extract character info from pal database
		for (const [_, palData] of Object.entries(palDatabase)) {
			const characterId = palData.Tribe.replace("EPalTribeID::", "");
			
			// Skip if this is a duplicate (some entries might have multiple forms)
			if (characters.find(c => c.id === characterId)) {
				continue;
			}
			
			const character: CharacterInfo = {
				id: characterId,
				displayName: palData.OverrideNameTextID && palData.OverrideNameTextID !== 'None' 
					? palData.OverrideNameTextID 
					: characterId,
				tribe: characterId,
				workSuitabilities: {
					emitFlame: palData.WorkSuitability_EmitFlame || 0,
					watering: palData.WorkSuitability_Watering || 0,
					seeding: palData.WorkSuitability_Seeding || 0,
					generateElectricity: palData.WorkSuitability_GenerateElectricity || 0,
					handcraft: palData.WorkSuitability_Handcraft || 0,
					collection: palData.WorkSuitability_Collection || 0,
					deforest: palData.WorkSuitability_Deforest || 0,
					mining: palData.WorkSuitability_Mining || 0,
					productMedicine: palData.WorkSuitability_ProductMedicine || 0,
					cool: palData.WorkSuitability_Cool || 0,
					transport: palData.WorkSuitability_Transport || 0,
					monsterFarm: palData.WorkSuitability_MonsterFarm || 0
				},
				elementType1: palData.ElementType1 || 'None',
				elementType2: palData.ElementType2 || 'None',
				rarity: palData.Rarity || 1
			};
			
			characters.push(character);
		}
		
		// Sort by display name for better UX
		characters.sort((a, b) => a.displayName.localeCompare(b.displayName));
		
		return json(characters);
	} catch (error) {
		console.error('Error getting character list:', error);
		return json({ error: 'Failed to load character list' }, { status: 500 });
	}
};
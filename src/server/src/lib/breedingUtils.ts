import type { PalCardData } from '$lib/CharacterCardData';
import { getPalData, palDatabase } from "$lib/palDatabase";
import type { SimplePal } from '../routes/api/worlds/[id]/characters/[player_instance_id]/breeding-route/+server';

export function getBreedingResult(pal1: PalCardData|SimplePal , pal2: PalCardData|SimplePal): string | null {
    if (pal1.characterId == null || pal2.characterId == null) {
        return null;
    }
    
    const bData1 = getPalData(pal1.characterId);
    const bData2 = getPalData(pal2.characterId);
    
    if (!bData1 || !bData2) {
        return null;
    }

    // Check for specific breeding combinations first
    const combination = bData1.Combinations.filter(a => 
        (a.ParentTribeA == pal1.characterId && a.ParentTribeB == pal2.characterId) || 
        (a.ParentTribeA == pal2.characterId && a.ParentTribeB == pal1.characterId)
    );
    
    if (combination.length > 0) {
        return combination[0].ChildCharacterID;
    }
    
    // Calculate breeding rank and find closest match
    const bFinal = Math.floor((bData1.CombiRank + bData2.CombiRank + 1) / 2);
    
    const closest = Object.values(palDatabase)
        .filter(a => a.Combinations.every(c => c.ChildCharacterID !== a.Tribe.replace("EPalTribeID::", "")))
        .sort((a, b) => {
            const distanceA = Math.abs(a.CombiRank - bFinal);
            const distanceB = Math.abs(b.CombiRank - bFinal);
            
            if (distanceA === distanceB) {
                return a.CombiRank - b.CombiRank;
            }
            
            return distanceA - distanceB;
        })[0];
    
    return closest ? closest.Tribe.replace("EPalTribeID::", "") : null;
}
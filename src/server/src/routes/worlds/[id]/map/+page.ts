import type { PageLoad } from './$types';
import type { DungeonWithState } from '$lib/types';

interface CampDTO {
    Coords: { x: number; y: number };
    GroupId: string;
}

export const load: PageLoad = async ({ params, fetch }) => {
    const worldId = params.id;
    
    try {
        const [campsResponse, dungeonsResponse] = await Promise.all([
            fetch(`/api/worlds/${worldId}/camps`),
            fetch(`/api/worlds/${worldId}/dungeons`)
        ]);
        
        let camps: CampDTO[] = [];
        let dungeons: DungeonWithState[] = [];
        
        if (campsResponse.ok) {
            camps = await campsResponse.json();
        }
        
        if (dungeonsResponse.ok) {
            dungeons = await dungeonsResponse.json();
        }
        
        return {
            camps,
            dungeons
        };
    } catch (error) {
        console.error('Failed to load map data:', error);
        return {
            camps: [],
            dungeons: []
        };
    }
};
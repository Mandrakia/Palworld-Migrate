import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { FullPlayerCardData } from '$lib/CharacterCardData';
import { combineGuids } from '$lib/guidUtils';

export const load: PageLoad = async ({ params, fetch }) => {
  try {
    const { id, combinedId } = params;
    
    // Load character data
    const characterResponse = await fetch(`/api/worlds/${id}/characters/${combinedId}`);
    if (!characterResponse.ok) {
      if (characterResponse.status === 404) {
        throw error(404, 'Character not found');
      }
      throw error(characterResponse.status, 'Failed to load character data');
    }
    
    const characterData: FullPlayerCardData = await characterResponse.json();
    
    // Encode player ID and instance ID for breeding endpoint
    const playerInstanceId = combineGuids(characterData.id, characterData.instanceId);
    
    // Load breeding results
    const breedingResponse = await fetch(`/api/worlds/${id}/characters/${playerInstanceId}/breeding`);
    if (!breedingResponse.ok) {
      throw error(breedingResponse.status, 'Failed to load breeding data');
    }
    
    const breedingResults = await breedingResponse.json();
    
    return {
      characterData,
      breedingResults,
        combinedId,
      worldId: id
    };
  } catch (err) {
    if (err instanceof Error && 'status' in err) {
      throw err;
    }
    throw error(500, 'Failed to load breeding data');
  }
};
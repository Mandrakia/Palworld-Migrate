import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import type { FullPlayerCardData } from '$lib/CharacterCardData';

export const load: PageLoad = async ({ params, fetch }) => {
  try {
    const { id, combinedId } = params;
    
    const response = await fetch(`/api/worlds/${id}/characters/${combinedId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw error(404, 'Character not found');
      }
      throw error(response.status, 'Failed to load character data');
    }
    
    const characterData: FullPlayerCardData = await response.json();
    
    return {
      characterData,
      worldId: id,
      combinedId
    };
  } catch (err) {
    if (err instanceof Error && 'status' in err) {
      throw err;
    }
    throw error(500, 'Failed to load character data');
  }
};
import type { PageLoad } from './$types';
import type { WorldDetail } from '$lib/interfaces';

export const load: PageLoad = async ({ fetch }) => {
	try {
		const response = await fetch('/api/worlds');
		
		if (!response.ok) {
			return {
				servers: [] as WorldDetail[]
			};
		}
		
		const servers: WorldDetail[] = await response.json();
		return {
			servers
		};
	} catch (error) {
		console.error('Failed to load servers:', error);
		return {
			servers: [] as WorldDetail[]
		};
	}
};
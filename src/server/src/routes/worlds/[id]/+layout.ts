import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ params, url, fetch }) => {
	const version = url.searchParams.get('version');
	const versionParam = version ? '?version=' + version : '';
	
	try {
		const [serverDataResponse, worldsResponse] = await Promise.all([
			fetch(`/api/worlds/${params.id}${versionParam}`),
			fetch(`/api/worlds`)
		]);
		
		if (!serverDataResponse.ok) {
			return {
				serverData: null,
				error: 'Failed to load server data'
			};
		}
		
		const serverData = await serverDataResponse.json();
		
		// Get live player data with online status from /api/worlds
		if (worldsResponse.ok) {
			const worlds = await worldsResponse.json();
			const currentWorld = worlds.find((world: any) => world.id === params.id);
			if (currentWorld?.players) {
				// Replace the server data players with the live data that has isOnline
				serverData.players = currentWorld.players;
			}
		}
		
		return {
			serverData,
			error: null
		};
	} catch (error) {
		console.error('Error loading server data:', error);
		return {
			serverData: null,
			error: 'Failed to load server data'
		};
	}
};
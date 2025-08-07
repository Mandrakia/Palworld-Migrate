import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
	// Inherit the server data from the parent layout
	const data = await parent();
	return {
		serverData: data.serverData
	};
};
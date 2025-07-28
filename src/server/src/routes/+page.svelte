<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';

	onMount(async () => {
		if (!browser) return;

		try {
			// Get servers from API
			const response = await fetch('/api/worlds');
			if (!response.ok) return;
			
			const servers: Array<{Id: string, PlayerCount: number, Backups: string[]}> = await response.json();
			if (servers.length === 0) return;

			// Check localStorage for saved preferences
			const savedWorldId = localStorage.getItem('worldId');
			const savedWorldVersion = localStorage.getItem('worldVersion');

			let redirectUrl = '/worlds/';

			if (savedWorldId && servers.some(server => server.Id === savedWorldId)) {
				// Saved world exists, use it
				redirectUrl += savedWorldId;
				
				if (savedWorldVersion) {
					// Add version parameter if saved
					redirectUrl += `?version=${encodeURIComponent(savedWorldVersion)}`;
				}
			} else {
				// No saved world or saved world doesn't exist, use first available
				redirectUrl += servers[0].Id;
			}

			// Redirect to the world page
			goto(redirectUrl);
		} catch (error) {
			console.error('Failed to load servers for redirect:', error);
			// Stay on homepage if there's an error
		}
	});
</script>

<div class="max-w-4xl">
	<div class="mb-8">
		<h1 class="text-2xl font-bold text-white mb-4">Welcome to Palworld Save Editor</h1>
		<p class="text-slate-300">Select a category from the navigation above to start editing your save files.</p>
	</div>

	<!-- Dashboard Cards -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
		<div class="bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-6">
			<div class="flex items-center">
				<div class="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
					<svg class="w-6 h-6 text-blue-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
					</svg>
				</div>
				<div class="ml-4">
					<h3 class="text-lg font-medium text-white">Players</h3>
					<p class="text-sm text-slate-400">Manage player characters</p>
				</div>
			</div>
		</div>

		<div class="bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-6">
			<div class="flex items-center">
				<div class="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center">
					<svg class="w-6 h-6 text-emerald-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
					</svg>
				</div>
				<div class="ml-4">
					<h3 class="text-lg font-medium text-white">Containers</h3>
					<p class="text-sm text-slate-400">Edit inventories & storage</p>
				</div>
			</div>
		</div>

		<div class="bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-6">
			<div class="flex items-center">
				<div class="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
					<svg class="w-6 h-6 text-purple-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
					</svg>
				</div>
				<div class="ml-4">
					<h3 class="text-lg font-medium text-white">Map</h3>
					<p class="text-sm text-slate-400">World & base management</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Recent Activity -->
	<div class="bg-slate-800 border border-slate-700 rounded-lg shadow-lg">
		<div class="px-6 py-4 border-b border-slate-700">
			<h2 class="text-lg font-medium text-white">Server Status</h2>
		</div>
		<div class="p-6">
			<div class="space-y-4">
				<div class="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
					<div class="flex items-center space-x-3">
						<div class="w-3 h-3 bg-green-400 rounded-full"></div>
						<span class="font-medium text-white">Main Server</span>
					</div>
					<span class="text-sm text-slate-400">Last updated: 2 minutes ago</span>
				</div>
				<div class="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
					<div class="flex items-center space-x-3">
						<div class="w-3 h-3 bg-yellow-400 rounded-full"></div>
						<span class="font-medium text-white">Test Server</span>
					</div>
					<span class="text-sm text-slate-400">Last updated: 1 hour ago</span>
				</div>
			</div>
		</div>
	</div>
</div>

<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { LayoutData } from './$types';
	import type { CharacterCardData } from '$lib/CharacterCardData';
	import { mapFilters } from '$lib/stores/mapFilters';
	
	let { data }: { data: LayoutData } = $props();
	
	let serverId = $derived($page.params.id);
	let worldData = $derived(data.serverData);
	let currentPath = $derived($page.url.pathname);
	let isMapPage = $derived(currentPath.endsWith('/map'));
	
	// Navigation state
	let charactersExpanded = true;
	let sidebarOpen = false;
	
	// Helper function to check if a path is active
	function isActive(path: string): boolean {
		return currentPath === path || currentPath.startsWith(path + '/');
	}
	
	// Navigation functions
	function navigateToPlayer(player: CharacterCardData): void {
		const combinedId = combineGuids(player.id, player.instanceId);
		goto(`/worlds/${serverId}/characters/${combinedId}`);
		closeSidebar(); // Close mobile sidebar after navigation
	}
	
	function navigateToMap(): void {
		goto(`/worlds/${serverId}/map`);
		closeSidebar(); // Close mobile sidebar after navigation
	}
	
	function navigateToAdmin(): void {
		goto(`/worlds/${serverId}/admin`);
		closeSidebar(); // Close mobile sidebar after navigation
	}
	
	function combineGuids(guid1: string, guid2: string): string {
		const hex1 = guid1.replace(/-/g, '');
		const hex2 = guid2.replace(/-/g, '');
		const combined = BigInt('0x' + hex1 + hex2);
		return combined.toString(36);
	}
	
	function toggleSidebar(): void {
		sidebarOpen = !sidebarOpen;
	}
	
	function closeSidebar(): void {
		sidebarOpen = false;
	}
</script>

<div class="flex h-full relative">
	<!-- Mobile Menu Button -->
	<button
		class="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-800 text-white rounded-lg shadow-lg border border-slate-600 hover:bg-slate-700 transition-colors"
		on:click={toggleSidebar}
		aria-label="Toggle navigation menu"
	>
		<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
		</svg>
	</button>

	<!-- Overlay for mobile -->
	{#if sidebarOpen}
		<div 
			class="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
			on:click={closeSidebar}
			role="button"
			tabindex="-1"
			aria-label="Close sidebar"
		></div>
	{/if}

	<!-- Left Navigation Sidebar -->
	<nav class="
		{sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
		lg:translate-x-0
		fixed lg:relative
		z-40 lg:z-auto
		w-80 lg:w-80
		h-full
		bg-slate-800 border-r border-slate-700 
		flex-shrink-0 overflow-y-auto
		transition-transform duration-300 ease-in-out
		lg:transition-none
	">
		<div class="p-3 sm:p-4 pt-16 lg:pt-4">
			
			<!-- Navigation Sections -->
			<div class="space-y-2">
				
				<!-- Characters Section -->
				<div class="nav-section">
					<button 
						class="w-full flex items-center justify-between p-2 text-sm font-medium text-white hover:bg-slate-700 rounded-lg transition-colors"
						on:click={() => charactersExpanded = !charactersExpanded}
					>
						<div class="flex items-center space-x-2">
							<svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
							</svg>
							<span>Characters</span>
						</div>
						<svg 
							class="w-4 h-4 text-slate-500 transform transition-transform {charactersExpanded ? 'rotate-90' : ''}" 
							fill="none" stroke="currentColor" viewBox="0 0 24 24"
						>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
						</svg>
					</button>
					
					{#if charactersExpanded && worldData?.players}
						<div class="ml-6 mt-2 space-y-1">
							{#each worldData.players as player}
								<button
									class="w-full text-left p-2 text-sm text-slate-300 hover:text-white hover:bg-slate-700 rounded-lg transition-colors {isActive(`/worlds/${serverId}/characters/${combineGuids(player.id, player.instanceId)}`) ? 'bg-slate-700 text-white' : ''}"
									on:click={() => navigateToPlayer(player)}
								>
									<div class="flex items-center justify-between">
										<div class="flex items-center space-x-2 min-w-0">
											<div class="w-2 h-2 rounded-full flex-shrink-0 {player.isOnline ? 'bg-green-400' : 'border border-slate-500'}"></div>
											<span class="truncate">{player.name}</span>
										</div>
										<span class="text-xs text-slate-500 ml-2">Lv{player.level}</span>
									</div>
								</button>
							{/each}
							
							{#if worldData.players.length === 0}
								<div class="ml-2 p-2 text-xs text-slate-500">
									No players found
								</div>
							{/if}
						</div>
					{/if}
				</div>
				
				<!-- Map Section -->
				<div class="nav-section">
					<button
						class="w-full flex items-center space-x-2 p-2 text-sm font-medium text-white hover:bg-slate-700 rounded-lg transition-colors {isActive(`/worlds/${serverId}/map`) ? 'bg-slate-700' : ''}"
						on:click={navigateToMap}
					>
						<svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
						</svg>
						<span>Map</span>
					</button>
					
					{#if isMapPage}
						<div class="ml-6 mt-2 space-y-3">
							<div class="text-xs font-medium text-slate-400 uppercase tracking-wider">Filters</div>
							
							<label class="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors cursor-pointer">
								<input type="checkbox" bind:checked={$mapFilters.showPlayers} class="w-3 h-3 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-1" />
								<span class="text-xs">Show Players</span>
							</label>
							
							<label class="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors cursor-pointer">
								<input type="checkbox" bind:checked={$mapFilters.showCamps} class="w-3 h-3 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-1" />
								<span class="text-xs">Show Camps</span>
							</label>
							
							<label class="flex items-center space-x-2 text-slate-300 hover:text-white transition-colors cursor-pointer">
								<input type="checkbox" bind:checked={$mapFilters.showDungeons} class="w-3 h-3 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-1" />
								<span class="text-xs">Show Dungeons</span>
							</label>
							
							{#if $mapFilters.showDungeons}
								<div class="ml-4 space-y-2 border-l border-slate-600 pl-3">
									<label class="flex items-center space-x-2 text-slate-400 hover:text-slate-300 transition-colors cursor-pointer">
										<input type="checkbox" bind:checked={$mapFilters.showActiveDungeons} class="w-3 h-3 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-1" />
										<span class="text-xs">Active Dungeons</span>
									</label>
									<label class="flex items-center space-x-2 text-slate-400 hover:text-slate-300 transition-colors cursor-pointer">
										<input type="checkbox" bind:checked={$mapFilters.showInactiveDungeons} class="w-3 h-3 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-1" />
										<span class="text-xs">Inactive Dungeons</span>
									</label>
								</div>
							{/if}
						</div>
					{/if}
				</div>
				
				<!-- Admin Section -->
				<div class="nav-section">
					<button
						class="w-full flex items-center space-x-2 p-2 text-sm font-medium text-white hover:bg-slate-700 rounded-lg transition-colors {isActive(`/worlds/${serverId}/admin`) ? 'bg-slate-700' : ''}"
						on:click={navigateToAdmin}
					>
						<svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
						</svg>
						<span>Admin</span>
					</button>
				</div>
			</div>
		</div>
	</nav>
	
	<!-- Main Content Area -->
	<main class="flex-1 overflow-y-auto bg-slate-900 lg:ml-0">
		{#if isMapPage}
			<!-- Map page gets full height without padding -->
			<slot />
		{:else}
			<!-- Other pages get responsive padding -->
			<div class="p-4 sm:p-6 pt-16 lg:pt-6">
				<slot />
			</div>
		{/if}
	</main>
</div>

<style>
	.nav-section + .nav-section {
		margin-top: 0.5rem;
	}
</style>
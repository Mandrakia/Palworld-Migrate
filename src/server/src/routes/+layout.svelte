<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import type { WorldDetail } from '$lib/interfaces';
	
	// Server state
	let servers: WorldDetail[] = [];
	let selectedServer: string = '';
	let serverDropdownOpen = false;
	
	
	$: currentServerData = servers.find(s => s.id === selectedServer);
	$: playerCount = currentServerData?.players.length || 0;
	$: onlinePlayerCount = currentServerData?.players.filter(p => p.isOnline).length || 0;
	
	// React to route changes to sync dropdown with URL
	$: if ($page.params.id) {
		selectedServer = $page.params.id;
	}
	
	onMount(async () => {
		await loadServers();
	});
	
	async function loadServers() {
		try {
			const response = await fetch('/api/worlds');
			if (response.ok) {
				servers = await response.json();
				if (servers.length > 0 && !selectedServer) {
					selectedServer = servers[0].Id;
				}
			}
		} catch (error) {
			console.error('Failed to load servers:', error);
		}
	}
	
	function selectServer(serverId: string) {
		selectedServer = serverId;
		serverDropdownOpen = false;
		
		// Save to localStorage and redirect
		if (browser) {
			localStorage.setItem('worldId', serverId);
		}
		goto(`/worlds/${serverId}`);
	}
	
	// Close dropdown when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as Element;
		
		// Check if click is outside server dropdown
		const serverDropdown = document.querySelector('.server-dropdown');
		if (serverDropdown && !serverDropdown.contains(target)) {
			serverDropdownOpen = false;
		}
	}
</script>

<!-- Click outside handler -->
<svelte:window onclick={handleClickOutside} />

<div class="h-full flex flex-col">
	<!-- Top Navigation -->
	<header class="bg-slate-800 shadow-lg border-b border-slate-700">
		<div class="mx-auto px-2 sm:px-4 lg:px-8">
			<div class="flex justify-between items-center h-14 sm:h-16">
				<!-- Left side: Title -->
				<div class="flex items-center min-w-0 flex-1">
					<h1 class="text-lg sm:text-xl font-bold text-white truncate">
						<span class="sm:hidden">Palworld</span>
						<span class="hidden sm:inline">Palworld Save Editor</span>
					</h1>
				</div>
				
				<!-- Right side: Server dropdown and Player count -->
				<div class="flex items-center space-x-2 sm:space-x-4 lg:space-x-6">
					<!-- Player count - hide on mobile when space is tight -->
					{#if currentServerData}
						<div class="hidden md:flex items-center space-x-3 lg:space-x-4">
							<div class="flex items-center space-x-1 sm:space-x-2">
								<span class="text-xs sm:text-sm text-slate-300">Online:</span>
								<span class="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-green-600 text-green-100 text-xs sm:text-sm font-semibold rounded">{onlinePlayerCount}</span>
							</div>
							<div class="flex items-center space-x-1 sm:space-x-2">
								<span class="text-xs sm:text-sm text-slate-300">Total:</span>
								<span class="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-blue-600 text-blue-100 text-xs sm:text-sm font-semibold rounded">{playerCount}</span>
							</div>
						</div>
						<!-- Compact mobile player count -->
						<div class="md:hidden flex items-center space-x-2">
							<span class="px-1.5 py-0.5 bg-green-600 text-green-100 text-xs font-semibold rounded">{onlinePlayerCount}</span>
							<span class="px-1.5 py-0.5 bg-blue-600 text-blue-100 text-xs font-semibold rounded">{playerCount}</span>
						</div>
					{/if}
					
					<!-- Server Dropdown -->
					<div class="relative server-dropdown">
						<button 
							onclick={() => serverDropdownOpen = !serverDropdownOpen}
							class="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-1.5 sm:py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-xs sm:text-sm font-medium transition-colors duration-200"
						>
							<svg class="w-3 h-3 sm:w-4 sm:h-4 text-slate-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z"></path>
							</svg>
							<span class="truncate max-w-[100px] sm:max-w-[150px] lg:max-w-[200px]">{currentServerData?.name || selectedServer || 'Select Server'}</span>
							<svg class="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 transition-transform duration-200 flex-shrink-0 {serverDropdownOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
							</svg>
						</button>
						
						{#if serverDropdownOpen}
							<div class="absolute top-full right-0 mt-1 w-72 sm:w-80 bg-slate-700 border border-slate-600 rounded-lg shadow-lg z-50 max-h-48 sm:max-h-60 overflow-y-auto custom-scrollbar">
								{#each servers as server}
									<button
										onclick={() => selectServer(server.id)}
										class="w-full px-3 sm:px-4 py-2 sm:py-3 text-left hover:bg-slate-600 transition-colors duration-150 border-b border-slate-600 last:border-b-0"
									>
										<div class="flex items-center justify-between">
											<div class="min-w-0 flex-1">
												<div class="text-white font-medium text-xs sm:text-sm truncate">{server.name || server.id}</div>
												<div class="text-slate-400 text-xs">
													{server.players.filter(p => p.isOnline).length}/{server.players.length} online • {server.palCount} pals
												</div>
											</div>
											{#if selectedServer === server.id}
												<svg class="w-4 h-4 text-blue-400 ml-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
													<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
												</svg>
											{/if}
										</div>
									</button>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</header>

	<!-- Main Content Area -->
	<div class="flex-1 flex overflow-hidden">
		<!-- Center Content Panel -->
		<main class="flex-1 overflow-y-auto bg-slate-900">
			<slot />
		</main>
	</div>
</div>
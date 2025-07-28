<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	
	// Server and version state
	let servers: Array<{Id: string, PlayerCount: number, Backups: string[]}> = [];
	let selectedServer: string = '';
	let selectedVersion: string = 'Live';
	let serverDropdownOpen = false;
	let versionDropdownOpen = false;
	
	// Current view for left panel
	let currentView = 'players';
	
	$: currentServerData = servers.find(s => s.Id === selectedServer);
	$: availableVersions = currentServerData ? ['Live', ...currentServerData.Backups] : ['Live'];
	$: playerCount = currentServerData?.PlayerCount || 0;
	
	// React to route changes to sync dropdowns with URL
	$: if ($page.params.id) {
		selectedServer = $page.params.id;
		const versionParam = $page.url.searchParams.get('version');
		selectedVersion = versionParam || 'Live';
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
		selectedVersion = 'Live'; // Reset to Live when changing servers
		serverDropdownOpen = false;
		
		// Save to localStorage and redirect
		if (browser) {
			localStorage.setItem('worldId', serverId);
			localStorage.setItem('worldVersion', 'Live');
		}
		goto(`/worlds/${serverId}`);
	}
	
	function selectVersion(version: string) {
		selectedVersion = version;
		versionDropdownOpen = false;
		
		// Save to localStorage and redirect
		if (browser) {
			localStorage.setItem('worldVersion', version);
			if (selectedServer) {
				localStorage.setItem('worldId', selectedServer);
			}
		}
		
		if (selectedServer) {
			const url = version === 'Live' 
				? `/worlds/${selectedServer}` 
				: `/worlds/${selectedServer}?version=${encodeURIComponent(version)}`;
			goto(url);
		}
	}
	
	function setView(view: string) {
		currentView = view;
	}
	
	function formatDateTime(dateTimeString: string): string {
		if (dateTimeString === 'Live') return dateTimeString;
		
		// Parse yyyy.MM.dd-HH.mm.ss format
		const parts = dateTimeString.split('-');
		if (parts.length !== 2) return dateTimeString;
		
		const datePart = parts[0].replace(/\./g, '/'); // yyyy/MM/dd
		const timePart = parts[1].replace(/\./g, ':'); // HH:mm:ss
		
		return `${datePart} ${timePart}`;
	}
	
	// Close dropdowns when clicking outside
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as Element;
		
		// Check if click is outside server dropdown
		const serverDropdown = document.querySelector('.server-dropdown');
		if (serverDropdown && !serverDropdown.contains(target)) {
			serverDropdownOpen = false;
		}
		
		// Check if click is outside version dropdown
		const versionDropdown = document.querySelector('.version-dropdown');
		if (versionDropdown && !versionDropdown.contains(target)) {
			versionDropdownOpen = false;
		}
	}
</script>

<!-- Click outside handler -->
<svelte:window onclick={handleClickOutside} />

<div class="h-full flex flex-col">
	<!-- Top Navigation -->
	<header class="bg-slate-800 shadow-lg border-b border-slate-700">
		<div class="mx-auto px-4 sm:px-6 lg:px-8">
			<div class="flex justify-between items-center h-16">
				<!-- Left side: Title -->
				<div class="flex items-center">
					<h1 class="text-xl font-bold text-white">Palworld Save Editor</h1>
				</div>
				
				<!-- Right side: Dropdowns and Player count -->
				<div class="flex items-center space-x-6">
					<!-- Server Dropdown -->
					<div class="relative server-dropdown">
						<button 
							onclick={() => serverDropdownOpen = !serverDropdownOpen}
							class="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium transition-colors duration-200"
						>
							<svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12l4-4m-4 4l4 4"></path>
							</svg>
							<span class="truncate max-w-[200px]">{selectedServer || 'Select Server'}</span>
							<svg class="w-4 h-4 text-slate-400 transition-transform duration-200 {serverDropdownOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
							</svg>
						</button>
						
						{#if serverDropdownOpen}
							<div class="absolute top-full right-0 mt-1 w-80 bg-slate-700 border border-slate-600 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto custom-scrollbar">
								{#each servers as server}
									<button
										onclick={() => selectServer(server.Id)}
										class="w-full px-4 py-3 text-left hover:bg-slate-600 transition-colors duration-150 border-b border-slate-600 last:border-b-0"
									>
										<div class="flex items-center justify-between">
											<div class="min-w-0 flex-1">
												<div class="text-white font-medium font-mono text-sm truncate">{server.Id}</div>
												<div class="text-slate-400 text-xs">{server.PlayerCount} players • {server.Backups.length} backups</div>
											</div>
											{#if selectedServer === server.Id}
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
					
					<!-- Version Dropdown -->
					<div class="relative version-dropdown">
						<button 
							onclick={() => versionDropdownOpen = !versionDropdownOpen}
							class="flex items-center space-x-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white text-sm font-medium transition-colors duration-200"
							disabled={!selectedServer}
						>
							<svg class="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
							</svg>
							<span class="flex items-center space-x-2">
								{#if selectedVersion === 'Live'}
									<span class="w-2 h-2 bg-green-400 rounded-full"></span>
								{:else}
									<span class="w-2 h-2 bg-yellow-400 rounded-full"></span>
								{/if}
								<span class="truncate max-w-[120px]">{formatDateTime(selectedVersion)}</span>
							</span>
							<svg class="w-4 h-4 text-slate-400 transition-transform duration-200 {versionDropdownOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
							</svg>
						</button>
						
						{#if versionDropdownOpen && selectedServer}
							<div class="absolute top-full right-0 mt-1 w-80 bg-slate-700 border border-slate-600 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto custom-scrollbar">
								{#each availableVersions as version}
									<button
										onclick={() => selectVersion(version)}
										class="w-full px-4 py-3 text-left hover:bg-slate-600 transition-colors duration-150 border-b border-slate-600 last:border-b-0"
									>
										<div class="flex items-center justify-between">
											<div class="flex items-center space-x-3 min-w-0 flex-1">
												{#if version === 'Live'}
													<span class="w-2 h-2 bg-green-400 rounded-full flex-shrink-0"></span>
													<span class="text-white font-medium">Live</span>
													<span class="px-2 py-1 bg-green-600 text-green-100 text-xs rounded flex-shrink-0">Current</span>
												{:else}
													<span class="w-2 h-2 bg-yellow-400 rounded-full flex-shrink-0"></span>
													<span class="text-white font-mono text-sm truncate">{formatDateTime(version)}</span>
													<span class="px-2 py-1 bg-slate-600 text-slate-300 text-xs rounded flex-shrink-0">Backup</span>
												{/if}
											</div>
											{#if selectedVersion === version}
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
					
					<!-- Player count -->
					<div class="flex items-center">
						<span class="text-sm text-slate-300">Players:</span>
						<span class="ml-2 px-3 py-1 bg-blue-600 text-blue-100 text-sm font-semibold rounded-lg">{playerCount}</span>
					</div>
				</div>
			</div>
		</div>
	</header>

	<!-- Main Content Area -->
	<div class="flex-1 flex overflow-hidden">
		<!-- Left Panel -->
		<aside class="w-[350px] bg-slate-800 border-r border-slate-700 overflow-y-auto">
			<div class="p-4">
				<h2 class="text-lg font-semibold text-white mb-4">
					{#if currentView === 'players'}
						Characters
					{:else if currentView === 'containers'}
						Containers
					{:else}
						Map Objects
					{/if}
				</h2>
				
				<!-- List items -->
				<div class="space-y-2">
					{#if currentView === 'players'}
						<!-- Character list placeholder -->
						{#each Array(5) as _, i}
							<div class="p-3 border border-slate-600 rounded-lg hover:bg-slate-700 cursor-pointer transition-colors">
								<div class="flex items-center space-x-3">
									<div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
										<span class="text-xs font-medium text-blue-100">P{i + 1}</span>
									</div>
									<div class="flex-1 min-w-0">
										<p class="text-sm font-medium text-white truncate">Player {i + 1}</p>
										<p class="text-xs text-slate-400">Level 42</p>
									</div>
								</div>
							</div>
						{/each}
					{:else if currentView === 'containers'}
						<!-- Container list placeholder -->
						{#each Array(3) as _, i}
							<div class="p-3 border border-slate-600 rounded-lg hover:bg-slate-700 cursor-pointer transition-colors">
								<div class="flex items-center space-x-3">
									<div class="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
										<span class="text-xs font-medium text-emerald-100">C{i + 1}</span>
									</div>
									<div class="flex-1 min-w-0">
										<p class="text-sm font-medium text-white truncate">Container {i + 1}</p>
										<p class="text-xs text-slate-400">24 items</p>
									</div>
								</div>
							</div>
						{/each}
					{:else}
						<!-- Map objects placeholder -->
						{#each Array(6) as _, i}
							<div class="p-3 border border-slate-600 rounded-lg hover:bg-slate-700 cursor-pointer transition-colors">
								<div class="flex items-center space-x-3">
									<div class="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
										<span class="text-xs font-medium text-purple-100">M{i + 1}</span>
									</div>
									<div class="flex-1 min-w-0">
										<p class="text-sm font-medium text-white truncate">Base {i + 1}</p>
										<p class="text-xs text-slate-400">Active</p>
									</div>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		</aside>

		<!-- Center Content Panel -->
		<main class="flex-1 overflow-y-auto bg-slate-900">
			<div class="p-6">
				<slot />
			</div>
		</main>
	</div>
</div>
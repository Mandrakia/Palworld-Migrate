<script lang="ts">
	import { page } from '$app/state';
	import PlayerCard from '$lib/PlayerCard.svelte';
	import type { CharacterCardData } from '$lib/CharacterCardData';
    import {goto} from "$app/navigation";
	
	interface WorldData {
		server: {
			id: string;
			timestamp: string;
			playerCount: number;
			backupCount: number;
		};
		players: CharacterCardData[];
		backups: string[];
	}
    let { data }: PageProps = $props();
	let loading = false;
	let selectedPlayer: CharacterCardData | null = null;
	let worldData = data.serverData;
	let serverId = page.params.id;
	let version = page.url.searchParams.get('version') || 'Live';

	
	function selectPlayer(player: CharacterCardData) {
		goto(`${serverId}/characters/${combineGuids(player.id, player.instanceId)}`);
	}
    function combineGuids(guid1: string, guid2: string): string {
        const hex1 = guid1.replace(/-/g, '');
        const hex2 = guid2.replace(/-/g, '');
        const combined = BigInt('0x' + hex1 + hex2);
        return combined.toString(36);
    }
</script>

{#if loading}
	<div class="flex items-center justify-center h-64">
		<div class="text-white text-lg">Loading world data...</div>
	</div>
{:else if worldData}
	<div class="max-w-6xl">
		<!-- World Header -->
		<div class="mb-8">
			<div class="flex items-center justify-between mb-4">
				<div>
					<h1 class="text-2xl font-bold text-white mb-2">World: {worldData.server.id}</h1>
					<div class="flex items-center space-x-6 text-slate-400">
						<span class="flex items-center space-x-2">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
							</svg>
							<span>{worldData.server.playerCount} Players</span>
						</span>
						<span class="flex items-center space-x-2">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
							</svg>
							<span>Version: {version}</span>
						</span>
						<span class="flex items-center space-x-2">
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12l4-4m-4 4l4 4"></path>
							</svg>
							<span>{worldData.server.backupCount} Backups</span>
						</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Player Cards Grid -->
		<div class="mb-8">
			<h2 class="text-xl font-semibold text-white mb-6">Players & Characters</h2>
			
			{#if worldData.players.length === 0}
				<div class="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center">
					<div class="text-slate-400 mb-2">No players found</div>
					<div class="text-slate-500 text-sm">This world doesn't have any player data yet.</div>
				</div>
			{:else}
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{#each worldData.players as player}
						<PlayerCard character={player} onSelect={selectPlayer} />
					{/each}
				</div>
			{/if}
		</div>

		<!-- Selected Player Detail (Placeholder) -->
		{#if selectedPlayer}
			<div class="bg-slate-800 border border-slate-700 rounded-lg p-6">
				<h3 class="text-lg font-semibold text-white mb-4">
					Selected: {selectedPlayer.name}
				</h3>
				<div class="text-slate-400">
					Player detail editor coming soon...
				</div>
			</div>
		{/if}
	</div>
{:else}
	<div class="flex items-center justify-center h-64">
		<div class="text-center">
			<div class="text-red-400 text-lg mb-2">Failed to load world data</div>
			<div class="text-slate-500">Please check if the server exists and try again.</div>
		</div>
	</div>
{/if}
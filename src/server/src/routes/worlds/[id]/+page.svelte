<script lang="ts">
	import { page } from '$app/stores';
	import PlayerCard from '$lib/PlayerCard.svelte';
	import type { CharacterCardData } from '$lib/CharacterCardData';
	import { goto } from "$app/navigation";
	import type { PageData } from './$types';
	
	export let data: PageData;
	
	$: serverId = $page.params.id;
	$: worldData = data.serverData;
	$: version = $page.url.searchParams.get('version') || 'Live';
	
	function selectPlayer(player: CharacterCardData) {
		goto(`/worlds/${serverId}/characters/${combineGuids(player.id, player.instanceId)}`);
	}
	
	function combineGuids(guid1: string, guid2: string): string {
		const hex1 = guid1.replace(/-/g, '');
		const hex2 = guid2.replace(/-/g, '');
		const combined = BigInt('0x' + hex1 + hex2);
		return combined.toString(36);
	}
</script>

{#if worldData}
	<!-- World Overview Dashboard -->
	<div class="mb-8">
		<h1 class="text-2xl font-bold text-white mb-6">Server Overview</h1>
		
		<!-- Stats Grid -->
		<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
			<div class="bg-slate-800 border border-slate-700 rounded-lg p-6">
				<div class="flex items-center">
					<div class="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
						<svg class="w-6 h-6 text-blue-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
						</svg>
					</div>
					<div class="ml-4">
						<h3 class="text-lg font-medium text-white">{worldData.server.playerCount}</h3>
						<p class="text-sm text-slate-400">Total Players</p>
					</div>
				</div>
			</div>

			<div class="bg-slate-800 border border-slate-700 rounded-lg p-6">
				<div class="flex items-center">
					<div class="w-12 h-12 bg-emerald-600 rounded-lg flex items-center justify-center">
						<svg class="w-6 h-6 text-emerald-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
						</svg>
					</div>
					<div class="ml-4">
						<h3 class="text-lg font-medium text-white">{worldData.server.backupCount}</h3>
						<p class="text-sm text-slate-400">Backups Available</p>
					</div>
				</div>
			</div>

			<div class="bg-slate-800 border border-slate-700 rounded-lg p-6">
				<div class="flex items-center">
					<div class="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
						<svg class="w-6 h-6 text-purple-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
						</svg>
					</div>
					<div class="ml-4">
						<h3 class="text-lg font-medium text-white">{version}</h3>
						<p class="text-sm text-slate-400">Current Version</p>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Player Overview Grid -->
	<div class="mb-8">
		<h2 class="text-xl font-semibold text-white mb-6">Players & Characters</h2>
		
		{#if worldData.players.length === 0}
			<div class="bg-slate-800 border border-slate-700 rounded-lg p-8 text-center">
				<div class="text-slate-400 mb-2">No players found</div>
				<div class="text-slate-500 text-sm">This world doesn't have any player data yet.</div>
			</div>
		{:else}
			<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
				{#each worldData.players as player}
					<PlayerCard character={player} onSelect={selectPlayer} />
				{/each}
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
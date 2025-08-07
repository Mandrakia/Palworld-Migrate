<script lang="ts">
	import type { PageData } from './$types';
	import type { WorldDetail } from '$lib/interfaces';
	import { goto } from '$app/navigation';

	export let data: PageData;
	
	$: servers = data.servers as WorldDetail[];

	function navigateToServer(serverId: string): void {
		goto(`/worlds/${serverId}`);
	}

	function formatLastModified(date: Date): string {
		const now = new Date();
		const diffInMinutes = Math.floor((now.getTime() - new Date(date).getTime()) / (1000 * 60));
		
		if (diffInMinutes < 1) return 'Just now';
		if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
		
		const diffInHours = Math.floor(diffInMinutes / 60);
		if (diffInHours < 24) return `${diffInHours} hours ago`;
		
		const diffInDays = Math.floor(diffInHours / 24);
		return `${diffInDays} days ago`;
	}

	function getOnlinePlayerCount(players: WorldDetail['players']): number {
		return players.filter(p => p.isOnline).length;
	}
</script>

<div class="max-w-6xl mx-auto">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-white mb-4">Palworld Servers</h1>
		<p class="text-slate-300">Manage your Palworld dedicated servers and players</p>
	</div>

	{#if servers.length === 0}
		<div class="bg-slate-800 border border-slate-700 rounded-lg shadow-lg p-8 text-center">
			<div class="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
				<svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z"></path>
				</svg>
			</div>
			<h3 class="text-xl font-medium text-white mb-2">No Servers Found</h3>
			<p class="text-slate-400">No Palworld servers are currently configured. Check your settings configuration.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
			{#each servers as server}
				<div class="bg-slate-800 border border-slate-700 rounded-lg shadow-lg hover:border-slate-600 transition-colors cursor-pointer" 
					 on:click={() => navigateToServer(server.id)}
					 on:keydown={(e) => e.key === 'Enter' && navigateToServer(server.id)}
					 role="button" 
					 tabindex="0">
					
					<!-- Server Header -->
					<div class="p-6 border-b border-slate-700">
						<div class="flex items-center justify-between mb-2">
							<div class="flex items-center space-x-3">
								<div class="w-4 h-4 bg-green-400 rounded-full"></div>
								<h2 class="text-xl font-semibold text-white">
									{server.name || `Server ${server.id}`}
								</h2>
							</div>
							<span class="text-sm text-slate-400">
								{formatLastModified(server.lastModified)}
							</span>
						</div>
						
						{#if server.description}
							<p class="text-slate-300 text-sm mb-3">{server.description}</p>
						{/if}
						
						<div class="flex items-center space-x-6 text-sm">
							<div class="flex items-center space-x-2">
								<svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
								</svg>
								<span class="text-slate-300">
									<span class="text-white font-medium">{getOnlinePlayerCount(server.players)}</span>
									/<span class="text-slate-400">{server.players.length}</span> online
								</span>
							</div>
							
							<div class="flex items-center space-x-2">
								<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
								</svg>
								<span class="text-slate-300">
									<span class="text-white font-medium">{server.palCount}</span> pals
								</span>
							</div>
						</div>
					</div>
					
					<!-- Players List -->
					{#if server.players.length > 0}
						<div class="p-6">
							<h3 class="text-sm font-medium text-slate-300 mb-3">Players</h3>
							<div class="space-y-2">
								{#each server.players.slice(0, 6) as player}
									<div class="flex items-center justify-between p-2 rounded bg-slate-700/50">
										<div class="flex items-center space-x-3">
											<div class="w-2 h-2 rounded-full {player.isOnline ? 'bg-green-400' : 'bg-slate-500'}"></div>
											<div>
												<span class="text-white text-sm font-medium">{player.name}</span>
												{#if player.accountName && player.accountName !== player.name}
													<span class="text-slate-400 text-xs ml-1">({player.accountName})</span>
												{/if}
											</div>
										</div>
										<div class="text-right">
											<div class="text-slate-400 text-xs">Level {player.level}</div>
										</div>
									</div>
								{/each}
								
								{#if server.players.length > 6}
									<div class="text-center py-2">
										<span class="text-slate-400 text-xs">
											+{server.players.length - 6} more players
										</span>
									</div>
								{/if}
							</div>
						</div>
					{:else}
						<div class="p-6 text-center">
							<p class="text-slate-400 text-sm">No players found</p>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

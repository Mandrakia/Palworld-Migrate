<script lang="ts">
	import { page } from '$app/stores';
	import type { PageData } from './$types';
	
	export let data: PageData;
	
	$: serverId = $page.params.id;
	$: worldData = data.serverData;
</script>

<div class="mb-8">
	<h1 class="text-2xl font-bold text-white mb-6">Admin Panel</h1>
	
	<!-- Admin Stats -->
	<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
		<div class="bg-slate-800 border border-slate-700 rounded-lg p-6">
			<div class="flex items-center">
				<div class="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
					<svg class="w-5 h-5 text-red-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
					</svg>
				</div>
				<div class="ml-4">
					<h3 class="text-lg font-medium text-white">Server Status</h3>
					<p class="text-sm text-green-400">Online</p>
				</div>
			</div>
		</div>

		<div class="bg-slate-800 border border-slate-700 rounded-lg p-6">
			<div class="flex items-center">
				<div class="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
					<svg class="w-5 h-5 text-blue-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"></path>
					</svg>
				</div>
				<div class="ml-4">
					<h3 class="text-lg font-medium text-white">Backups</h3>
					<p class="text-sm text-slate-400">{worldData?.server.backupCount || 0} available</p>
				</div>
			</div>
		</div>

		<div class="bg-slate-800 border border-slate-700 rounded-lg p-6">
			<div class="flex items-center">
				<div class="w-10 h-10 bg-yellow-600 rounded-lg flex items-center justify-center">
					<svg class="w-5 h-5 text-yellow-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
					</svg>
				</div>
				<div class="ml-4">
					<h3 class="text-lg font-medium text-white">Performance</h3>
					<p class="text-sm text-slate-400">Good</p>
				</div>
			</div>
		</div>

		<div class="bg-slate-800 border border-slate-700 rounded-lg p-6">
			<div class="flex items-center">
				<div class="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
					<svg class="w-5 h-5 text-purple-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
					</svg>
				</div>
				<div class="ml-4">
					<h3 class="text-lg font-medium text-white">Last Backup</h3>
					<p class="text-sm text-slate-400">2h ago</p>
				</div>
			</div>
		</div>
	</div>

	<!-- Admin Actions -->
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
		<!-- Server Management -->
		<div class="bg-slate-800 border border-slate-700 rounded-lg">
			<div class="px-6 py-4 border-b border-slate-700">
				<h2 class="text-lg font-medium text-white">Server Management</h2>
			</div>
			<div class="p-6 space-y-4">
				<button class="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
					Create Backup
				</button>
				<button class="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
					Restart Server
				</button>
				<button class="w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors">
					Update Server
				</button>
				<button class="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
					Stop Server
				</button>
			</div>
		</div>

		<!-- Player Management -->
		<div class="bg-slate-800 border border-slate-700 rounded-lg">
			<div class="px-6 py-4 border-b border-slate-700">
				<h2 class="text-lg font-medium text-white">Player Management</h2>
			</div>
			<div class="p-6 space-y-4">
				<button class="w-full px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors">
					Kick All Players
				</button>
				<button class="w-full px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors">
					Broadcast Message
				</button>
				<button class="w-full px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors">
					Ban Management
				</button>
				<button class="w-full px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors">
					Whitelist Management
				</button>
			</div>
		</div>
	</div>

	<!-- Server Logs Preview -->
	<div class="mt-8 bg-slate-800 border border-slate-700 rounded-lg">
		<div class="px-6 py-4 border-b border-slate-700">
			<h2 class="text-lg font-medium text-white">Recent Server Logs</h2>
		</div>
		<div class="p-6">
			<div class="bg-slate-900 rounded-lg p-4 font-mono text-sm">
				<div class="space-y-1 text-slate-300">
					<div class="text-green-400">[2025-01-07 10:30:25] Server started successfully</div>
					<div class="text-blue-400">[2025-01-07 10:31:02] Player "Alice" connected</div>
					<div class="text-blue-400">[2025-01-07 10:32:15] Player "Bob" connected</div>
					<div class="text-yellow-400">[2025-01-07 10:35:45] Auto-save completed</div>
					<div class="text-slate-400">[2025-01-07 10:40:12] Player "Alice" built structure at (123, 456)</div>
				</div>
			</div>
			<div class="mt-4 text-center">
				<button class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
					View Full Logs
				</button>
			</div>
		</div>
	</div>
</div>
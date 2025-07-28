<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { getGenderType } from '$lib/genderUtils';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Filter and sort state
	let hideOwned = $state(false);
	let sortBy = $state('CombiRank' as 'CombiRank' | 'TalentScore');
	let sortOrder = $state('asc' as 'asc' | 'desc');

	function goBackToCharacter() {
		goto(`/worlds/${data.worldId}/characters/${data.combinedId}`);
	}

	function getPalIconUrl(characterId?: string): string {
		if (!characterId) return '';
		return `/pals/T_${characterId}_icon_normal.png`;
	}

	function getGenderIcon(gender: string): string {
		const genderType = getGenderType(gender);
		if (genderType === 'male') return '/T_Icon_PanGender_Male.png';
		if (genderType === 'female') return '/T_Icon_PanGender_Female.png';
		return '';
	}

	function isOwned(resultCharacterId: string): boolean {
		return data.characterData.pals?.some(pal => pal.characterId === resultCharacterId) || false;
	}

	// Filtered and sorted results
	let filteredAndSortedResults = $derived(() => {
		let results = data.breedingResults;

		// Apply "hide owned" filter
		if (hideOwned) {
			results = results.filter(result => !isOwned(result.Result.Tribe.replace("EPalTribeID::","")));
		}

		// Sort results
		return results.sort((a, b) => {
			let valueA: number, valueB: number;
			
			if (sortBy === 'CombiRank') {
				valueA = a.Result.CombiRank;
				valueB = b.Result.CombiRank;
			} else {
				valueA = a.TalentScore;
				valueB = b.TalentScore;
			}

			if (sortOrder === 'asc') {
				return valueA - valueB;
			} else {
				return valueB - valueA;
			}
		});
	});

	function formatTalentScore(score: number): number {
		return Math.round(score * 100) / 100;
	}
</script>

<svelte:head>
	<title>Breeding Calculator - {data.characterData.name}</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
	<!-- Header -->
	<div class="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
			<div class="flex items-center justify-between">
				<div class="flex items-center space-x-4">
					<button
						onclick={goBackToCharacter}
						class="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
					>
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
						</svg>
						<span>Back to Character</span>
					</button>
					<div class="text-slate-500">•</div>
					<h1 class="text-2xl font-bold text-white">Breeding Calculator</h1>
				</div>
			</div>
		</div>
	</div>

	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<!-- Player Info -->
		<div class="mb-8 bg-slate-800 border border-slate-700 rounded-lg p-6">
			<div class="flex items-center space-x-4">
				<div class="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
					👤
				</div>
				<div>
					<h2 class="text-xl font-semibold text-white">{data.characterData.name}</h2>
					<div class="text-slate-400">Level {data.characterData.level} • {data.characterData.palCount} Pals</div>
				</div>
			</div>
		</div>

		<!-- Controls -->
		<div class="mb-8 bg-slate-800 border border-slate-700 rounded-lg p-6">
			<div class="flex flex-wrap items-center gap-6">
				<!-- Hide Owned Filter -->
				<div class="flex items-center space-x-2">
					<input
						type="checkbox"
						id="hideOwned"
						bind:checked={hideOwned}
						class="rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-800"
					/>
					<label for="hideOwned" class="text-slate-300">Hide already owned</label>
				</div>

				<!-- Sort Controls -->
				<div class="flex items-center space-x-4">
					<div class="flex items-center space-x-2">
						<label class="text-sm text-slate-400">Sort by:</label>
						<select 
							bind:value={sortBy}
							class="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-white focus:border-slate-500 focus:outline-none"
						>
							<option value="CombiRank">Combi Rank</option>
							<option value="TalentScore">Talent Score</option>
						</select>
					</div>

					<button
						onclick={() => sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'}
						class="flex items-center space-x-1 px-3 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white hover:bg-slate-600 transition-colors"
					>
						<span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
						<span>{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
					</button>
				</div>

				<!-- Results Count -->
				<div class="ml-auto text-sm text-slate-400">
					Showing {filteredAndSortedResults().length} of {data.breedingResults.length} combinations
				</div>
			</div>
		</div>

		<!-- Breeding Results -->
		{#if filteredAndSortedResults().length > 0}
			<div class="space-y-4">
				{#each filteredAndSortedResults() as result}
					<div class="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:bg-slate-750 transition-colors">
						<div class="grid grid-cols-1 lg:grid-cols-5 gap-6 items-center">
							<!-- Parent 1 -->
							<div class="flex items-center space-x-3">
								<div class="text-sm text-slate-400 font-medium mb-2 lg:hidden">Parent 1</div>
								<div class="flex items-center space-x-3">
									<div class="relative">
										<div class="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center overflow-hidden">
											<img 
												src={getPalIconUrl(result["Pal 1"].characterId)} 
												alt={result["Pal 1"].name}
												class="w-full h-full object-cover rounded-full"
												onerror={(event) => {
													const target = event.target as HTMLImageElement;
													if (target) {
														target.style.display = 'none';
														target.parentElement!.innerHTML = '🐾';
													}
												}}
											/>
										</div>
										{#if result["Pal 1"].gender}
											<div class="absolute -bottom-1 -right-1 w-4 h-4">
												<img src={getGenderIcon(result["Pal 1"].gender)} alt="Gender" class="w-4 h-4" />
											</div>
										{/if}
									</div>
									<div class="min-w-0">
										<div class="text-white font-medium text-sm truncate">
											{result["Pal 1"].displayName || result["Pal 1"].name}
										</div>
										<div class="text-xs text-slate-400">Lv.{result["Pal 1"].level}</div>
									</div>
								</div>
							</div>

							<!-- Parent 2 -->
							<div class="flex items-center space-x-3">
								<div class="text-sm text-slate-400 font-medium mb-2 lg:hidden">Parent 2</div>
								<div class="flex items-center space-x-3">
									<div class="relative">
										<div class="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center overflow-hidden">
											<img 
												src={getPalIconUrl(result["Pal 2"].characterId)} 
												alt={result["Pal 2"].name}
												class="w-full h-full object-cover rounded-full"
												onerror={(event) => {
													const target = event.target as HTMLImageElement;
													if (target) {
														target.style.display = 'none';
														target.parentElement!.innerHTML = '🐾';
													}
												}}
											/>
										</div>
										{#if result["Pal 2"].gender}
											<div class="absolute -bottom-1 -right-1 w-4 h-4">
												<img src={getGenderIcon(result["Pal 2"].gender)} alt="Gender" class="w-4 h-4" />
											</div>
										{/if}
									</div>
									<div class="min-w-0">
										<div class="text-white font-medium text-sm truncate">
											{result["Pal 2"].displayName || result["Pal 2"].name}
										</div>
										<div class="text-xs text-slate-400">Lv.{result["Pal 2"].level}</div>
									</div>
								</div>
							</div>

							<!-- Arrow -->
							<div class="flex justify-center lg:justify-center">
								<svg class="w-8 h-8 text-slate-500 rotate-90 lg:rotate-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
								</svg>
							</div>

							<!-- Result -->
							<div class="lg:col-span-2">
								<div class="flex items-center justify-between">
									<div class="flex items-center space-x-4">
										<div class="relative">
											<div class="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center overflow-hidden">
												<img 
													src={getPalIconUrl(result.Result.Tribe.replace("EPalTribeID::",""))}
													alt={result.Result.OverrideNameTextID}
													class="w-full h-full object-cover rounded-full"
													onerror={(event) => {
														const target = event.target as HTMLImageElement;
														if (target) {
															target.style.display = 'none';
															target.parentElement!.innerHTML = '🥚';
														}
													}}
												/>
											</div>
											{#if isOwned(result.Result.BPClass)}
												<div class="absolute -top-1 -right-1 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center border-2 border-white">
													<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
														<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
													</svg>
												</div>
											{/if}
										</div>
										<div class="flex-1 min-w-0">
											<h3 class="text-white font-semibold text-lg truncate">
												{result.Result.OverrideNameTextID}
											</h3>
											<div class="flex items-center space-x-4 text-sm text-slate-400">
												<span class="flex items-center space-x-1">
													<span class="text-blue-400">Rank:</span>
													<span class="{sortBy === 'CombiRank' ? 'text-blue-300 font-bold' : ''}">{result.Result.CombiRank}</span>
												</span>
												<span class="flex items-center space-x-1">
													<span class="text-purple-400">Talent:</span>
													<span class="{sortBy === 'TalentScore' ? 'text-purple-300 font-bold' : ''}">{formatTalentScore(result.TalentScore)}</span>
												</span>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="text-center py-12">
				<div class="text-slate-500 text-lg mb-2">No breeding combinations found</div>
				<div class="text-slate-400 text-sm">
					{#if hideOwned}
						Try unchecking "Hide already owned" to see all results.
					{:else}
						Make sure you have both male and female pals in your collection.
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
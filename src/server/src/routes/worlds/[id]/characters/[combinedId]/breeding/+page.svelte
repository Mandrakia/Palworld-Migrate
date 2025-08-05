<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { getGenderType } from '$lib/genderUtils';
	import PassiveSkill from '$lib/PassiveSkill.svelte';
	import CombinationDetails from '$lib/CombinationDetails.svelte';
	import type { BreedingSource, BreedingResult } from '$lib/interfaces/index.js';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Expanded state for result cards
	let expandedResults = $state(new Set<string>());
	
	// Expanded state for "All Combinations" sections (initially folded)
	let expandedCombinations = $state(new Set<string>());

	// Filter and sort state
	let hideOwned = $state(false);
	let sortBy = $state('combinations' as 'combinations' | 'palName');
	let sortOrder = $state('desc' as 'asc' | 'desc');

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

	function toggleExpanded(characterId: string) {
		if (expandedResults.has(characterId)) {
			expandedResults.delete(characterId);
		} else {
			expandedResults.add(characterId);
		}
		expandedResults = new Set(expandedResults);
	}

	function toggleCombinations(characterId: string) {
		if (expandedCombinations.has(characterId)) {
			expandedCombinations.delete(characterId);
		} else {
			expandedCombinations.add(characterId);
		}
		expandedCombinations = new Set(expandedCombinations);
	}

	// Convert the new API response format to our component format
	let processedResults = $derived(() => {
		const results: BreedingResult[] = [];
		
		for (const [characterId, combinations] of Object.entries(data.breedingResults)) {
			// Get pal name from first combination if available
			let palName = characterId;
			if (combinations.length > 0) {
				// Try to get a more readable name from the pal database or use characterId
				palName = characterId; // We might need to enhance this with proper pal name lookup
			}
			
			results.push({
				characterId,
				palName,
				combinations,
				isOwned: isOwned(characterId)
			});
		}

		return results;
	});

	// Filtered and sorted results
	let filteredAndSortedResults = $derived(() => {
		let results = processedResults();

		// Apply "hide owned" filter
		if (hideOwned) {
			results = results.filter(result => !result.isOwned);
		}

		// Sort results
		return results.sort((a, b) => {
			let valueA: number | string, valueB: number | string;
			
			if (sortBy === 'combinations') {
				valueA = a.combinations.length;
				valueB = b.combinations.length;
			} else {
				valueA = a.palName;
				valueB = b.palName;
			}

			if (typeof valueA === 'string' && typeof valueB === 'string') {
				if (sortOrder === 'asc') {
					return valueA.localeCompare(valueB);
				} else {
					return valueB.localeCompare(valueA);
				}
			} else {
				if (sortOrder === 'asc') {
					return (valueA as number) - (valueB as number);
				} else {
					return (valueB as number) - (valueA as number);
				}
			}
		});
	});


	// Get best combination for summary (highest combined talent scores)
	function getBestCombination(combinations: BreedingSource[]) {
		if (combinations.length === 0) return null;
		
		return combinations.reduce((best, current) => {
			const currentScore = (current["Pal 1"].talentHP || 0) + (current["Pal 1"].talentShot || 0) + (current["Pal 1"].talentDefense || 0) +
							   (current["Pal 2"].talentHP || 0) + (current["Pal 2"].talentShot || 0) + (current["Pal 2"].talentDefense || 0);
			const bestScore = (best["Pal 1"].talentHP || 0) + (best["Pal 1"].talentShot || 0) + (best["Pal 1"].talentDefense || 0) +
							 (best["Pal 2"].talentHP || 0) + (best["Pal 2"].talentShot || 0) + (best["Pal 2"].talentDefense || 0);
			
			return currentScore > bestScore ? current : best;
		});
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
							<option value="combinations">Combinations Count</option>
							<option value="palName">Pal Name</option>
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
					Showing {filteredAndSortedResults().length} of {processedResults().length} results
				</div>
			</div>
		</div>

		<!-- Breeding Results -->
		{#if filteredAndSortedResults().length > 0}
			<div class="space-y-4">
				{#each filteredAndSortedResults() as result}
					<div class="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
						<!-- Main Result Card -->
						<div 
							class="p-6 cursor-pointer hover:bg-slate-750 transition-colors"
							onclick={() => toggleExpanded(result.characterId)}
						>
							<div class="flex items-center justify-between">
								<div class="flex items-center space-x-4">
									<!-- Result Pal Icon -->
									<div class="relative">
										<div class="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center overflow-hidden">
											<img 
												src={getPalIconUrl(result.characterId)}
												alt={result.palName}
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
										{#if result.isOwned}
											<div class="absolute -top-1 -right-1 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center border-2 border-white">
												<svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
													<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
												</svg>
											</div>
										{/if}
									</div>

									<!-- Result Info -->
									<div class="flex-1 min-w-0">
										<h3 class="text-white font-semibold text-xl truncate">
											{result.palName}
										</h3>
										<div class="flex items-center space-x-4 text-sm text-slate-400">
											<span class="flex items-center space-x-1">
												<span class="text-blue-400">Combinations:</span>
												<span class="text-blue-300 font-bold">{result.combinations.length}</span>
											</span>
										</div>
									</div>
								</div>

								<!-- Expand/Collapse Icon -->
								<div class="flex items-center space-x-4">
									<svg 
										class="w-6 h-6 text-slate-400 transition-transform {expandedResults.has(result.characterId) ? 'rotate-180' : ''}"
										fill="none" 
										stroke="currentColor" 
										viewBox="0 0 24 24"
									>
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
									</svg>
								</div>
							</div>
						</div>

						<!-- Expanded Details -->
						{#if expandedResults.has(result.characterId)}
							<div class="border-t border-slate-700 bg-slate-800/50">
								<!-- Summary Section -->
								{#if result.combinations.length > 0}
									{@const bestCombo = getBestCombination(result.combinations)}
									{#if bestCombo}
										<div class="p-6 border-b border-slate-700">
											<h4 class="text-lg font-semibold text-white mb-4">Best Combination Summary</h4>
											<CombinationDetails combination={bestCombo} />
										</div>
									{/if}
								{/if}

								<!-- All Combinations -->
								<div class="border-t border-slate-700">
									<!-- Header with toggle -->
									<div 
										class="p-6 cursor-pointer hover:bg-slate-750 transition-colors flex items-center justify-between"
										onclick={() => toggleCombinations(result.characterId)}
									>
										<h4 class="text-lg font-semibold text-white">All Breeding Combinations ({result.combinations.length})</h4>
										<svg 
											class="w-5 h-5 text-slate-400 transition-transform {expandedCombinations.has(result.characterId) ? 'rotate-180' : ''}"
											fill="none" 
											stroke="currentColor" 
											viewBox="0 0 24 24"
										>
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
										</svg>
									</div>
									
									<!-- Collapsible content -->
									{#if expandedCombinations.has(result.characterId)}
										<div class="px-6 pb-6">
											<div class="space-y-3">
										{#each result.combinations as combo, index}
											<div class="bg-slate-700/30 rounded-lg p-4">
												<div class="grid grid-cols-1 lg:grid-cols-5 gap-4 items-center">
													<!-- Parent 1 -->
													<div class="flex items-center space-x-3">
														<div class="relative">
															<div class="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center overflow-hidden">
																<img 
																	src={getPalIconUrl(combo["Pal 1"].characterId)} 
																	alt={combo["Pal 1"].name}
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
															{#if combo["Pal 1"].gender}
																<div class="absolute -bottom-1 -right-1 w-4 h-4">
																	<img src={getGenderIcon(combo["Pal 1"].gender)} alt="Gender" class="w-4 h-4" />
																</div>
															{/if}
														</div>
														<div class="min-w-0">
															<div class="text-white font-medium text-sm truncate">
																{combo["Pal 1"].displayName || combo["Pal 1"].name}
															</div>
															<div class="text-xs text-slate-400">Lv.{combo["Pal 1"].level}</div>
														</div>
													</div>

													<!-- Parent 2 -->
													<div class="flex items-center space-x-3">
														<div class="relative">
															<div class="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center overflow-hidden">
																<img 
																	src={getPalIconUrl(combo["Pal 2"].characterId)} 
																	alt={combo["Pal 2"].name}
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
															{#if combo["Pal 2"].gender}
																<div class="absolute -bottom-1 -right-1 w-4 h-4">
																	<img src={getGenderIcon(combo["Pal 2"].gender)} alt="Gender" class="w-4 h-4" />
																</div>
															{/if}
														</div>
														<div class="min-w-0">
															<div class="text-white font-medium text-sm truncate">
																{combo["Pal 2"].displayName || combo["Pal 2"].name}
															</div>
															<div class="text-xs text-slate-400">Lv.{combo["Pal 2"].level}</div>
														</div>
													</div>

													<!-- Arrow -->
													<div class="flex justify-center">
														<svg class="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
															<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
														</svg>
													</div>

													<!-- Talents -->
													<div class="lg:col-span-2">
														<div class="grid grid-cols-3 gap-2 text-xs">
															<div class="text-center">
																<div class="text-slate-400">HP</div>
																<div class="text-red-400 font-bold">{Math.max(combo["Pal 1"].talentHP || 0, combo["Pal 2"].talentHP || 0)}</div>
															</div>
															<div class="text-center">
																<div class="text-slate-400">ATK</div>
																<div class="text-orange-400 font-bold">{Math.max(combo["Pal 1"].talentShot || 0, combo["Pal 2"].talentShot || 0)}</div>
															</div>
															<div class="text-center">
																<div class="text-slate-400">DEF</div>
																<div class="text-blue-400 font-bold">{Math.max(combo["Pal 1"].talentDefense || 0, combo["Pal 2"].talentDefense || 0)}</div>
															</div>
														</div>
													</div>
												</div>
											</div>
										{/each}
											</div>
										</div>
									{/if}
								</div>
							</div>
						{/if}
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
						Make sure you have pals in your collection to breed.
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
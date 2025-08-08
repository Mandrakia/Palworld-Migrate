<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { getGenderType } from '$lib/genderUtils';
	import { getWorkIcons } from '$lib/workSuitabilityUtils';
	import PassiveSkill from '$lib/PassiveSkill.svelte';
	import CombinationDetails from '$lib/CombinationDetails.svelte';
	import CharacterAutocomplete from '$lib/CharacterAutocomplete.svelte';
	import type { BreedingRouteResponse} from '$lib/interfaces';
	import { onMount } from 'svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Goal management
	let goals = $state<string[]>([]);
	let goalRoutes = $state<Record<string, BreedingRouteResponse>>({});
	let loadingGoals = $state<Set<string>>(new Set());
	let expandedGoals = $state(new Set<string>());

	// Load goals from localStorage on mount
	onMount(() => {
		const storageKey = `breeding-goals-${data.worldId}-${data.combinedId}`;
		const savedGoals = localStorage.getItem(storageKey);
		if (savedGoals) {
			goals = JSON.parse(savedGoals);
			// Load routes for existing goals
			for (const goal of goals) {
				loadGoalRoute(goal);
			}
		}
	});

	// Save goals to localStorage
	function saveGoals() {
		const storageKey = `breeding-goals-${data.worldId}-${data.combinedId}`;
		localStorage.setItem(storageKey, JSON.stringify(goals));
	}

	// Add a new goal
	function addGoal(characterId: string) {
		if (!characterId || goals.includes(characterId)) return;
		
		goals = [...goals, characterId];
		saveGoals();
		loadGoalRoute(characterId);
	}

	// Handle character selection from autocomplete
	function handleCharacterSelect(characterId: string, character: any) {
		addGoal(characterId);
	}

	// Remove a goal
	function removeGoal(characterId: string) {
		goals = goals.filter(g => g !== characterId);
		delete goalRoutes[characterId];
		goalRoutes = { ...goalRoutes };
		saveGoals();
	}

	// Load breeding route for a goal
	async function loadGoalRoute(characterId: string) {
		loadingGoals.add(characterId);
		loadingGoals = new Set(loadingGoals);

		try {
			const response = await fetch(`/api/worlds/${data.worldId}/characters/${data.combinedId}/breeding-route?characterId=${encodeURIComponent(characterId)}&maxDepth=3`);
			if (response.ok) {
				const route: BreedingRouteResponse = await response.json();
				goalRoutes[characterId] = route;
				goalRoutes = { ...goalRoutes };
			} else {
				console.error(`Failed to load route for ${characterId}`);
			}
		} catch (error) {
			console.error(`Error loading route for ${characterId}:`, error);
		} finally {
			loadingGoals.delete(characterId);
			loadingGoals = new Set(loadingGoals);
		}
	}

	// Toggle goal expansion
	function toggleGoal(characterId: string) {
		console.log('Toggling goal:', characterId, 'currently expanded:', expandedGoals.has(characterId));
		const newExpandedGoals = new Set(expandedGoals);
		if (newExpandedGoals.has(characterId)) {
			newExpandedGoals.delete(characterId);
		} else {
			newExpandedGoals.add(characterId);
		}
		expandedGoals = newExpandedGoals;
		console.log('After toggle:', expandedGoals);
	}

	// Expanded state for result cards
	let expandedResults = $state(new Set<string>());
	
	// Expanded state for "All Combinations" sections (initially folded)
	let expandedCombinations = $state(new Set<string>());

	// Filter and sort state
	let hideOwned = $state(false);
	let sortBy = $state('combinations' as 'combinations' | 'palName' | 'work' | 'atk');
    $effect(()=>{
        // Auto-set optimization mode based on sort type
        if (sortBy === 'work') {
            currentOptimizationMode = 'work';
        } else if (sortBy === 'atk') {
            currentOptimizationMode = 'combat';
        }
    });
	let sortOrder = $state('desc' as 'asc' | 'desc');
	let currentOptimizationMode = $state('combat' as 'combat' | 'work');

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

	// Convert the new API response format to simple array for display
	let processedResults = $derived(() => {
		return Object.values(data.breedingResults).map(resultData => ({
			...resultData,
			isOwned: isOwned(resultData.characterId)
		}));
	});

	// Filtered and sorted results
	let filteredAndSortedResults = $derived(() => {
		let results = processedResults();

		// Apply "hide owned" filter
		if (hideOwned) {
			results = results.filter(result => !result.isOwned);
		}

		// Sort results using pre-calculated data
		return results.sort((a, b) => {
			let valueA: number | string, valueB: number | string;
			
			if (sortBy === 'combinations') {
				valueA = a.combinationCount;
				valueB = b.combinationCount;
			} else if (sortBy === 'work') {
				valueA = a.workOptimization.score;
				valueB = b.workOptimization.score;
			} else if (sortBy === 'atk') {
				valueA = a.combatOptimization.stats.attack;
				valueB = b.combatOptimization.stats.attack;
			} else {
				valueA = a.displayName;
				valueB = b.displayName;
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
							<option value="work">Work</option>
							<option value="atk">Atk</option>
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

		<!-- Goals Section -->
		<div class="mb-8 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
			<div class="p-6 border-b border-slate-700">
				<h2 class="text-xl font-semibold text-white mb-4">🎯 WorkSpeed Goals</h2>
				
				<!-- Add Goal Input -->
				<div class="mb-6">
					<CharacterAutocomplete 
						placeholder="Search and select a character for WorkSpeed optimization..."
						onSelect={handleCharacterSelect}
					/>
					<div class="text-xs text-slate-400 mt-2">
						Select a character to see the optimal breeding route for maximum WorkSpeed
					</div>
				</div>

				<!-- Goals List -->
				{#if goals.length > 0}
					<div class="space-y-4">
						{#each goals as goalId}
							<div class="bg-slate-700/30 rounded-lg overflow-hidden">
								<!-- Goal Header -->
								<div 
									class="p-4 cursor-pointer hover:bg-slate-700/50 transition-colors flex items-center justify-between"
									onclick={() => toggleGoal(goalId)}
								>
									<div class="flex items-center space-x-4">
										<div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center overflow-hidden">
											<img 
												src={getPalIconUrl(goalId)}
												alt={goalId}
												class="w-full h-full object-cover rounded-full"
												onerror={(event) => {
													const target = event.target as HTMLImageElement;
													if (target) {
														target.style.display = 'none';
														target.parentElement!.innerHTML = '🎯';
													}
												}}
											/>
										</div>
										<div>
											<h3 class="text-white font-semibold">{goalId}</h3>
											{#if loadingGoals.has(goalId)}
												<div class="text-blue-400 text-sm">Loading route...</div>
											{:else if goalRoutes[goalId]}
												<div class="text-green-400 text-sm">
													{goalRoutes[goalId].totalGenerations} step(s) • Work Speed: {goalRoutes[goalId].finalWorkSpeed}
												</div>
											{:else}
												<div class="text-red-400 text-sm">No route found</div>
											{/if}
										</div>
									</div>

									<div class="flex items-center space-x-2">
										<button
											onclick={(e) => { 
												e.stopPropagation(); 
												e.preventDefault();
												removeGoal(goalId); 
											}}
											class="text-red-400 hover:text-red-300 p-2 hover:bg-red-900/20 rounded"
											title="Remove goal"
										>
											<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
											</svg>
										</button>
										<svg 
											class="w-5 h-5 text-slate-400 transition-transform {expandedGoals.has(goalId) ? 'rotate-180' : ''}"
											fill="none" 
											stroke="currentColor" 
											viewBox="0 0 24 24"
										>
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
										</svg>
									</div>
								</div>

								<!-- Expanded Goal Details -->
								{#if expandedGoals.has(goalId)}
									{#if goalRoutes[goalId]}
										{@const route = goalRoutes[goalId]}
									<div class="border-t border-slate-700 p-6">
										<!-- Final Stats -->
										<div class="mb-6 bg-slate-800/50 rounded-lg p-4">
											<h4 class="text-white font-semibold mb-3">🎯 Target Result</h4>
											<div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
												<div class="text-center">
													<div class="text-yellow-400 text-xs">🔨 Work Speed</div>
													<div class="text-white font-bold text-lg">{route.finalWorkSpeed}</div>
												</div>
											</div>
											
											<!-- Required Passives -->
											{#if route.requiredPassives?.length > 0}
												<div>
													<div class="text-slate-400 text-xs mb-2">Required Passives:</div>
													<div class="flex flex-wrap gap-2">
														{#each route.requiredPassives as skill}
															{#if skill && skill.Name}
																<PassiveSkill 
																	{skill} 
																	size="sm"
																	showDescription={false}
																/>
															{/if}
														{/each}
													</div>
												</div>
											{/if}
										</div>

										<!-- Breeding Steps -->
										{#if route.breedingSteps?.length > 0}
											<div class="space-y-4">
												<h4 class="text-white font-semibold">📋 Breeding Steps ({route.breedingSteps.length})</h4>
												{#each route.breedingSteps as step, index}
													<div class="bg-slate-800/50 rounded-lg p-4">
														<div class="flex items-center justify-between mb-3">
															<div class="text-slate-400 text-sm">Step {index + 1} (Gen {step.generation})</div>
															<div class="text-green-400 text-sm">
																{step.passiveProbability ? Math.round(step.passiveProbability * 100) : 100}% chance
															</div>
														</div>

														<div class="grid grid-cols-1 lg:grid-cols-5 gap-4 items-center">
															<!-- Parent 1 -->
															<div class="flex items-center space-x-3">
																<div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center overflow-hidden">
																	<img 
																		src={getPalIconUrl(step.parent1.characterId)} 
																		alt={step.parent1.name}
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
																<div class="min-w-0">
																	<div class="text-white font-medium text-sm truncate">
																		{step.parent1.name}
																	</div>
																	<div class="text-xs text-slate-400">
																		{step.parent1.characterId} • Lv.{step.parent1.level}
																	</div>
																</div>
															</div>

															<!-- + Symbol -->
															<div class="flex justify-center">
																<span class="text-slate-500 text-2xl">+</span>
															</div>

															<!-- Parent 2 -->
															<div class="flex items-center space-x-3">
																<div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center overflow-hidden">
																	<img 
																		src={getPalIconUrl(step.parent2.characterId)} 
																		alt={step.parent2.name}
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
																<div class="min-w-0">
																	<div class="text-white font-medium text-sm truncate">
																		{step.parent2.name}
																	</div>
																	<div class="text-xs text-slate-400">
																		{step.parent2.characterId} • Lv.{step.parent2.level}
																	</div>
																</div>
															</div>

															<!-- Arrow -->
															<div class="flex justify-center">
																<svg class="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
																	<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
																</svg>
															</div>

															<!-- Result -->
															<div class="flex items-center space-x-3">
																<div class="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-full flex items-center justify-center overflow-hidden">
																	<img 
																		src={getPalIconUrl(step.result.characterId)} 
																		alt={step.result.characterId}
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
																<div class="min-w-0">
																	<div class="text-white font-medium text-sm truncate">
																		{step.result.name}
																	</div>
																	<div class="text-xs text-green-400">
																		Work Speed: {step.result.workSpeedScore}
																	</div>
																</div>
															</div>
														</div>

														<!-- Expected Passives -->
														{#if step.result.passives?.length > 0}
															<div class="mt-3 pt-3 border-t border-slate-700">
																<div class="text-slate-400 text-xs mb-2">Expected Passives:</div>
																<div class="flex flex-wrap gap-1">
																	{#each step.result.passives as skill}
																		{#if skill}
																			<PassiveSkill 
																				{skill} 
																				size="sm"
																				showDescription={false}
																			/>
																		{/if}
																	{/each}
																</div>
															</div>
														{/if}
													</div>
												{/each}
											</div>
										{:else}
											<div class="text-center py-6 text-slate-400">
												No breeding steps required - you may already have optimal {goalId}
											</div>
										{/if}
									</div>
									{:else}
										<div class="border-t border-slate-700 p-6">
											<div class="text-center py-6 text-slate-400">
												{#if loadingGoals.has(goalId)}
													<div class="text-blue-400">Loading breeding route...</div>
												{:else}
													<div class="text-red-400">No route found or failed to load</div>
												{/if}
											</div>
										</div>
									{/if}
								{/if}
							</div>
						{/each}
					</div>
				{:else}
					<div class="text-center py-8 text-slate-400">
						<div class="text-lg mb-2">No goals set</div>
						<div class="text-sm">Add a character ID above to see the optimal WorkSpeed breeding route</div>
					</div>
				{/if}
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
												alt={result.displayName}
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
											{result.displayName}
										</h3>
										<div class="flex items-center space-x-4 text-sm text-slate-400 mb-2">
											<span class="flex items-center space-x-1">
												<span class="text-blue-400">Combinations:</span>
												<span class="text-blue-300 font-bold">{result.combinationCount}</span>
											</span>
										</div>
										<!-- Work Suitabilities -->
										{#if result.workSuitabilities && getWorkIcons(result.workSuitabilities).length > 0}
											{@const workIcons = getWorkIcons(result.workSuitabilities)}
											<div class="flex flex-wrap gap-2 mt-2">
												{#each workIcons as work}
													<div 
														class="flex items-center space-x-1 bg-slate-700/50 rounded px-2 py-1 text-xs"
														title={work.name}
													>
														<img 
															src={work.icon} 
															alt={work.name}
															class="w-4 h-4"
														/>
														<span class="text-yellow-400 font-bold">{work.value}</span>
													</div>
												{/each}
											</div>
										{/if}
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
								{#if result.combinationCount > 0}
									{@const optimization = currentOptimizationMode === 'combat' ? result.combatOptimization : result.workOptimization}
									<div class="p-6 border-b border-slate-700">
										<div class="flex items-center justify-between mb-4">
											<h4 class="text-lg font-semibold text-white">
												Best {currentOptimizationMode === 'combat' ? 'Combat' : 'Work'} Build (Level 30)
											</h4>
											
											<!-- Per-result optimization selector -->
											<div class="flex bg-slate-700 border border-slate-600 rounded-lg overflow-hidden">
												<button
													onclick={() => currentOptimizationMode = 'combat'}
													class="px-3 py-1 text-xs font-medium transition-colors {currentOptimizationMode === 'combat' ? 'bg-red-600 text-white' : 'text-slate-300 hover:bg-slate-600'}"
												>
													⚔️ Combat
												</button>
												<button
													onclick={() => currentOptimizationMode = 'work'}
													class="px-3 py-1 text-xs font-medium transition-colors {currentOptimizationMode === 'work' ? 'bg-yellow-600 text-white' : 'text-slate-300 hover:bg-slate-600'}"
												>
													🔨 Work
												</button>
											</div>
										</div>
										
										<!-- Best Possible Stats -->
										<div class="mb-6 bg-slate-700/30 rounded-lg p-4">
											<div class="text-sm text-slate-400 mb-3">Best Possible Stats with Optimal Passives:</div>
											<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
												<!-- HP -->
												<div class="text-center">
													<div class="text-red-400 text-xs">❤️ HP</div>
													<div class="text-white font-bold text-lg">{optimization.stats.hp}</div>
												</div>
												<!-- ATK -->
												<div class="text-center">
													<div class="text-orange-400 text-xs">⚔️ ATK</div>
													<div class="text-white font-bold text-lg">{optimization.stats.attack}</div>
												</div>
												<!-- DEF -->
												<div class="text-center">
													<div class="text-blue-400 text-xs">🛡️ DEF</div>
													<div class="text-white font-bold text-lg">{optimization.stats.defense}</div>
												</div>
												<!-- CRAFT -->
												<div class="text-center">
													<div class="text-yellow-400 text-xs">🔨 CRAFT</div>
													<div class="text-white font-bold text-lg">{Math.round(optimization.stats.craftSpeed)}</div>
												</div>
											</div>
											
											<!-- Score -->
											<div class="mt-4 text-center">
												<div class="text-slate-400 text-xs">
													{currentOptimizationMode === 'combat' ? 'Combat Improvement' : 'Work Score'}:
												</div>
												<div class="text-green-400 font-bold text-lg">
													{#if currentOptimizationMode === 'combat'}
														{result.combatOptimization.improvementPercentage}%
													{:else}
														{optimization.score}
													{/if}
												</div>
											</div>

											<!-- Best Passives -->
											{#if optimization.bestPassives && optimization.bestPassives.length > 0}
												<div class="mt-4">
													<div class="text-slate-400 text-xs mb-2">Required Passive Skills:</div>
													<div class="flex flex-wrap gap-2">
														{#each optimization.bestPassives as skill}
															<PassiveSkill 
																{skill} 
																size="sm"
																showDescription={false}
															/>
														{/each}
													</div>
												</div>
											{/if}
										</div>

										<CombinationDetails combination={optimization.bestCombination} />
									</div>
								{/if}

								<!-- All Combinations -->
								<div class="border-t border-slate-700">
									<!-- Header with toggle -->
									<div 
										class="p-6 cursor-pointer hover:bg-slate-750 transition-colors flex items-center justify-between"
										onclick={() => toggleCombinations(result.characterId)}
									>
										<h4 class="text-lg font-semibold text-white">All Breeding Combinations ({result.combinationCount})</h4>
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
										{#each result.allCombinations as combo, index}
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
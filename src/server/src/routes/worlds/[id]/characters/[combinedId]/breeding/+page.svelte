<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { getGenderType } from '$lib/genderUtils';
	import { getWorkIcons } from '$lib/workSuitabilityUtils';
	import PassiveSkill from '$lib/PassiveSkill.svelte';
	import CombinationDetails from '$lib/CombinationDetails.svelte';
	import CharacterAutocomplete from '$lib/CharacterAutocomplete.svelte';
	import GoalSection from '$lib/GoalSection.svelte';
	import BreedingStepTooltip from '$lib/BreedingStepTooltip.svelte';
	import type { BreedingRoute } from '$lib/breedingHelper';
	import { onMount } from 'svelte';
	import { palDatabase, palPassiveDatabase } from '$lib/palDatabase';
	

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Goal management
	let goals = $state<{ characterId: string; mode: string }[]>([]);
	let goalRoutes = $state<Record<string, BreedingRoute>>({});
	let loadingGoals = $state<Set<string>>(new Set());
	let expandedGoals = $state(new Set<string>());

	// Tooltip state for breeding steps
	let hoveredStep = $state<{ goalKey: string; stepIndex: number } | null>(null);
	let tooltipPosition = $state({ x: 0, y: 0 });

	function goalKey(characterId: string, mode: string) {
		return `${characterId}:${mode}`;
	}

	// Load goals and routes from localStorage on mount
	onMount(() => {
		const storageKey = `breeding-goals-${data.worldId}-${data.combinedId}`;
		const routesStorageKey = `breeding-routes-${data.worldId}-${data.combinedId}`;
		
		const savedGoals = localStorage.getItem(storageKey);
		const savedRoutes = localStorage.getItem(routesStorageKey);
		
		if (savedGoals) {
			goals = JSON.parse(savedGoals);
		}
		
		if (savedRoutes) {
			goalRoutes = JSON.parse(savedRoutes);
		}
		
		// Load routes for goals that don't have cached routes
		for (const goal of goals) {
			const key = goalKey(goal.characterId, goal.mode);
			if (!goalRoutes[key]) {
				loadGoalRoute(goal.characterId, goal.mode);
			}
		}
	});

	// Save goals to localStorage
	function saveGoals() {
		const storageKey = `breeding-goals-${data.worldId}-${data.combinedId}`;
		localStorage.setItem(storageKey, JSON.stringify(goals));
	}

	// Save routes to localStorage
	function saveRoutes() {
		const routesStorageKey = `breeding-routes-${data.worldId}-${data.combinedId}`;
		localStorage.setItem(routesStorageKey, JSON.stringify(goalRoutes));
	}

	// Add a new goal
	function addGoal(characterId: string, mode: string) {
		if (!characterId || goals.find(a=> a.characterId === characterId && a.mode === mode)) return;
		
		goals = [...goals, { characterId, mode }];
		saveGoals();
		loadGoalRoute(characterId, mode);
	}

	// Handle character selection from autocomplete
	function handleCharacterSelect(characterId: string, mode: string = 'work') {
		addGoal(characterId, mode);
	}

	// Remove a goal
	function removeGoal(characterId: string, mode: string) {
		goals = goals.filter(g => g.characterId !== characterId || g.mode !== mode);
		const key = goalKey(characterId, mode);
		delete goalRoutes[key];
		goalRoutes = { ...goalRoutes };
		saveGoals();
		saveRoutes();
	}

	// Refresh all goal routes
	async function refreshAllGoals() {
		for (const goal of goals) {
			await loadGoalRoute(goal.characterId, goal.mode);
		}
	}

	// Refresh goals by mode
	async function refreshGoalsByMode(mode: string) {
		const modeGoals = goals.filter(g => g.mode === mode);
		for (const goal of modeGoals) {
			await loadGoalRoute(goal.characterId, goal.mode);
		}
	}

	// Handle mouse events for tooltips
	function handleStepMouseEnter(event: MouseEvent, goalKey: string, stepIndex: number) {
		const rect = (event.target as HTMLElement).getBoundingClientRect();
		tooltipPosition = { x: rect.left + rect.width / 2, y: rect.top - 10 };
		hoveredStep = { goalKey, stepIndex };
	}

	function handleStepMouseLeave() {
		hoveredStep = null;
	}

	// Get pal data for tooltip
	function getPalData(tribeId: string) {
		return palDatabase[tribeId] || { name: tribeId, talents: {}, passives: [] };
	}

	// Load breeding route for a goal
	async function loadGoalRoute(characterId: string, mode: string = 'work') {
		const key = goalKey(characterId, mode);
		loadingGoals.add(key);
		loadingGoals = new Set(loadingGoals);

		try {
			const response = await fetch(`/api/worlds/${data.worldId}/characters/${data.combinedId}/breeding-new?characterId=${encodeURIComponent(characterId)}&mode=${mode}`);
			if (response.ok) {
				const route: BreedingRoute = await response.json();
				goalRoutes[key] = route;
				goalRoutes = { ...goalRoutes };
				saveRoutes(); // Save to localStorage
			} else {
				console.error(`Failed to load route for ${characterId}`);
			}
		} catch (error) {
			console.error(`Error loading route for ${characterId}:`, error);
		} finally {
			loadingGoals.delete(key);
			loadingGoals = new Set(loadingGoals);
		}
	}

	// Toggle goal expansion
	function toggleGoal(goal: { characterId: string; mode: string }) {
		const key = goalKey(goal.characterId, goal.mode);
		const newExpandedGoals = new Set(expandedGoals);
		if (newExpandedGoals.has(key)) {
			newExpandedGoals.delete(key);
		} else {
			newExpandedGoals.add(key);
		}
		expandedGoals = newExpandedGoals;
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

<!-- Tooltip using reusable component -->
{#if hoveredStep}
	{@const route = goalRoutes[hoveredStep.goalKey]}
	{@const step = route?.steps[hoveredStep.stepIndex]}
	{#if step}
		<BreedingStepTooltip 
			{step}
			position={tooltipPosition}
			{getPalIconUrl}
		/>
	{/if}
{/if}

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
		<GoalSection
			title="WorkSpeed Goals"
			emoji="🎯"
			mode="work"
			placeholder="Search and select a character for WorkSpeed optimization..."
			description="Select a character to see the optimal breeding route for maximum WorkSpeed"
			{goals}
			{goalRoutes}
			{loadingGoals}
			{expandedGoals}
			{hoveredStep}
			{tooltipPosition}
			onAddGoal={handleCharacterSelect}
			onRemoveGoal={removeGoal}
			onToggleGoal={toggleGoal}
			onRefreshGoals={refreshGoalsByMode}
			onStepMouseEnter={handleStepMouseEnter}
			onStepMouseLeave={handleStepMouseLeave}
			{goalKey}
			{getPalIconUrl}
		/>




		<!-- Combat Goals Section -->
		<GoalSection
			title="Combat Goals"
			emoji="⚔️"
			mode="combat"
			placeholder="Search and select a character for Combat optimization..."
			description="Select a character to see the optimal breeding route for maximum Combat effectiveness"
			{goals}
			{goalRoutes}
			{loadingGoals}
			{expandedGoals}
			{hoveredStep}
			{tooltipPosition}
			onAddGoal={handleCharacterSelect}
			onRemoveGoal={removeGoal}
			onToggleGoal={toggleGoal}
			onRefreshGoals={refreshGoalsByMode}
			onStepMouseEnter={handleStepMouseEnter}
			onStepMouseLeave={handleStepMouseLeave}
			{goalKey}
			{getPalIconUrl}
		/>




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
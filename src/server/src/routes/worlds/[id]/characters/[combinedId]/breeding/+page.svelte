<script lang="ts">
	import type { PageData } from './$types';
	import { goto } from '$app/navigation';
	import { getGenderType } from '$lib/genderUtils';
	import PassiveSkill from '$lib/PassiveSkill.svelte';
	import CombinationDetails from '$lib/CombinationDetails.svelte';
	import { GetPalStats } from '$lib/stats';
	import type { BreedingSource, BreedingResult, PassiveSkill as PassiveSkillType } from '$lib/interfaces/index.js';

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
	let optimizationModes = $state(new Map<string, 'combat' | 'work'>());

	function goBackToCharacter() {
		goto(`/worlds/${data.worldId}/characters/${data.combinedId}`);
	}

	function getOptimizationMode(characterId: string): 'combat' | 'work' {
		return optimizationModes.get(characterId) || 'combat';
	}

	function setOptimizationMode(characterId: string, mode: 'combat' | 'work') {
		optimizationModes.set(characterId, mode);
		optimizationModes = new Map(optimizationModes); // Trigger reactivity
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
		
		for (const [characterId, resultData] of Object.entries(data.breedingResults)) {
			results.push({
				characterId: resultData.characterId,
				palName: resultData.displayName,
				combinations: resultData.combinations,
				isOwned: isOwned(resultData.characterId)
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


	// Generate all possible passive skill combinations (0 to 4 skills from parent pool)
	function generatePassiveCombinations(parent1Passives: PassiveSkillType[], parent2Passives: PassiveSkillType[]): PassiveSkillType[][] {
		// Combine all passives from both parents and remove duplicates based on Id
		const allPassives = [...parent1Passives, ...parent2Passives];
		const uniquePassives = allPassives.filter((passive, index, self) => 
			index === self.findIndex(p => p.Id === passive.Id)
		);

		const combinations: PassiveSkillType[][] = [];
		
		// Generate all combinations from 0 to min(4, totalUniquePassives)
		const maxPassives = Math.min(4, uniquePassives.length);
		
		// Start with empty combination
		combinations.push([]);
		
		// Generate combinations of each size
		for (let size = 1; size <= maxPassives; size++) {
			generateCombinationsOfSize(uniquePassives, size, 0, [], combinations);
		}
		
		return combinations;
	}

	function generateCombinationsOfSize(
		passives: PassiveSkillType[], 
		size: number, 
		start: number, 
		current: PassiveSkillType[], 
		results: PassiveSkillType[][]
	): void {
		if (current.length === size) {
			results.push([...current]);
			return;
		}
		
		for (let i = start; i < passives.length; i++) {
			current.push(passives[i]);
			generateCombinationsOfSize(passives, size, i + 1, current, results);
			current.pop();
		}
	}

	// Calculate the best possible stats for a result character at level 30 with max talents
	function calculateBestPossibleStats(
		resultCharacterId: string, 
		combinations: BreedingSource[], 
		mode: 'combat' | 'work'
	): { stats: any, score: number, bestPassives: PassiveSkillType[] } {
		let bestScore = -Infinity;
		let bestStats = null;
		let bestPassives: PassiveSkillType[] = [];
		
		// Try each breeding combination
		for (const combo of combinations) {
			// Get max talents from parents
			const maxTalentHP = Math.max(combo["Pal 1"].talentHP || 0, combo["Pal 2"].talentHP || 0);
			const maxTalentShot = Math.max(combo["Pal 1"].talentShot || 0, combo["Pal 2"].talentShot || 0);
			const maxTalentDefense = Math.max(combo["Pal 1"].talentDefense || 0, combo["Pal 2"].talentDefense || 0);
			
			// Get parent passives
			const parent1Passives = combo["Pal 1"].passiveSkills || [];
			const parent2Passives = combo["Pal 2"].passiveSkills || [];
			
			// Generate all possible passive combinations
			const passiveCombinations = generatePassiveCombinations(parent1Passives, parent2Passives);
			
			// Test each passive combination
			for (const passives of passiveCombinations) {
				try {
					const stats = GetPalStats(
						resultCharacterId, 
						maxTalentHP, 
						maxTalentShot, 
						maxTalentDefense, 
						passives, 
						30, // Level 30
						0  // Max friendship rank
					);
					
					let score: number;
					if (mode === 'combat') {
						// Calculate what the base stats would be without talents/passives for comparison
						const baseStats = GetPalStats(resultCharacterId, 0, 0, 0, [], 30, 0);
						
						// Calculate boost coefficients for each stat
						const hpCoeff = stats.hp / baseStats.hp;
						const attackCoeff = stats.attack / baseStats.attack;
						const defenseCoeff = stats.defense / baseStats.defense;
						
						// Combat score: weighted average of boost coefficients (Attack gets 1.2x weight)
						score = (hpCoeff + attackCoeff * 1.2 + defenseCoeff) / 3.2;
					} else {
						// Work score: just maximize craft speed
						score = stats.craftSpeed;
					}
					
					if (score > bestScore) {
						bestScore = score;
						bestStats = stats;
						bestPassives = passives;
					}
				} catch (error) {
					// Skip if GetPalStats fails for this character
					console.warn(`Failed to calculate stats for ${resultCharacterId}:`, error);
				}
			}
		}
		
		return { 
			stats: bestStats || { hp: 0, attack: 0, defense: 0, craftSpeed: 0 }, 
			score: bestScore === -Infinity ? 0 : bestScore,
			bestPassives 
		};
	}

	// Get best combination for summary using new optimization system
	function getBestCombination(combinations: BreedingSource[], resultCharacterId: string, mode: 'combat' | 'work') {
		if (combinations.length === 0) return null;
		
		// Find the combination that can produce the best optimized stats
		return combinations.reduce((best, current) => {
			// Calculate best possible stats for current combination
			const currentBestStats = calculateBestPossibleStatsForCombination(resultCharacterId, current, mode);
			const bestBestStats = calculateBestPossibleStatsForCombination(resultCharacterId, best, mode);
			
			return currentBestStats.score > bestBestStats.score ? current : best;
		});
	}

	// Helper function to calculate best stats for a single breeding combination
	function calculateBestPossibleStatsForCombination(
		resultCharacterId: string, 
		combination: BreedingSource, 
		mode: 'combat' | 'work'
	): { stats: any, score: number, bestPassives: PassiveSkillType[] } {
		// Get max talents from parents
		const maxTalentHP = Math.max(combination["Pal 1"].talentHP || 0, combination["Pal 2"].talentHP || 0);
		const maxTalentShot = Math.max(combination["Pal 1"].talentShot || 0, combination["Pal 2"].talentShot || 0);
		const maxTalentDefense = Math.max(combination["Pal 1"].talentDefense || 0, combination["Pal 2"].talentDefense || 0);
		
		// Get parent passives
		const parent1Passives = combination["Pal 1"].passiveSkills || [];
		const parent2Passives = combination["Pal 2"].passiveSkills || [];
		
		// Generate all possible passive combinations
		const passiveCombinations = generatePassiveCombinations(parent1Passives, parent2Passives);
		
		let bestScore = -Infinity;
		let bestStats = null;
		let bestPassives: PassiveSkillType[] = [];
		
		// Test each passive combination for this specific breeding pair
		for (const passives of passiveCombinations) {
			try {
				const stats = GetPalStats(
					resultCharacterId, 
					maxTalentHP, 
					maxTalentShot, 
					maxTalentDefense, 
					passives, 
					30, // Level 30
					10  // Max friendship rank
				);
				
				let score: number;
				if (mode === 'combat') {
					// Calculate what the base stats would be without talents/passives for comparison
					const baseStats = GetPalStats(resultCharacterId, 0, 0, 0, [], 30, 10);
					
					// Calculate boost coefficients for each stat
					const hpCoeff = stats.hp / baseStats.hp;
					const attackCoeff = stats.attack / baseStats.attack;
					const defenseCoeff = stats.defense / baseStats.defense;
					
					// Combat score: weighted average of boost coefficients (Attack gets 1.2x weight)
					score = (hpCoeff + attackCoeff * 1.2 + defenseCoeff) / 3.2;
				} else {
					// Work score: maximize craft speed
					score = stats.craftSpeed;
				}
				
				if (score > bestScore) {
					bestScore = score;
					bestStats = stats;
					bestPassives = passives;
				}
			} catch (error) {
				// Skip if GetPalStats fails for this character
				console.warn(`Failed to calculate stats for ${resultCharacterId}:`, error);
			}
		}
		
		return { 
			stats: bestStats || { hp: 0, attack: 0, defense: 0, craftSpeed: 0 }, 
			score: bestScore === -Infinity ? 0 : bestScore,
			bestPassives 
		};
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
									{@const currentMode = getOptimizationMode(result.characterId)}
									{@const bestCombo = getBestCombination(result.combinations, result.characterId, currentMode)}
									{@const bestPossibleStats = calculateBestPossibleStats(result.characterId, result.combinations, currentMode)}
									{#if bestCombo}
										<div class="p-6 border-b border-slate-700">
											<div class="flex items-center justify-between mb-4">
												<h4 class="text-lg font-semibold text-white">
													Best {currentMode === 'combat' ? 'Combat' : 'Work'} Build (Level 30)
												</h4>
												
												<!-- Per-result optimization selector -->
												<div class="flex bg-slate-700 border border-slate-600 rounded-lg overflow-hidden">
													<button
														onclick={() => setOptimizationMode(result.characterId, 'combat')}
														class="px-3 py-1 text-xs font-medium transition-colors {currentMode === 'combat' ? 'bg-red-600 text-white' : 'text-slate-300 hover:bg-slate-600'}"
													>
														⚔️ Combat
													</button>
													<button
														onclick={() => setOptimizationMode(result.characterId, 'work')}
														class="px-3 py-1 text-xs font-medium transition-colors {currentMode === 'work' ? 'bg-yellow-600 text-white' : 'text-slate-300 hover:bg-slate-600'}"
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
														<div class="text-white font-bold text-lg">{bestPossibleStats.stats.hp}</div>
													</div>
													<!-- ATK -->
													<div class="text-center">
														<div class="text-orange-400 text-xs">⚔️ ATK</div>
														<div class="text-white font-bold text-lg">{bestPossibleStats.stats.attack}</div>
													</div>
													<!-- DEF -->
													<div class="text-center">
														<div class="text-blue-400 text-xs">🛡️ DEF</div>
														<div class="text-white font-bold text-lg">{bestPossibleStats.stats.defense}</div>
													</div>
													<!-- CRAFT -->
													<div class="text-center">
														<div class="text-yellow-400 text-xs">🔨 CRAFT</div>
														<div class="text-white font-bold text-lg">{Math.round(bestPossibleStats.stats.craftSpeed)}</div>
													</div>
												</div>
												
												<!-- Score -->
												<div class="mt-4 text-center">
													<div class="text-slate-400 text-xs">
														{currentMode === 'combat' ? 'Combat Improvement' : 'Work Score'}:
													</div>
													<div class="text-green-400 font-bold text-lg">
														{#if currentMode === 'combat'}
															{Math.round((bestPossibleStats.score - 1) * 100)}%
														{:else}
															{Math.round(bestPossibleStats.score)}
														{/if}
													</div>
												</div>

												<!-- Best Passives -->
												{#if bestPossibleStats.bestPassives && bestPossibleStats.bestPassives.length > 0}
													<div class="mt-4">
														<div class="text-slate-400 text-xs mb-2">Required Passive Skills:</div>
														<div class="flex flex-wrap gap-2">
															{#each bestPossibleStats.bestPassives as skill}
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
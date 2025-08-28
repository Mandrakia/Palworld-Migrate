<script lang="ts">
	import CharacterAutocomplete from './CharacterAutocomplete.svelte';
	import BreedingStep from './BreedingStep.svelte';
	import BreedingStepTooltip from './BreedingStepTooltip.svelte';
	import type { BreedingRoute, BreedingRouteResult, FailureResult, Step } from './breedingHelper';
    import { palDatabase } from './palDatabase';

	interface Props {
		title: string;
		emoji: string;
		mode: string;
		placeholder: string;
		description: string;
		goals: { characterId: string; mode: string }[];
		goalRoutes: Record<string, BreedingRouteResult>;
		goalFailures: Record<string, FailureResult>;
		loadingGoals: Set<string>;
		expandedGoals: Set<string>;
		onAddGoal: (characterId: string, mode: string) => void;
		onRemoveGoal: (characterId: string, mode: string) => void;
		onToggleGoal: (goal: { characterId: string; mode: string }) => void;
		onRefreshGoals: (mode: string) => void;
		onRefreshGoal: (characterId: string, mode: string) => void;
		goalKey: (characterId: string, mode: string) => string;
		getPalIconUrl: (tribeId: string) => string;
	}

	let { 
		title, 
		emoji, 
		mode, 
		placeholder, 
		description, 
		goals, 
		goalRoutes, 
		goalFailures, 
		loadingGoals, 
		expandedGoals,
		onAddGoal, 
		onRemoveGoal, 
		onToggleGoal, 
		onRefreshGoals, 
		onRefreshGoal,
		goalKey, 
		getPalIconUrl 
	}: Props = $props();

	let tooltipPosition = $state({ x: 0, y: 0 });
	let onStepHover = (event: MouseEvent, step: Step)=>{
		hoveredStep = step;
	};
	let onMouseMove = (event: MouseEvent)=>{
		tooltipPosition = { x: event.pageX, y: event.pageY };
	};
	let filteredGoals = $derived(goals.filter(g => g.mode === mode));
	let hoveredStep : Step | null= $state(null);
</script>

<div class="mb-8 bg-slate-800 border border-slate-700 rounded-lg overflow-hidden" onmousemove={onMouseMove}>
	<div class="p-6 border-b border-slate-700">
		<h2 class="text-xl font-semibold text-white mb-4">{emoji} {title}</h2>
		
		<!-- Add Goal Input -->
		<div class="mb-6">
			<div class="flex gap-3 mb-2">
				<div class="flex-1">
					<CharacterAutocomplete 
						{placeholder}
						onSelect={(id) => onAddGoal(id, mode)}
					/>
				</div>
				<button
					onclick={() => onRefreshGoals(mode)}
					class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
					title="Refresh all {mode} breeding routes"
					disabled={loadingGoals.size > 0}
				>
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
					</svg>
					{loadingGoals.size > 0 ? 'Refreshing...' : 'Refresh'}
				</button>
			</div>
			<div class="text-xs text-slate-400">
				{description}
			</div>
		</div>

		<!-- Goals List -->
		{#if filteredGoals.length > 0}
			<div class="space-y-4">
				{#each filteredGoals as goal}
					<div class="bg-slate-700/30 rounded-lg overflow-hidden">
						<!-- Goal Header -->
						<div 
							class="p-4 cursor-pointer hover:bg-slate-700/50 transition-colors flex items-center justify-between"
							onclick={() => onToggleGoal(goal)}
						>
							<div class="flex items-center space-x-4">
								<div class="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center overflow-hidden">
									<img 
										src={getPalIconUrl(goal.characterId)}
										alt={goal.characterId}
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
									<h3 class="text-white font-semibold">{palDatabase[goal.characterId].OverrideNameTextID}</h3>
									{#if loadingGoals.has(goalKey(goal.characterId, goal.mode))}
										<div class="text-blue-400 text-sm">Loading route...</div>
									{:else if goalRoutes[goalKey(goal.characterId, goal.mode)]}
										{@const routeResult = goalRoutes[goalKey(goal.characterId, goal.mode)]}
										<div class="text-green-400 text-sm">
											2 routes: {routeResult.bestTalents.steps.length}/{routeResult.shortest.steps.length} steps
										</div>
									{:else if goalFailures[goalKey(goal.characterId, goal.mode)]}
										<div class="text-red-400 text-sm">
											Failed: {goalFailures[goalKey(goal.characterId, goal.mode)].reason}
										</div>
									{:else}
										<div class="text-slate-400 text-sm">No route loaded</div>
									{/if}
								</div>
							</div>

							<div class="flex items-center space-x-2">
								<button
									onclick={(e) => { 
										e.stopPropagation(); 
										e.preventDefault();
										onRefreshGoal(goal.characterId, goal.mode); 
									}}
									class="text-blue-400 hover:text-blue-300 p-2 hover:bg-blue-900/20 rounded"
									title="Refresh this goal"
									disabled={loadingGoals.has(goalKey(goal.characterId, goal.mode))}
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
									</svg>
								</button>
								<button
									onclick={(e) => { 
										e.stopPropagation(); 
										e.preventDefault();
										onRemoveGoal(goal.characterId, goal.mode); 
									}}
									class="text-red-400 hover:text-red-300 p-2 hover:bg-red-900/20 rounded"
									title="Remove goal"
								>
									<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
									</svg>
								</button>
								<svg 
									class="w-5 h-5 text-slate-400 transition-transform {expandedGoals.has(goalKey(goal.characterId, goal.mode)) ? 'rotate-180' : ''}"
									fill="none" 
									stroke="currentColor" 
									viewBox="0 0 24 24"
								>
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
								</svg>
							</div>
						</div>

						<!-- Expanded Goal Details -->
						{#if expandedGoals.has(goalKey(goal.characterId, goal.mode))}
							{#if goalRoutes[goalKey(goal.characterId, goal.mode)]}
								{@const routeResult = goalRoutes[goalKey(goal.characterId, goal.mode)]}
								<div class="border-t border-slate-700 p-6">
									<!-- Three Route Options -->
									<div class="space-y-6">							
										<!-- Best Talents Route -->
										<div class="bg-slate-800/50 rounded-lg p-4">
											<h4 class="text-white font-semibold mb-3">💪 Best Talents Route ({routeResult.bestTalents.steps.length} steps)</h4>
											{#if goal.mode === 'work'}
												<div class="mb-4">
													<div class="text-yellow-400 text-sm">Success Chance: {Math.round((routeResult.bestTalents.successProbability ?? 0) * 100)}%</div>
												</div>
											{:else if goal.mode === 'combat'}
												<div class="grid grid-cols-3 gap-4 mb-4">
													<div class="text-center">
														<div class="text-slate-400 text-xs">HP</div>
														<div class="text-red-400 font-bold">{routeResult.bestTalents.final?.talents?.hp ?? '-'}</div>
													</div>
													<div class="text-center">
														<div class="text-slate-400 text-xs">ATK</div>
														<div class="text-orange-400 font-bold">{routeResult.bestTalents.final?.talents?.attack ?? '-'}</div>
													</div>
													<div class="text-center">
														<div class="text-slate-400 text-xs">DEF</div>
														<div class="text-blue-400 font-bold">{routeResult.bestTalents.final?.talents?.defense ?? '-'}</div>
													</div>
												</div>
											{/if}
											{#if routeResult.bestTalents.steps.length > 0}
												<div class="space-y-2">
													{#each routeResult.bestTalents.steps as step, index}
														<BreedingStep 
															{step} 
															{index} 
															{getPalIconUrl}
															onMouseEnter={(e)=> onStepHover(e, step)}
															onMouseLeave={()=> hoveredStep = null}
														/>
													{/each}
												</div>
											{/if}
										</div>

										<!-- Best Passives Route -->
										<div class="bg-slate-800/50 rounded-lg p-4">
											<h4 class="text-white font-semibold mb-3">✨ Best Passives Route ({routeResult.shortest.steps.length} steps)</h4>
											{#if goal.mode === 'work'}
												<div class="mb-4">
													<div class="text-yellow-400 text-sm">Success Chance: {Math.round((routeResult.shortest.successProbability ?? 0) * 100)}%</div>
												</div>
											{:else if goal.mode === 'combat'}
												<div class="grid grid-cols-3 gap-4 mb-4">
													<div class="text-center">
														<div class="text-slate-400 text-xs">HP</div>
														<div class="text-red-400 font-bold">{routeResult.shortest.final?.talents?.hp ?? '-'}</div>
													</div>
													<div class="text-center">
														<div class="text-slate-400 text-xs">ATK</div>
														<div class="text-orange-400 font-bold">{routeResult.shortest.final?.talents?.attack ?? '-'}</div>
													</div>
													<div class="text-center">
														<div class="text-slate-400 text-xs">DEF</div>
														<div class="text-blue-400 font-bold">{routeResult.shortest.final?.talents?.defense ?? '-'}</div>
													</div>
												</div>
											{/if}
											{#if routeResult.shortest.steps.length > 0}
												<div class="space-y-2">
													{#each routeResult.shortest.steps as step, index}
														<BreedingStep 
															{step} 
															{index} 
															{getPalIconUrl}
															onMouseEnter={(e)=> onStepHover(e, step)}
															onMouseLeave={()=> hoveredStep = null}
														/>
													{/each}
												</div>
											{/if}
										</div>
									</div>
								</div>
							{:else}
								<div class="border-t border-slate-700 p-6">
									<div class="text-center py-6 text-slate-400">
										Loading breeding route...
									</div>
								</div>
							{/if}
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<div class="text-center py-8 text-slate-400">
				No {mode} goals added yet. Use the search above to add your first goal.
			</div>
		{/if}
	</div>
</div>

<!-- Tooltip -->
{#if hoveredStep}
		<BreedingStepTooltip step={hoveredStep} position={tooltipPosition} {getPalIconUrl} />
{/if}

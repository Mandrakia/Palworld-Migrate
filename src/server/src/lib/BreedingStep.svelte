<script lang="ts">
	import PassiveSkill from './PassiveSkill.svelte';
	import type { Step } from './breedingHelper';

	interface Props {
		step: Step;
		index: number;
		getPalIconUrl: (tribeId: string) => string;
		onMouseEnter?: (event: MouseEvent) => void;
		onMouseLeave?: () => void;
	}

	let { step, index, getPalIconUrl, onMouseEnter, onMouseLeave }: Props = $props();
</script>

<div 
	class="bg-slate-800/50 rounded-lg p-4 relative"
	onmouseenter={onMouseEnter}
	onmouseleave={onMouseLeave}
>
	<div class="flex items-center justify-between mb-3">
		<div class="text-slate-400 text-sm">Step {index + 1} (Gen X)</div>
		<div class="text-green-400 text-sm">
			{Math.round((step.pSuccess ?? 0) * 100)}% chance
		</div>
	</div>

	<div class="grid grid-cols-1 lg:grid-cols-5 gap-4 items-center">
		<!-- Parent 1 -->
		<div class="flex items-center space-x-3">
			<div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center overflow-hidden">
				<img 
					src={getPalIconUrl(step.father.tribeId)} 
					alt={step.father.tribeId}
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
					{step.father.name}
				</div>
				<div class="text-xs text-slate-400">
					{step.father.tribeName} • Lv.{step.father.level}
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
					src={getPalIconUrl(step.mother.tribeId)} 
					alt={step.mother.name}
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
					{step.mother.name}
				</div>
				<div class="text-xs text-slate-400">
					{step.mother.tribeName} • Lv.{step.mother.level}
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
					src={getPalIconUrl(step.childTribeId)} 
					alt={step.childTribeId}
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
					{step.childTribeName}
				</div>
				<div class="text-xs text-green-400">
					Success: {Math.round((step.pSuccess ?? 0) * 100)}%
				</div>
			</div>
		</div>
	</div>

	<!-- Expected Passives -->
	{#if step.passives?.length > 0}
		<div class="mt-3 pt-3 border-t border-slate-700">
			<div class="text-slate-400 text-xs mb-2">Expected Passives:</div>
			<div class="flex flex-wrap gap-1">
				{#each step.passives as skill}
					{#if skill}
						<PassiveSkill 
							skillId={skill} 
							size="sm"
							showDescription={false}
						/>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
</div>

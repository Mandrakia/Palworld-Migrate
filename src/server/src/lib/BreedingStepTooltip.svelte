<script lang="ts">
	import PassiveSkill from './PassiveSkill.svelte';
	import type { Step } from './breedingHelper';

	interface Props {
		step: Step;
		position: { x: number; y: number };
		getPalIconUrl: (tribeId: string) => string;
	}

	let { step, position, getPalIconUrl }: Props = $props();
</script>

<div 
	class="fixed z-50 bg-slate-800 border border-slate-600 rounded-lg p-4 shadow-xl max-w-sm pointer-events-none"
	style="left: {position.x - 150}px; top: {position.y - 10}px; transform: translateY(-100%);"
>
	<div class="text-white font-semibold mb-3 text-center">Parent Details</div>
	
	<!-- Father -->
	<div class="mb-3">
		<div class="flex items-center gap-2 mb-2">
			<div class="w-6 h-6 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center overflow-hidden">
				<img 
					src={getPalIconUrl(step.father.tribeId)} 
					alt={step.father.tribeId}
					class="w-full h-full object-cover rounded-full"
					onerror={(event) => {
						const target = event.target as HTMLImageElement;
						if (target) {
							target.style.display = 'none';
							target.parentElement!.innerHTML = '♂️';
						}
					}}
				/>
			</div>
			<span class="text-blue-400 font-medium text-sm">{step.father.name}</span>
		</div>
		
		<!-- Father Talents -->
		{#if step.father.talents}
			<div class="text-xs text-slate-400 mb-1">Talents:</div>
			<div class="grid grid-cols-3 gap-1 text-xs mb-2">
				<div class="text-red-400">HP: {step.father.talents.hp || 0}</div>
				<div class="text-orange-400">ATK: {step.father.talents.attack || 0}</div>
				<div class="text-blue-400">DEF: {step.father.talents.defense || 0}</div>
			</div>
		{/if}
		
		<!-- Father Passives -->
		{#if step.father.passives && step.father.passives.length > 0}
			<div class="text-xs text-slate-400 mb-1">Passives:</div>
			<div class="flex flex-wrap gap-1 mb-2">
				{#each step.father.passives as passive}
					{#if passive}
						<PassiveSkill 
							skillId={passive} 
							size="sm"
							showDescription={false}
						/>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
	
	<!-- Mother -->
	<div>
		<div class="flex items-center gap-2 mb-2">
			<div class="w-6 h-6 bg-gradient-to-br from-pink-500 to-purple-600 rounded-full flex items-center justify-center overflow-hidden">
				<img 
					src={getPalIconUrl(step.mother.tribeId)} 
					alt={step.mother.tribeId}
					class="w-full h-full object-cover rounded-full"
					onerror={(event) => {
						const target = event.target as HTMLImageElement;
						if (target) {
							target.style.display = 'none';
							target.parentElement!.innerHTML = '♀️';
						}
					}}
				/>
			</div>
			<span class="text-pink-400 font-medium text-sm">{step.mother.name}</span>
		</div>
		
		<!-- Mother Talents -->
		{#if step.mother.talents}
			<div class="text-xs text-slate-400 mb-1">Talents:</div>
			<div class="grid grid-cols-3 gap-1 text-xs mb-2">
				<div class="text-red-400">HP: {step.mother.talents.hp || 0}</div>
				<div class="text-orange-400">ATK: {step.mother.talents.attack || 0}</div>
				<div class="text-blue-400">DEF: {step.mother.talents.defense || 0}</div>
			</div>
		{/if}
		
		<!-- Mother Passives -->
		{#if step.mother.passives && step.mother.passives.length > 0}
			<div class="text-xs text-slate-400 mb-1">Passives:</div>
			<div class="flex flex-wrap gap-1">
				{#each step.mother.passives as passive}
					{#if passive}
						<PassiveSkill 
							skillId={passive} 
							size="sm"
							showDescription={false}
						/>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
</div>

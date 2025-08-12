<script lang="ts">
	import type { PassiveSkillProps } from '$lib/interfaces';
    import type { LocalizedPassiveSkill } from './interfaces/passive-skills';
	import { getLocalizedPassive, palPassiveDatabase } from './palDatabase';
    import { locale } from './stores/locale';

	let { 
		skill, 
		skillId,
		onClick, 
		clickable = false, 
		size = 'md', 
		showDescription = true
	}: PassiveSkillProps = $props();

	let finalSkill : LocalizedPassiveSkill = $derived(skill??getLocalizedPassive(skillId!, $locale));

	function getPassiveSkillRatingIcon(rating: number): string {
		if (rating === -1) {
			return '/T_icon_skillstatus_rank_arrow_00.png';
		} else if (rating >= 0 && rating <= 4) {
			return `/T_icon_skillstatus_rank_arrow_${rating.toString().padStart(2, '0')}.png`;
		}
		return '';
	}

	function getPassiveSkillRatingColor(rating: number): string {
		const colorMapping: Record<number, string> = {
			'-1': 'bg-neutral-900/50 text-red-300 border-red-500',
			0: 'bg-gray-900/50 text-gray-300 border-gray-500',
			1: 'bg-neutral-900/50 text-neutral-300 border-neutral-500',
			2: 'bg-yellow-900/50 text-yellow-300 border-yellow-500',
			3: 'bg-yellow-900/50 text-yellow-300 border-yellow-500',
			4: 'bg-teal-900/50 text-teal-300 border-teal-500'
		};
		
		return colorMapping[rating] || 'bg-slate-900/50 text-slate-300 border-slate-500';
	}

	function handleClick() {
		if (clickable && onClick) {
			onClick(finalSkill.Name);
		}
	}

	// Size variants
	const sizeClasses = {
		xs: {
			container: 'p-1',
			icon: 'w-2 h-2',
			name: 'text-xs font-medium',
			description: 'text-xs opacity-75 mt-0.5'
		},
		sm: {
			container: 'p-1.5',
			icon: 'w-3 h-3',
			name: 'text-xs font-medium',
			description: 'text-xs opacity-75 mt-0.5'
		},
		md: {
			container: 'p-2',
			icon: 'w-4 h-4',
			name: 'text-sm font-medium',
			description: 'text-xs opacity-75 mt-1'
		},
		lg: {
			container: 'p-3',
			icon: 'w-5 h-5',
			name: 'text-base font-medium',
			description: 'text-sm opacity-75 mt-1'
		}
	};

	// Ensure size is valid, default to 'md' if not
	const validSize = size && sizeClasses[size] ? size : 'md';
</script>

<style>
	.red-mask {
		filter: hue-rotate(0deg) saturate(0) brightness(0) invert(1) 
			sepia(1) saturate(5) hue-rotate(0deg) brightness(0.8);
	}
</style>

<div
	class="flex items-start space-x-2 {sizeClasses[validSize].container} rounded border transition-colors {getPassiveSkillRatingColor(finalSkill.Rating)} {clickable ? 'cursor-pointer hover:brightness-110' : ''}"
	onclick={handleClick}
	title={clickable ? `Click to filter by ${finalSkill.Name}` : finalSkill.Description}
	role={clickable ? 'button' : 'none'}
	tabindex={clickable ? 0 : -1}
>
	<div class="flex-shrink-0">
		{#if getPassiveSkillRatingIcon(finalSkill.Rating)}
			<img 
				src={getPassiveSkillRatingIcon(finalSkill.Rating)} 
				alt="Rating {finalSkill.Rating}" 
				class="{sizeClasses[validSize].icon} {finalSkill.Rating === -1 ? 'red-mask' : ''}"
			/>
		{/if}
	</div>
	<div class="flex-1 min-w-0">
		<div class="{sizeClasses[validSize].name} truncate">{finalSkill.Name}</div>
		{#if showDescription && finalSkill.Description}
			<div class="{sizeClasses[validSize].description}">{finalSkill.Description}</div>
		{/if}
	</div>
</div>
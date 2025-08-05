<script lang="ts">
	import type { PassiveSkill, PassiveSkillProps } from '$lib/interfaces/index.js';

	let { 
		skill, 
		onClick, 
		clickable = false, 
		size = 'md', 
		showDescription = true
	}: PassiveSkillProps = $props();

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
			'-1': 'bg-red-900/50 text-red-300 border-red-500',
			0: 'bg-gray-900/50 text-gray-300 border-gray-500',
			1: 'bg-blue-900/50 text-blue-300 border-blue-500',
			2: 'bg-green-900/50 text-green-300 border-green-500',
			3: 'bg-purple-900/50 text-purple-300 border-purple-500',
			4: 'bg-yellow-900/50 text-yellow-300 border-yellow-500'
		};
		
		return colorMapping[rating] || 'bg-slate-900/50 text-slate-300 border-slate-500';
	}

	function handleClick() {
		if (clickable && onClick) {
			onClick(skill.Name);
		}
	}

	// Size variants
	const sizeClasses = {
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
</script>

<style>
	.red-mask {
		filter: hue-rotate(0deg) saturate(0) brightness(0) invert(1) 
			sepia(1) saturate(5) hue-rotate(0deg) brightness(0.8);
	}
</style>

<div
	class="flex items-start space-x-2 {sizeClasses[size].container} rounded border transition-colors {getPassiveSkillRatingColor(skill.Rating)} {clickable ? 'cursor-pointer hover:brightness-110' : ''}"
	onclick={handleClick}
	title={clickable ? `Click to filter by ${skill.Name}` : skill.Description}
	role={clickable ? 'button' : 'none'}
	tabindex={clickable ? 0 : -1}
>
	<div class="flex-shrink-0">
		{#if getPassiveSkillRatingIcon(skill.Rating)}
			<img 
				src={getPassiveSkillRatingIcon(skill.Rating)} 
				alt="Rating {skill.Rating}" 
				class="{sizeClasses[size].icon} {skill.Rating === -1 ? 'red-mask' : ''}"
			/>
		{/if}
	</div>
	<div class="flex-1 min-w-0">
		<div class="{sizeClasses[size].name} truncate">{skill.Name}</div>
		{#if showDescription && skill.Description}
			<div class="{sizeClasses[size].description}">{skill.Description}</div>
		{/if}
	</div>
</div>
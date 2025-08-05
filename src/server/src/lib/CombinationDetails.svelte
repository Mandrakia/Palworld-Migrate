<script lang="ts">
	import PassiveSkill from '$lib/PassiveSkill.svelte';
	import { getGenderType } from '$lib/genderUtils';
	import type { BreedingSource, CombinationDetailsProps } from '$lib/interfaces/index.js';

	let { combination }: CombinationDetailsProps = $props();

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

	// Calculate combined passive skills for a breeding pair
	function getCombinedPassives(pal1: any, pal2: any): any[] {
		const passiveMap = new Map<string, any>();
		
		if (pal1.passiveSkills) {
			pal1.passiveSkills.forEach((skill: any) => {
				if (skill.Name) {
					passiveMap.set(skill.Name, skill);
				}
			});
		}
		
		if (pal2.passiveSkills) {
			pal2.passiveSkills.forEach((skill: any) => {
				if (skill.Name) {
					// If skill already exists, keep the one with better rating
					const existing = passiveMap.get(skill.Name);
					if (!existing || skill.Rating > existing.Rating) {
						passiveMap.set(skill.Name, skill);
					}
				}
			});
		}
		
		return Array.from(passiveMap.values());
	}

	// Calculate max talents from breeding pair
	function getMaxTalents(pal1: any, pal2: any) {
		return {
			hp: Math.max(pal1.talentHP || 0, pal2.talentHP || 0),
			attack: Math.max(pal1.talentShot || 0, pal2.talentShot || 0),
			defense: Math.max(pal1.talentDefense || 0, pal2.talentDefense || 0)
		};
	}

	let maxTalents = $derived(getMaxTalents(combination["Pal 1"], combination["Pal 2"]));
	let combinedPassives = $derived(getCombinedPassives(combination["Pal 1"], combination["Pal 2"]));
</script>

<div class="space-y-4">
	<!-- Breeding Pair -->
	<div class="bg-slate-700/30 rounded-lg p-4">
		<h5 class="text-sm font-medium text-slate-300 mb-3">Breeding Pair</h5>
		<div class="grid grid-cols-1 lg:grid-cols-5 gap-4 items-center">
			<!-- Parent 1 -->
			<div class="flex items-center space-x-3">
				<div class="relative">
					<div class="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center overflow-hidden">
						<img 
							src={getPalIconUrl(combination["Pal 1"].characterId)} 
							alt={combination["Pal 1"].name}
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
					{#if combination["Pal 1"].gender}
						<div class="absolute -bottom-1 -right-1 w-4 h-4">
							<img src={getGenderIcon(combination["Pal 1"].gender)} alt="Gender" class="w-4 h-4" />
						</div>
					{/if}
				</div>
				<div class="min-w-0">
					<div class="text-white font-medium text-sm truncate">
						{combination["Pal 1"].displayName || combination["Pal 1"].name}
					</div>
					<div class="text-xs text-slate-400">Lv.{combination["Pal 1"].level}</div>
				</div>
			</div>

			<!-- Parent 2 -->
			<div class="flex items-center space-x-3">
				<div class="relative">
					<div class="w-12 h-12 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center overflow-hidden">
						<img 
							src={getPalIconUrl(combination["Pal 2"].characterId)} 
							alt={combination["Pal 2"].name}
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
					{#if combination["Pal 2"].gender}
						<div class="absolute -bottom-1 -right-1 w-4 h-4">
							<img src={getGenderIcon(combination["Pal 2"].gender)} alt="Gender" class="w-4 h-4" />
						</div>
					{/if}
				</div>
				<div class="min-w-0">
					<div class="text-white font-medium text-sm truncate">
						{combination["Pal 2"].displayName || combination["Pal 2"].name}
					</div>
					<div class="text-xs text-slate-400">Lv.{combination["Pal 2"].level}</div>
				</div>
			</div>

			<!-- Arrow -->
			<div class="flex justify-center">
				<svg class="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3" />
				</svg>
			</div>

			<!-- Combined Stats Preview -->
			<div class="lg:col-span-2">
				<div class="grid grid-cols-3 gap-2 text-xs">
					<div class="text-center">
						<div class="text-slate-400">HP</div>
						<div class="text-red-400 font-bold">{maxTalents.hp}</div>
					</div>
					<div class="text-center">
						<div class="text-slate-400">ATK</div>
						<div class="text-orange-400 font-bold">{maxTalents.attack}</div>
					</div>
					<div class="text-center">
						<div class="text-slate-400">DEF</div>
						<div class="text-blue-400 font-bold">{maxTalents.defense}</div>
					</div>
				</div>
			</div>
		</div>
	</div>

	<!-- Combined Passives -->
	<div class="bg-slate-700/50 rounded-lg p-4">
		<h5 class="text-sm font-medium text-slate-300 mb-3">Combined Passive Skills</h5>
		<div class="max-h-24 overflow-y-auto">
			<div class="flex flex-wrap gap-2">
				{#each combinedPassives.slice(0, 6) as skill}
					<PassiveSkill 
						{skill} 
						size="sm"
						showDescription={false}
					/>
				{/each}
				{#if combinedPassives.length > 6}
					<div class="bg-slate-700/50 rounded p-1.5 text-center text-slate-400 text-xs">
						+{combinedPassives.length - 6} more
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>
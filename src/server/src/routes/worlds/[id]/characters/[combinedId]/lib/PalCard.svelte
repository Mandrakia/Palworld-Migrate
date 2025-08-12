<script lang="ts">
	import { getGenderType } from '$lib/genderUtils';
	import { getWorkSkillIcon, getWorkSkillName } from '$lib/workSuitabilityUtils';
	import PassiveSkill from '$lib/PassiveSkill.svelte';
	import type { PalCardData } from '$lib/interfaces';

	interface Props {
		pal: PalCardData;
		sortBy: string;
		onElementClick: (element: string) => void;
		onWorkSkillClick: (skill: string, level: number) => void;
		onTalentClick: (talentType: string) => void;
		onPassiveSkillToggle: (skillName: string) => void;
		formatDate: (date?: Date) => string;
		getElementIcon: (elementType?: string) => string;
		getCombinedTalent: (pal: PalCardData) => number;
	}

	let {
		pal,
		sortBy,
		onElementClick,
		onWorkSkillClick,
		onTalentClick,
		onPassiveSkillToggle,
		formatDate,
		getElementIcon,
		getCombinedTalent
	}: Props = $props();

	// Utility functions moved from parent component
	function getPalIconUrl(characterId?: string): string {
		if (!characterId) return '';
		return `/pals/T_${characterId}_icon_normal.png`;
	}

	function getElementColor(elementType?: string): string {
		const colorMapping: Record<string, string> = {
			'Normal': 'bg-gray-600 text-gray-200',
			'Fire': 'bg-red-600 text-red-200',
			'Water': 'bg-blue-600 text-blue-200',
			'Electric': 'bg-yellow-600 text-yellow-200',
			'Lightning': 'bg-yellow-600 text-yellow-200',
			'Electricity': 'bg-yellow-600 text-yellow-200',
			'Grass': 'bg-green-600 text-green-200',
			'Plant': 'bg-green-600 text-green-200',
			'Leaf': 'bg-green-600 text-green-200',
			'Dark': 'bg-purple-600 text-purple-200',
			'Dragon': 'bg-indigo-600 text-indigo-200',
			'Ground': 'bg-amber-600 text-amber-200',
			'Earth': 'bg-amber-600 text-amber-200',
			'Ice': 'bg-cyan-600 text-cyan-200'
		};
		
		return colorMapping[elementType || ''] || 'bg-slate-600 text-slate-200';
	}
</script>

<div class="bg-slate-800 border border-slate-700 rounded-lg p-4 sm:p-6 hover:bg-slate-750 hover:border-slate-600 transition-colors duration-200">
	<!-- Pal Header -->
	<div class="flex items-center justify-between mb-4">
		<div class="flex items-center space-x-3">
			<div class="relative">
				<div class="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center text-white font-bold overflow-hidden">
					{#if pal.characterId}
						<img 
							src={getPalIconUrl(pal.characterId)} 
							alt={pal.name}
							class="w-full h-full object-cover rounded-full"
						/>
					{:else}
						🐾
					{/if}
				</div>
				{#if pal.isBoss}
					<div class="absolute -top-1 -right-1 w-4 h-4 bg-red-600 rounded-full flex items-center justify-center border border-white z-10">
						<img src="/T_icon_enemy_strong.png" alt="Boss" class="w-2.5 h-2.5" />
					</div>
				{/if}
			</div>
			<div class="min-w-0">
				<h3 class="text-white font-semibold truncate">{pal.name}</h3>
				<div class="flex items-center space-x-2 text-xs text-slate-400">
					<span class="{sortBy === 'level' ? 'text-blue-400 font-bold' : ''}">Level {pal.level}</span>
					{#if pal.zukanIndex}
						<span>•</span>
						<span>#{pal.zukanIndex.toString().padStart(3, '0')}</span>
					{/if}
					{#if pal.rarity}
						<span>•</span>
						<span class="text-yellow-400">{'★'.repeat(Math.min(pal.rank - 1, 5))}</span>
					{/if}
				</div>
			</div>
		</div>
		<div class="flex items-center space-x-2">
			<!-- Friendship Rank -->
			{#if pal.friendshipRank && pal.friendshipRank >= 1}
				<div class="flex items-center space-x-1">
					<img src="/T_Icon_PalFriendship_Color.png" alt="Friendship" class="w-4 h-4" />
					<span class="text-pink-400 font-bold text-sm">{pal.friendshipRank}</span>
				</div>
			{/if}
			{#if pal.gender}
				<div class="w-6 h-6">
					{#if getGenderType(pal.gender) === 'male'}
						<img src="/T_Icon_PanGender_Male.png" alt="Male" class="w-6 h-6" />
					{:else if getGenderType(pal.gender) === 'female'}
						<img src="/T_Icon_PanGender_Female.png" alt="Female" class="w-6 h-6" />
					{:else}
						<div class="text-lg">⚪</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>

	<!-- Element Types -->
		{#if pal.elementType1 || pal.elementType2}
		<div class="mb-4">
			<div class="text-xs text-slate-400 uppercase tracking-wide mb-2">Elements</div>
			<div class="flex space-x-2">
				{#if pal.elementType1 && pal.elementType1 !== 'None'}
					<button 
						onclick={() => onElementClick(pal.elementType1!)}
						class="flex items-center space-x-1 {getElementColor(pal.elementType1)} px-2 py-1 rounded text-xs hover:scale-105 transition-transform cursor-pointer"
						title="Click to filter by {pal.elementType1}"
					>
						{#if getElementIcon(pal.elementType1)}
							<img src={getElementIcon(pal.elementType1)} alt={pal.elementType1} class="w-4 h-4" />
						{/if}
						<span>{pal.elementType1}</span>
					</button>
				{/if}
				{#if pal.elementType2 && pal.elementType2 !== 'None'}
					<button 
						onclick={() => onElementClick(pal.elementType2!)}
						class="flex items-center space-x-1 {getElementColor(pal.elementType2)} px-2 py-1 rounded text-xs hover:scale-105 transition-transform cursor-pointer"
						title="Click to filter by {pal.elementType2}"
					>
						{#if getElementIcon(pal.elementType2)}
							<img src={getElementIcon(pal.elementType2)} alt={pal.elementType2} class="w-4 h-4" />
						{/if}
						<span>{pal.elementType2}</span>
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Work Suitabilities -->
	<div class="work-skills-section mb-4" data-section="work-skills">
		{#if pal.workSuitabilities}
			{@const workSkills = Object.entries(pal.workSuitabilities).filter(([_, level]) => level && level > 0)}
			{#if workSkills.length > 0}
				<div class="text-xs text-slate-400 uppercase tracking-wide mb-2">Work Skills</div>
				<div class="grid grid-cols-2 gap-2">
					{#each workSkills.slice(0, 6) as [skill, level]}
						<button 
							onclick={() => onWorkSkillClick(skill, level)}
							class="bg-slate-700 hover:bg-slate-600 rounded px-3 py-3 text-xs flex items-center space-x-3 transition-colors cursor-pointer w-full"
							title="Click to filter by {getWorkSkillName(skill)} Lv.{level}+"
						>
							{#if getWorkSkillIcon(skill)}
								<img src={getWorkSkillIcon(skill)} alt={getWorkSkillName(skill)} class="w-8 h-8 flex-shrink-0" />
							{/if}
							<div class="flex-1 min-w-0 text-left">
								<div class="text-slate-300 text-xs truncate">{getWorkSkillName(skill)}</div>
								<div class="text-orange-400 font-semibold">Lv.{level}</div>
							</div>
						</button>
					{/each}
					{#if workSkills.length > 6}
						<div class="bg-slate-700 rounded px-3 py-3 text-xs flex items-center justify-center text-slate-400">
							+{workSkills.length - 6} more
						</div>
					{/if}
				</div>
			{/if}
		{/if}
	</div>

	<!-- Talents -->
	{#if pal.talentHP || pal.talentShot || pal.talentDefense}
		<div class="space-y-2 mb-4">
			<div class="text-xs text-slate-400 uppercase tracking-wide flex items-center justify-between">
				<span>Talents</span>
				{#if sortBy === 'combinedTalent'}
					<span class="text-yellow-400 text-xs">Total: {getCombinedTalent(pal)}</span>
				{/if}
			</div>
			<div class="grid grid-cols-3 gap-2">
				{#if pal.talentHP}
					<button 
						onclick={() => onTalentClick('talentHP')}
						class="bg-slate-700 hover:bg-slate-600 rounded p-2 text-center transition-colors cursor-pointer {sortBy === 'talentHP' ? 'ring-2 ring-red-400' : ''}"
						title="Click to sort by HP talent"
					>
						<div class="text-red-400 text-xs">❤️ HP</div>
						<div class="text-white font-semibold">{pal.talentHP}</div>
					</button>
				{/if}
				{#if pal.talentShot}
					<button 
						onclick={() => onTalentClick('talentShot')}
						class="bg-slate-700 hover:bg-slate-600 rounded p-2 text-center transition-colors cursor-pointer {sortBy === 'talentShot' ? 'ring-2 ring-orange-400' : ''}"
						title="Click to sort by Attack talent"
					>
						<div class="text-orange-400 text-xs">⚔️ ATK</div>
						<div class="text-white font-semibold">{pal.talentShot}</div>
					</button>
				{/if}
				{#if pal.talentDefense}
					<button 
						onclick={() => onTalentClick('talentDefense')}
						class="bg-slate-700 hover:bg-slate-600 rounded p-2 text-center transition-colors cursor-pointer {sortBy === 'talentDefense' ? 'ring-2 ring-blue-400' : ''}"
						title="Click to sort by Defense talent"
					>
						<div class="text-blue-400 text-xs">🛡️ DEF</div>
						<div class="text-white font-semibold">{pal.talentDefense}</div>
					</button>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Final stats -->
	{#if pal.endStats}
		<div class="space-y-2 mb-4">
			<div class="text-xs text-slate-400 uppercase tracking-wide flex items-center justify-between">
				<span>Stats</span>
			</div>
			<!-- HP - Full width -->
			<div class="w-full">
				<div class="bg-slate-700 hover:bg-slate-600 rounded p-2 text-center transition-colors cursor-pointer">
					<div class="text-red-400 text-xs">❤️ HP</div>
					<div class="text-white font-semibold">{pal.endStats.hp}</div>
				</div>
			</div>
			<!-- ATK, DEF, CRAFTSPEED - Three columns -->
			<div class="grid grid-cols-3 gap-2">
				<div class="bg-slate-700 hover:bg-slate-600 rounded p-2 text-center transition-colors cursor-pointer">
					<div class="text-orange-400 text-xs">⚔️ ATK</div>
					<div class="text-white font-semibold">{pal.endStats.attack}</div>
				</div>
				<div class="bg-slate-700 hover:bg-slate-600 rounded p-2 text-center transition-colors cursor-pointer">
					<div class="text-blue-400 text-xs">🛡️ DEF</div>
					<div class="text-white font-semibold">{pal.endStats.defense}</div>
				</div>
				<div class="bg-slate-700 hover:bg-slate-600 rounded p-2 text-center transition-colors cursor-pointer">
					<div class="text-yellow-400 text-xs">🔨 CRAFT</div>
					<div class="text-white font-semibold">{pal.endStats.craftSpeed || 100}</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Passive Skills -->
	<div class="passive-skills-section mb-4" data-section="passive-skills">
		{#if pal.passiveSkills && pal.passiveSkills.length > 0}
			<div class="text-xs text-slate-400 uppercase tracking-wide mb-2">Passive Skills</div>
			<div class="space-y-2">
				{#each pal.passiveSkills as skill}
					<PassiveSkill 
						{skill} 
						onClick={onPassiveSkillToggle}
						clickable={true}
						size="md"
						showDescription={true}
					/>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Base Stats -->
	{#if pal.baseHp || pal.baseMeleeAttack || pal.baseShotAttack || pal.baseDefense}
		<div class="mb-4">
			<div class="text-xs text-slate-400 uppercase tracking-wide mb-2">Base Stats</div>
			<div class="grid grid-cols-2 gap-2">
				{#if pal.baseHp}
					<div class="bg-slate-700 rounded px-2 py-1 text-xs">
						<span class="text-red-400">HP:</span>
						<span class="text-white ml-1">{pal.baseHp}</span>
					</div>
				{/if}
				{#if pal.baseMeleeAttack}
					<div class="bg-slate-700 rounded px-2 py-1 text-xs">
						<span class="text-orange-400">Melee:</span>
						<span class="text-white ml-1">{pal.baseMeleeAttack}</span>
					</div>
				{/if}
				{#if pal.baseShotAttack}
					<div class="bg-slate-700 rounded px-2 py-1 text-xs">
						<span class="text-yellow-400">Shot:</span>
						<span class="text-white ml-1">{pal.baseShotAttack}</span>
					</div>
				{/if}
				{#if pal.baseDefense}
					<div class="bg-slate-700 rounded px-2 py-1 text-xs">
						<span class="text-blue-400">Defense:</span>
						<span class="text-white ml-1">{pal.baseDefense}</span>
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Stats -->
	{#if pal.ownedTime}
		<div class="text-center pt-3 border-t border-slate-700 {sortBy === 'ownedTime' ? 'ring-2 ring-green-400 rounded p-1' : ''}">
			<div class="text-slate-400 text-xs uppercase tracking-wide">Owned</div>
			<div class="text-green-400 font-bold text-xs">{formatDate(pal.ownedTime)}</div>
		</div>
	{/if}
</div>

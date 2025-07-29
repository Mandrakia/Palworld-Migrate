<script lang="ts">
	import type { CharacterCardData, PlayerCardData, PalCardData, StatPoint } from './CharacterCardData';

	interface Props {
		character: CharacterCardData;
		onSelect?: (character: CharacterCardData) => void;
	}

	let { character, onSelect }: Props = $props();

	function translateStatName(japaneseStatName: string): string {
		const translations: Record<string, string> = {
			'最大HP': 'HP',
			'最大SP': 'Endurance', 
			'攻撃力': 'Attack',
			'防御力': 'Defense',
			'作業速度': 'Work Speed',
			'所持重量': 'Weight',
			'捕獲率': 'Capture Rate'
		};
		return translations[japaneseStatName] || japaneseStatName;
	}

	function getOrderedStats(stats: StatPoint[], addedStats: StatPoint[]): Array<{name: string, base: number, added: number}> {
		const statOrder = ['最大HP', '最大SP', '攻撃力', '防御力', '所持重量', '作業速度', '捕獲率'];
		
		return statOrder.map(statName => {
			const baseStat = stats.find(s => s.Name === statName)?.Value || 0;
			const addedStat = addedStats.find(s => s.Name === statName)?.Value || 0;
			return {
				name: translateStatName(statName),
				base: baseStat,
				added: addedStat
			};
		}).filter(stat => stat.base > 0 || stat.added > 0);
	}

	function getCharacterTypeIcon() {
		return character.type === 'player' ? '👤' : '🐾';
	}

	function getPalIconUrl(characterId?: string): string {
		if (!characterId) return '';
		return `/pals/T_${characterId}_icon_normal.png`;
	}

	function isPlayer(char: CharacterCardData): char is PlayerCardData {
		return char.type === 'player';
	}

	function isPal(char: CharacterCardData): char is PalCardData {
		return char.type === 'pal';
	}

	function getStatIcon(statName: string): string {
		const icons: Record<string, string> = {
			'HP': '/T_icon_status_00.png',           // Index 0 - HP
			'Endurance': '/T_icon_status_01.png',   // Index 1 - SP/Endurance  
			'Attack': '/T_icon_status_02.png',      // Index 2 - Attack/Shot
			'Defense': '/T_icon_status_03.png',     // Index 3 - Defense
			'Weight': '/T_icon_status_04.png',      // Index 4 - Weight/Carry Capacity  
			'Work Speed': '/T_icon_status_05.png',  // Index 5 - Work Speed
			'Capture Rate': '/T_icon_status_06.png' // Index 6 - Capture Power
		};
		return icons[statName] || '';
	}

	function handleClick() {
		if (onSelect) {
			onSelect(character);
		}
	}
</script>

<div 
	class="bg-slate-800 border border-slate-700 rounded-lg p-6 hover:bg-slate-750 hover:border-slate-600 cursor-pointer transition-colors duration-200"
	onclick={handleClick}
	role="button"
	tabindex="0"
	onkeydown={(e) => e.key === 'Enter' && handleClick()}
>
	<!-- Character Header -->
	<div class="flex items-center justify-between mb-6">
		<div class="flex items-center space-x-3">
			<div class="relative">
				<div class="w-12 h-12 bg-gradient-to-br {character.type === 'player' ? 'from-blue-500 to-purple-600' : 'from-green-500 to-teal-600'} rounded-full flex items-center justify-center text-white font-bold text-lg overflow-hidden">
					{#if character.type === 'pal' && isPal(character) && character.characterId}
						<img 
							src={getPalIconUrl(character.characterId)} 
							alt={character.name}
							class="w-full h-full object-cover rounded-full"
						/>
					{:else}
						{getCharacterTypeIcon()}
					{/if}
				</div>
				{#if character.type === 'pal' && isPal(character) && character.isBoss}
					<div class="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center border-2 border-white z-10">
						<img src="/T_icon_enemy_strong.png" alt="Boss" class="w-3 h-3" />
					</div>
				{/if}
			</div>
			<div class="min-w-0">
				<h3 class="text-white font-semibold truncate">{character.name}</h3>
				<div class="text-xs text-slate-400 capitalize">{character.type}</div>
			</div>
		</div>
		<div class="text-right">
			<div class="text-blue-400 font-bold text-xl">Lv.{character.level}</div>
		</div>
	</div>

	<!-- Stats Grid -->
	<div class="space-y-2 mb-4">
		{#each getOrderedStats(character.stats, character.addedStats) as stat}
			<div class="flex justify-between items-center py-1">
				<div class="flex items-center space-x-2">
					{#if getStatIcon(stat.name)}
						<img src={getStatIcon(stat.name)} alt={stat.name} class="w-4 h-4" />
					{:else}
						<span class="text-slate-300">⭐</span>
					{/if}
					<span class="text-slate-400 text-sm">{stat.name}</span>
				</div>
				<div class="text-white text-sm font-medium">
					{stat.base}
					{#if stat.added > 0}
						<span class="text-green-400 ml-1">(+{stat.added})</span>
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- Quick Stats -->
	<div class="grid grid-cols-2 gap-4 text-center pt-4 border-t border-slate-700">
		{#if isPlayer(character)}
			<div class="bg-slate-700 rounded-lg p-3">
				<div class="text-slate-400 text-xs uppercase tracking-wide">Pals</div>
				<div class="text-emerald-400 font-bold text-lg">{character.palCount}</div>
			</div>
			<div class="bg-slate-700 rounded-lg p-3">
				<div class="text-slate-400 text-xs uppercase tracking-wide">Gold</div>
				<div class="text-yellow-400 font-bold text-lg">{character.gold.toLocaleString()}</div>
			</div>
		{:else if isPal(character)}
			<div class="bg-slate-700 rounded-lg p-3">
				<div class="text-slate-400 text-xs uppercase tracking-wide flex items-center justify-center space-x-1">
					<img src="/T_Icon_PalFriendship_Color.png" alt="Friendship" class="w-3 h-3" />
					<span>Friendship</span>
				</div>
				<div class="text-pink-400 font-bold text-lg">{character.friendshipPoint || 0}</div>
			</div>
			<div class="bg-slate-700 rounded-lg p-3">
				<div class="text-slate-400 text-xs uppercase tracking-wide">Skills</div>
				<div class="text-purple-400 font-bold text-lg">{character.passiveSkills?.length || 0}</div>
			</div>
		{/if}
	</div>
</div>
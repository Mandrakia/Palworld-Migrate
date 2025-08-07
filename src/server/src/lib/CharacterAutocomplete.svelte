<script lang="ts">
	import { onMount } from 'svelte';
	import { getWorkIcons } from '$lib/workSuitabilityUtils';

	interface CharacterInfo {
		id: string;
		displayName: string;
		tribe: string;
		workSuitabilities: Record<string, number>;
		elementType1: string;
		elementType2: string;
		rarity: number;
	}

	interface Props {
		placeholder?: string;
		onSelect: (characterId: string, character: CharacterInfo) => void;
		selectedValue?: string;
	}

	let { placeholder = "Search for a character...", onSelect, selectedValue = '' }: Props = $props();

	let characters = $state<CharacterInfo[]>([]);
	let filteredCharacters = $state<CharacterInfo[]>([]);
	let searchTerm = $state('');
	let isOpen = $state(false);
	let selectedIndex = $state(-1);
	let loading = $state(true);
	
	let inputElement: HTMLInputElement;
	let dropdownElement: HTMLDivElement;

	// Load characters on mount
	onMount(async () => {
		try {
			const response = await fetch('/api/characters');
			if (response.ok) {
				characters = await response.json();
				filteredCharacters = characters;
			}
		} catch (error) {
			console.error('Failed to load characters:', error);
		} finally {
			loading = false;
		}
	});

	// Filter characters based on search term
	function filterCharacters(term: string) {
		if (!term.trim()) {
			filteredCharacters = characters;
			return;
		}

		const searchLower = term.toLowerCase();
		filteredCharacters = characters.filter(char => 
			char.displayName.toLowerCase().includes(searchLower) ||
			char.id.toLowerCase().includes(searchLower) ||
			char.tribe.toLowerCase().includes(searchLower)
		);
		selectedIndex = -1;
	}

	// Handle input change
	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		searchTerm = target.value;
		filterCharacters(searchTerm);
		isOpen = true;
		selectedIndex = -1;
	}

	// Handle character selection
	function selectCharacter(character: CharacterInfo) {
		searchTerm = character.displayName;
		isOpen = false;
		selectedIndex = -1;
		onSelect(character.id, character);
	}

	// Handle keyboard navigation
	function handleKeydown(event: KeyboardEvent) {
		if (!isOpen) {
			if (event.key === 'ArrowDown' || event.key === 'Enter') {
				isOpen = true;
				event.preventDefault();
			}
			return;
		}

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				selectedIndex = Math.min(selectedIndex + 1, filteredCharacters.length - 1);
				scrollToSelected();
				break;
			case 'ArrowUp':
				event.preventDefault();
				selectedIndex = Math.max(selectedIndex - 1, -1);
				scrollToSelected();
				break;
			case 'Enter':
				event.preventDefault();
				if (selectedIndex >= 0 && selectedIndex < filteredCharacters.length) {
					selectCharacter(filteredCharacters[selectedIndex]);
				}
				break;
			case 'Escape':
				isOpen = false;
				selectedIndex = -1;
				inputElement.blur();
				break;
		}
	}

	// Handle focus
	function handleFocus() {
		isOpen = true;
		if (!searchTerm) {
			filteredCharacters = characters;
		}
	}

	// Handle blur (with delay to allow clicks)
	function handleBlur() {
		setTimeout(() => {
			isOpen = false;
			selectedIndex = -1;
		}, 200);
	}

	// Scroll to selected item
	function scrollToSelected() {
		if (selectedIndex >= 0 && dropdownElement) {
			const selectedElement = dropdownElement.children[selectedIndex] as HTMLElement;
			if (selectedElement) {
				selectedElement.scrollIntoView({ block: 'nearest' });
			}
		}
	}

	// Get pal icon URL
	function getPalIconUrl(characterId: string): string {
		return `/pals/T_${characterId}_icon_normal.png`;
	}

	// Get element color
	function getElementColor(elementType: string): string {
		const colors: Record<string, string> = {
			'Fire': 'text-red-400',
			'Water': 'text-blue-400',
			'Grass': 'text-green-400',
			'Electric': 'text-yellow-400',
			'Ice': 'text-cyan-400',
			'Ground': 'text-orange-400',
			'Fighting': 'text-red-500',
			'Poison': 'text-purple-400',
			'Flying': 'text-indigo-400',
			'Psychic': 'text-pink-400',
			'Bug': 'text-lime-400',
			'Rock': 'text-stone-400',
			'Ghost': 'text-indigo-600',
			'Dragon': 'text-purple-600',
			'Dark': 'text-gray-400',
			'Steel': 'text-gray-500',
			'Fairy': 'text-pink-300',
			'None': 'text-slate-500'
		};
		return colors[elementType] || 'text-slate-400';
	}
</script>

<div class="relative">
	<!-- Input Field -->
	<div class="relative">
		<input
			bind:this={inputElement}
			bind:value={searchTerm}
			{placeholder}
			class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 sm:px-4 py-2 pr-8 sm:pr-10 text-sm sm:text-base text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
			oninput={handleInput}
			onkeydown={handleKeydown}
			onfocus={handleFocus}
			onblur={handleBlur}
			autocomplete="off"
		/>
		
		<!-- Loading/Dropdown Icon -->
		<div class="absolute inset-y-0 right-0 flex items-center pr-3">
			{#if loading}
				<svg class="w-4 h-4 text-slate-400 animate-spin" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
				</svg>
			{:else}
				<svg class="w-4 h-4 text-slate-400 transition-transform {isOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
				</svg>
			{/if}
		</div>
	</div>

	<!-- Dropdown -->
	{#if isOpen && !loading}
		<div 
			bind:this={dropdownElement}
			class="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg max-h-80 sm:max-h-96 overflow-y-auto"
		>
			{#if filteredCharacters.length === 0}
				<div class="px-4 py-3 text-slate-400 text-center">
					No characters found
				</div>
			{:else}
				{#each filteredCharacters as character, index}
					<button
						class="w-full text-left px-3 sm:px-4 py-2 sm:py-3 hover:bg-slate-700 focus:bg-slate-700 transition-colors {selectedIndex === index ? 'bg-slate-700' : ''}"
						onclick={() => selectCharacter(character)}
					>
						<!-- Character Mini Card -->
						<div class="flex items-center space-x-3">
							<!-- Icon -->
							<div class="w-10 h-10 bg-gradient-to-br from-slate-600 to-slate-700 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
								<img 
									src={getPalIconUrl(character.id)}
									alt={character.displayName}
									class="w-full h-full object-cover rounded-lg"
									onerror={(event) => {
										const target = event.target as HTMLImageElement;
										if (target) {
											target.style.display = 'none';
											target.parentElement!.innerHTML = '🐾';
										}
									}}
								/>
							</div>

							<!-- Info -->
							<div class="flex-1 min-w-0">
								<div class="flex items-center justify-between">
									<h3 class="text-white font-medium truncate">{character.displayName}</h3>
									<div class="flex items-center space-x-1 ml-2">
										<span class="{getElementColor(character.elementType1)} text-xs font-medium">
											{character.elementType1}
										</span>
										{#if character.elementType2 !== 'None'}
											<span class="text-slate-500 text-xs">•</span>
											<span class="{getElementColor(character.elementType2)} text-xs font-medium">
												{character.elementType2}
											</span>
										{/if}
									</div>
								</div>
								
								<!-- Work Suitabilities -->
								{#if getWorkIcons(character.workSuitabilities).length > 0}
									{@const workIcons = getWorkIcons(character.workSuitabilities)}
									<div class="flex flex-wrap gap-1 mt-1">
										{#each workIcons.slice(0, 4) as work}
											<div 
												class="flex items-center space-x-1 bg-slate-600/50 rounded px-1.5 py-0.5 text-xs"
												title={work.name}
											>
												<img 
													src={work.icon} 
													alt={work.name}
													class="w-3 h-3"
												/>
												<span class="text-yellow-400 font-medium">{work.value}</span>
											</div>
										{/each}
										{#if workIcons.length > 4}
											<div class="flex items-center px-1.5 py-0.5 text-xs text-slate-400">
												+{workIcons.length - 4} more
											</div>
										{/if}
									</div>
								{:else}
									<div class="text-slate-500 text-xs mt-1">No work suitabilities</div>
								{/if}
							</div>
						</div>
					</button>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Custom scrollbar for dropdown */
	div::-webkit-scrollbar {
		width: 6px;
	}
	div::-webkit-scrollbar-track {
		background: #1e293b;
	}
	div::-webkit-scrollbar-thumb {
		background: #475569;
		border-radius: 3px;
	}
	div::-webkit-scrollbar-thumb:hover {
		background: #64748b;
	}
</style>
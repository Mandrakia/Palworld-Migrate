<script lang="ts">
	import type { PageData } from './$types';
	import PlayerCard from '$lib/PlayerCard.svelte';
	import PalCard from './lib/PalCard.svelte';
	import { goto } from '$app/navigation';
	import { getGenderType } from '$lib/genderUtils';
	import { getWorkSkillIcon, getWorkSkillName } from '$lib/workSuitabilityUtils';
	import PassiveSkill from '$lib/PassiveSkill.svelte';
    import type { PalCardData, WorkSuitabilities } from '$lib/interfaces';
    import type { LocalizedPassiveSkill } from '$lib/interfaces/passive-skills';
    import { getLocalizedPassive } from '$lib/palDatabase';
	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// Sorting and filtering state
	let sortBy = $state('ownedTime');
	let sortOrder = $state('desc' as 'asc' | 'desc');
	
	// Filter state
	let selectedGender = $state(null as 'male' | 'female' | null);
	let filterBoss = $state('all' as 'all' | 'boss' | 'normal');
	let selectedElements = $state(new Set<string>()); // Set of selected elements (AND logic)
	let selectedWorkSkills = $state(new Map<string, number>()); // Map of work skill to required level
	let palNameSearch = $state(''); // Search term for pal names
	let selectedPassiveSkills = $state(new Set<string>()); // Set of selected passive skill names (AND logic)
	let passiveSkillSearch = $state(''); // Search term for passive skills dropdown
	let showPassiveDropdown = $state(false); // Show/hide passive skills dropdown


	function goBackToWorld() {
		goto(`/worlds/${data.worldId}`);
	}

	function formatDate(date?: Date): string {
		if (!date) return 'Unknown';
		return new Intl.DateTimeFormat('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(date));
	}

	function getTalentIcon(talentName: string): string {
		const icons: Record<string, string> = {
			'HP': '❤️',
			'Attack': '⚔️',
			'Defense': '🛡️'
		};
		return icons[talentName] || '⭐';
	}



	function getElementIcon(elementType?: string): string {
		if (!elementType || elementType === 'None') return '';
		
		const elementMapping: Record<string, number> = {
			'Normal': 0,
			'Fire': 1,
			'Water': 2,
			'Electric': 3,
			'Lightning': 3,
			'Electricity': 3,    // Handle Electricity specifically
			'Grass': 4,
			'Plant': 4,
			'Leaf': 4,           // Handle Leaf specifically
			'Dark': 5,
			'Dragon': 6,
			'Ground': 7,
			'Earth': 7,
			'Ice': 8
		};
		
		const iconIndex = elementMapping[elementType];
		if (iconIndex !== undefined) {
			return `/T_Icon_element_${iconIndex.toString().padStart(2, '0')}.png`;
		}
		
		return '';
	}





	function getCombinedTalent(pal: PalCardData): number {
		return (pal.talentHP || 0) + (pal.talentShot || 0) + (pal.talentDefense || 0);
	}

	function filterPals(pals: PalCardData[], selectedGender: 'male' | 'female' | null, bossFilter: string, selectedElements: Set<string>, selectedWorkSkills: Map<string, number>, nameSearch: string, selectedPassiveSkills: Set<string>) {
		return pals.filter(pal => {
			// Gender filter
			if (selectedGender) {
				const palGender = getGenderType(pal.gender);
				if (palGender !== selectedGender) return false;
			}

			// Boss filter
			if (bossFilter !== 'all') {
				if (bossFilter === 'boss' && !pal.isBoss) return false;
				if (bossFilter === 'normal' && pal.isBoss) return false;
			}

			// Element filter (AND logic - pal must have ALL selected elements)
			if (selectedElements.size > 0) {
				const palElements = new Set<string>();
				if (pal.elementType1 && pal.elementType1 !== 'None') palElements.add(pal.elementType1);
				if (pal.elementType2 && pal.elementType2 !== 'None') palElements.add(pal.elementType2);
				
				// Check if pal has ALL selected elements
				for (const element of selectedElements) {
					if (!palElements.has(element)) return false;
				}
			}

			// Work skills filter (AND logic - pal must have ALL selected work skills at required level or higher)
			if (selectedWorkSkills.size > 0) {
				for (const [skillName, requiredLevel] of selectedWorkSkills) {
					const palSkillLevel = pal.workSuitabilities?.[skillName as keyof WorkSuitabilities] || 0;
					if (palSkillLevel < requiredLevel) return false;
				}
			}

			// Name search filter
			if (nameSearch.trim()) {
				const searchTerm = nameSearch.toLowerCase().trim();
				const palName = (pal.name || '').toLowerCase();
				if (!palName.includes(searchTerm)) return false;
			}

			// Passive skills filter (AND logic - pal must have ALL selected passive skills)
			if (selectedPassiveSkills.size > 0) {
				const palPassiveSkills = new Set((pal.passiveSkills || []).map((skill: any) => skill.Name));
				for (const skillName of selectedPassiveSkills) {
					if (!palPassiveSkills.has(skillName)) return false;
				}
			}

			return true;
		});
	}

	function sortPals(pals: PalCardData[], sortBy: string, order: 'asc' | 'desc') {
		const sorted = [...pals].sort((a, b) => {
			let valueA: any, valueB: any;

			switch (sortBy) {
				case 'ownedTime':
					valueA = a.ownedTime ? new Date(a.ownedTime).getTime() : 0;
					valueB = b.ownedTime ? new Date(b.ownedTime).getTime() : 0;
					break;
				case 'friendshipRank':
					valueA = a.friendshipRank || 0;
					valueB = b.friendshipRank || 0;
					break;
				case 'level':
					valueA = a.level || 0;
					valueB = b.level || 0;
					break;
				case 'combinedTalent':
					valueA = getCombinedTalent(a);
					valueB = getCombinedTalent(b);
					break;
				case 'talentHP':
					valueA = a.talentHP || 0;
					valueB = b.talentHP || 0;
					break;
				case 'talentShot':
					valueA = a.talentShot || 0;
					valueB = b.talentShot || 0;
					break;
				case 'talentDefense':
					valueA = a.talentDefense || 0;
					valueB = b.talentDefense || 0;
					break;
                case 'attack':
                    valueA = a.endStats?.attack|| 0;
                    valueB = b.endStats?.attack|| 0;
                    break;
                case 'defense':
                    valueA = a.endStats?.defense|| 0;
                    valueB = b.endStats?.defense|| 0;
                    break;
                case 'hp':
                    valueA = a.endStats?.hp|| 0;
                    valueB = b.endStats?.hp|| 0;
                    break;
				default:
					return 0;
			}

			if (valueA < valueB) return order === 'asc' ? -1 : 1;
			if (valueA > valueB) return order === 'asc' ? 1 : -1;
			return 0;
		});

		return sorted;
	}

	// Get unique elements from all pals for filter options
	function getUniqueElements(pals: PalCardData[]): string[] {
		const elements = new Set<string>();
		pals.forEach(pal => {
			if (pal.elementType1 && pal.elementType1 !== 'None') elements.add(pal.elementType1);
			if (pal.elementType2 && pal.elementType2 !== 'None') elements.add(pal.elementType2);
		});
		return Array.from(elements).sort();
	}

	// Reactive filtered and sorted pals
    let filteredAndSortedPals = $derived(() => {
		if (!data.characterData.pals) return [];
		const filtered = filterPals(data.characterData.pals, selectedGender, filterBoss, selectedElements, selectedWorkSkills, palNameSearch, selectedPassiveSkills);
		return sortPals(filtered, sortBy, sortOrder);
	});

	// Get unique elements, work skills, and passive skills for filter options
	let uniqueElements = $derived(data.characterData.pals ? getUniqueElements(data.characterData.pals) : []);
	let uniqueWorkSkills = $derived(data.characterData.pals ? getUniqueWorkSkills(data.characterData.pals) : []);
	let uniquePassiveSkills = $derived(data.characterData.pals ? getUniquePassiveSkills(data.characterData.pals) : []);

	// Get unique work skills from all pals
	function getUniqueWorkSkills(pals: any[]): string[] {
		const skills = new Set<string>();
		pals.forEach(pal => {
			if (pal.workSuitabilities) {
				Object.entries(pal.workSuitabilities).forEach(([skill, level]) => {
					if (level && (level as number) > 0) {
						skills.add(skill);
					}
				});
			}
		});
		return Array.from(skills).sort();
	}

	// Get unique passive skills from all pals
	function getUniquePassiveSkills(pals: any[]): string[] {
		const skills = new Set<string>();
		pals.forEach(pal => {
			if (pal.passiveSkills) {
				pal.passiveSkills.forEach((skill: any) => {
					if (skill.Name) {
						skills.add(skill.Name);
					}
				});
			}
		});
		return Array.from(skills).sort();
	}

	// Gender toggle functions
	function toggleGender(gender: 'male' | 'female') {
		if (selectedGender === gender) {
			selectedGender = null; // Deselect if already selected
		} else {
			selectedGender = gender; // Select this gender (automatically deselects other)
		}
	}

	// Element toggle functions
	function toggleElement(element: string) {
		if (selectedElements.has(element)) {
			selectedElements.delete(element);
		} else {
			selectedElements.add(element);
		}
		// Trigger reactivity
		selectedElements = new Set(selectedElements);
	}

	// Work skill functions
	function handleWorkSkillFilterClick(skillName: string, event: MouseEvent) {
		event.preventDefault();
		
		if (event.button === 0) { // Left click
			const currentLevel = selectedWorkSkills.get(skillName) || 0;
			if (currentLevel === 0) {
				// First click: select at level 1
				selectedWorkSkills.set(skillName, 1);
			} else {
				// Subsequent clicks: delete selection
				selectedWorkSkills.delete(skillName);
			}
		} else if (event.button === 2) { // Right click
			const currentLevel = selectedWorkSkills.get(skillName) || 0;
			if (currentLevel > 1) {
				// Decrease level
				selectedWorkSkills.set(skillName, currentLevel - 1);
			} else if (currentLevel === 1) {
				// Remove selection
				selectedWorkSkills.delete(skillName);
			}
		}
		
		// Trigger reactivity
		selectedWorkSkills = new Map(selectedWorkSkills);
	}

	function handleWorkSkillClick(skillName: string, level: number) {
		const currentLevel = selectedWorkSkills.get(skillName) || 0;
		if (currentLevel === 0) {
			selectedWorkSkills.set(skillName, level);
		} else {
			selectedWorkSkills.delete(skillName);
		}
		
		// Trigger reactivity
		selectedWorkSkills = new Map(selectedWorkSkills);
	}

	// Toggle passive skill filter
	function togglePassiveSkill(skillName: string) {
		if (selectedPassiveSkills.has(skillName)) {
			selectedPassiveSkills.delete(skillName);
		} else {
			selectedPassiveSkills.add(skillName);
		}
		// Trigger reactivity
		selectedPassiveSkills = new Set(selectedPassiveSkills);
	}

	// Filtered passive skills for dropdown
	let filteredPassiveSkills = $derived(uniquePassiveSkills.filter(a=> a.toLowerCase().includes(passiveSkillSearch.toLowerCase())));

	// Get passive skill rating and color from any pal that has this skill
	function getPassiveSkillInfo(skillName: string) : LocalizedPassiveSkill {
		for (const pal of data.characterData.pals) {
			if (pal.passiveSkills) {
				for (const skill of pal.passiveSkills) {
					if (skill.Name === skillName) {
						return skill;
					}
				}
			}
		}
		return getLocalizedPassive(skillName, 'fr');
	}

	// Interactive click handlers for pal cards
	function handleElementClick(element: string) {
		toggleElement(element);
	}

	function handleTalentClick(talentType: string) {
		sortBy = talentType;
		// Toggle sort order if already sorting by this talent
		if (sortBy === talentType) {
			sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
		}
	}

	// Clear all filters
	function clearAllFilters() {
		selectedGender = null;
		filterBoss = 'all';
		selectedElements = new Set();
		selectedWorkSkills = new Map();
		palNameSearch = '';
		selectedPassiveSkills = new Set();
		passiveSkillSearch = '';
		showPassiveDropdown = false;
	}

	// Section alignment for cards
	function alignCardSections() {
		if (typeof window === 'undefined') return;
		
		requestAnimationFrame(() => {
			const grid = document.querySelector('.pal-cards-grid');
			if (!grid) return;

			const cards = Array.from(grid.children);
			if (cards.length === 0) return;

			// Get grid column count from computed styles
			const gridStyles = window.getComputedStyle(grid);
			const gridTemplateColumns = gridStyles.gridTemplateColumns;
			const columnCount = gridTemplateColumns.split(' ').length;

			// Group cards by rows
			const rows = [];
			for (let i = 0; i < cards.length; i += columnCount) {
				rows.push(cards.slice(i, i + columnCount));
			}

			// Align sections within each row
			rows.forEach(rowCards => {
				const sections = ['work-skills', 'passive-skills'];
				
				sections.forEach(sectionType => {
					const sectionElements = rowCards.map(card => 
						card.querySelector(`[data-section="${sectionType}"]`)
					).filter(Boolean) as HTMLElement[];

					if (sectionElements.length === 0) return;

					// Reset heights first
					sectionElements.forEach(el => {
						if (el) el.style.minHeight = '';
					});

					// Get the maximum height
					const heights = sectionElements.map(el => el ? el.offsetHeight : 0);
					const maxHeight = Math.max(...heights);

					// Apply the maximum height to all sections in this row
					sectionElements.forEach(el => {
						if (el) el.style.minHeight = `${maxHeight}px`;
					});
				});
			});
		});
	}

	// Run alignment after DOM updates
	$effect(() => {
		// Trigger alignment when filtered pals change
		filteredAndSortedPals();
		alignCardSections();
	});

	// Close dropdown when clicking outside
	function handleClickOutside(event: Event) {
		const target = event.target as HTMLElement;
		if (!target.closest('.passive-skills-dropdown')) {
			showPassiveDropdown = false;
		}
	}
</script>

<svelte:head>
	<title>Character Details - {data.characterData.name}</title>
</svelte:head>

<style>
	.red-mask {
		filter: hue-rotate(0deg) saturate(0) brightness(0) invert(1) 
				sepia(1) saturate(5) hue-rotate(0deg) brightness(0.8);
	}
</style>

<div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" onclick={handleClickOutside}>
	<!-- Header -->
	<div class="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
			<div class="flex items-center justify-between flex-col sm:flex-row space-y-4 sm:space-y-0">
				<div class="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto">
					<button
						onclick={goBackToWorld}
						class="flex items-center space-x-2 text-slate-400 hover:text-white transition-colors"
					>
						<svg class="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
						</svg>
						<span class="text-sm sm:text-base">Back</span>
					</button>
					<div class="text-slate-500 hidden sm:block">•</div>
					<h1 class="text-lg sm:text-2xl font-bold text-white">Character Details</h1>
				</div>
				<div class="flex items-center space-x-2 sm:space-x-4 w-full sm:w-auto">
					<a
						href="/worlds/{data.worldId}/characters/{data.combinedId}/breeding"
						class="flex items-center space-x-2 px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm sm:text-base w-full sm:w-auto justify-center"
					>
						<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
						</svg>
						<span class="hidden sm:inline">Breeding Calculator</span>
						<span class="sm:hidden">Breeding</span>
					</a>
				</div>
			</div>
		</div>
	</div>

	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
		<!-- Player Card -->
		<div class="mb-6 sm:mb-8">
			<PlayerCard character={data.characterData} />
		</div>

		<!-- Pals Section -->
		{#if data.characterData.pals && data.characterData.pals.length > 0}
			<div class="space-y-6">
				<div class="flex flex-col space-y-4">
					<div class="flex items-center justify-between">
						<h2 class="text-xl font-semibold text-white flex items-center space-x-2">
							<span class="text-2xl">🐾</span>
							<span>Owned Pals ({data.characterData.pals.length})</span>
						</h2>
					</div>

					<!-- Sort & Filter Controls -->
					<div class="bg-slate-800 border border-slate-700 rounded-lg p-3 sm:p-4 space-y-4">
						<!-- Sort Controls -->
						<div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
							<div class="flex items-center space-x-2">
								<label class="text-xs sm:text-sm text-slate-400">Sort by:</label>
								<select 
									bind:value={sortBy}
									class="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs sm:text-sm text-white focus:border-slate-500 focus:outline-none flex-1 sm:flex-none"
								>
									<option value="ownedTime">Date Acquired</option>
									<option value="friendshipRank">Friendship Rank</option>
									<option value="level">Level</option>
									<option value="combinedTalent">Combined Talent</option>
									<option value="talentHP">HP Talent</option>
									<option value="talentShot">Attack Talent</option>
									<option value="talentDefense">Defense Talent</option>
                                    <option value="attack">Attack</option>
                                    <option value="defense">Defense</option>
                                    <option value="hp">Hp</option>
								</select>
							</div>

							<div class="flex items-center space-x-2">
								<button
									onclick={() => sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'}
									class="flex items-center space-x-1 px-2 sm:px-3 py-1 bg-slate-700 border border-slate-600 rounded text-xs sm:text-sm text-white hover:bg-slate-600 transition-colors"
								>
									<span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
									<span class="hidden sm:inline">{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
									<span class="sm:hidden">{sortOrder === 'asc' ? 'Asc' : 'Desc'}</span>
								</button>
							</div>
						</div>

						<!-- Filter Controls -->
						<div class="border-t border-slate-700 pt-4 space-y-4">
							<!-- Name Search Filter -->
							<div>
								<div class="text-sm text-slate-400 mb-2">Search by Name:</div>
								<input
									type="text"
									bind:value={palNameSearch}
									placeholder="Enter pal name..."
									class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-slate-500 focus:outline-none"
								/>
							</div>

							<!-- Gender Filter -->
							<div>
								<div class="text-sm text-slate-400 mb-2 flex items-center space-x-2">
									<span>Gender:</span>
									{#if selectedGender}
										<span class="text-xs text-blue-400">({selectedGender})</span>
									{/if}
								</div>
								<div class="flex items-center space-x-2">
									<button
										onclick={() => toggleGender('male')}
										class="w-10 h-10 rounded-lg border-2 transition-all flex items-center justify-center {selectedGender === 'male' ? 'border-blue-500 bg-blue-500/20' : 'border-slate-600 hover:border-slate-500'}"
									>
										<img src="/T_Icon_PanGender_Male.png" alt="Male" class="w-6 h-6" />
									</button>
									<button
										onclick={() => toggleGender('female')}
										class="w-10 h-10 rounded-lg border-2 transition-all flex items-center justify-center {selectedGender === 'female' ? 'border-pink-500 bg-pink-500/20' : 'border-slate-600 hover:border-slate-500'}"
									>
										<img src="/T_Icon_PanGender_Female.png" alt="Female" class="w-6 h-6" />
									</button>
									
									<!-- Boss Filter -->
									<div class="border-l border-slate-600 pl-4 ml-4">
										<label class="text-sm text-slate-400">Type:</label>
										<select 
											bind:value={filterBoss}
											class="ml-2 bg-slate-700 border border-slate-600 rounded px-3 py-1 text-sm text-white focus:border-slate-500 focus:outline-none"
										>
											<option value="all">All</option>
											<option value="normal">Normal</option>
											<option value="boss">Boss</option>
										</select>
									</div>
								</div>
							</div>

							<!-- Element Filter -->
							<div>
								<div class="text-sm text-slate-400 mb-2 flex items-center space-x-2">
									<span>Elements:</span>
									{#if selectedElements.size > 0}
										<span class="text-xs text-blue-400">({selectedElements.size} selected - AND logic)</span>
									{/if}
								</div>
								<div class="flex flex-wrap gap-2">
									{#each uniqueElements as element}
										<button
											onclick={() => toggleElement(element)}
											class="w-10 h-10 rounded-lg border-2 transition-all flex items-center justify-center {selectedElements.has(element) ? 'border-yellow-500 bg-yellow-500/20' : 'border-slate-600 hover:border-slate-500'}"
											title={element}
										>
											{#if getElementIcon(element)}
												<img src={getElementIcon(element)} alt={element} class="w-6 h-6" />
											{/if}
										</button>
									{/each}
								</div>
							</div>

							<!-- Work Skills Filter -->
							<div>
								<div class="text-sm text-slate-400 mb-2 flex items-center space-x-2">
									<span>Work Skills:</span>
									{#if selectedWorkSkills.size > 0}
										<span class="text-xs text-blue-400">({selectedWorkSkills.size} selected - AND logic)</span>
									{/if}
									<span class="text-xs text-slate-500">(Left click: select/increase level, Right click: decrease level)</span>
								</div>
								<div class="flex flex-wrap gap-2">
									{#each uniqueWorkSkills as skillName}
										{@const selectedLevel = selectedWorkSkills.get(skillName) || 0}
										<button
											onmousedown={(e) => handleWorkSkillFilterClick(skillName, e)}
											oncontextmenu={(e) => e.preventDefault()}
											class="w-10 h-10 rounded-lg border-2 transition-all relative flex items-center justify-center {selectedLevel > 0 ? 'border-green-500 bg-green-500/20' : 'border-slate-600 hover:border-slate-500'}"
											title="{getWorkSkillName(skillName)}{selectedLevel > 0 ? ` Lv.${selectedLevel}+` : ''}"
										>
											{#if getWorkSkillIcon(skillName)}
												<img src={getWorkSkillIcon(skillName)} alt={getWorkSkillName(skillName)} class="w-6 h-6" />
											{/if}
											{#if selectedLevel > 0}
												<span class="absolute -top-1 -right-1 w-5 h-5 bg-green-600 rounded-full flex items-center justify-center text-xs text-white font-bold">
													{selectedLevel}
												</span>
											{/if}
										</button>
									{/each}
								</div>
							</div>

							<!-- Passive Skills Filter -->
							<div class="relative passive-skills-dropdown">
								<div class="text-sm text-slate-400 mb-2 flex items-center space-x-2">
									<span>Passive Skills:</span>
									{#if selectedPassiveSkills.size > 0}
										<span class="text-xs text-blue-400">({selectedPassiveSkills.size} selected - AND logic)</span>
									{/if}
									<span class="text-xs text-slate-500">({uniquePassiveSkills.length} available)</span>
								</div>
								
								<!-- Selected Skills Display -->
								{#if selectedPassiveSkills.size > 0}
									{@const selectedSkillsArray = Array.from(selectedPassiveSkills).map(getPassiveSkillInfo)}
									<div class="mb-2">
										<div class="flex flex-wrap gap-2">
											{#each selectedSkillsArray.slice(0, 10) as skill}
												<PassiveSkill 
													{skill} 
													size="sm"
													showDescription={false}
												/>
											{/each}
											{#if selectedSkillsArray.length > 10}
												<div class="bg-slate-700/50 rounded p-1.5 text-center text-slate-400 text-xs">
													+{selectedSkillsArray.length - 10} more
												</div>
											{/if}
										</div>
									</div>
								{/if}

								<!-- Search Input -->
								<div class="relative">
									<input
										type="text"
										bind:value={passiveSkillSearch}
										onfocus={() => showPassiveDropdown = true}
										oninput={() => showPassiveDropdown = true}
										onkeydown={(e) => {
											if (e.key === 'Escape') {
												showPassiveDropdown = false;
												passiveSkillSearch = '';
											}
										}}
										placeholder="Search passive skills..."
										class="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-400 focus:border-slate-500 focus:outline-none"
									/>
									
									<!-- Dropdown -->
									{#if showPassiveDropdown}
										<div class="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
											{#if filteredPassiveSkills.length > 0}
												{#each filteredPassiveSkills as skillName}
													{@const skillInfo = getPassiveSkillInfo(skillName)}													
													<button
														onclick={() => {
															togglePassiveSkill(skillName);
															passiveSkillSearch = '';
															showPassiveDropdown = false;
														}}
														class="w-full px-3 py-2 text-left hover:bg-slate-700 transition-colors text-xs flex items-center justify-between"
													>
														<div class="flex-1">
															<PassiveSkill 
																skill={skillInfo} 
																size="sm"
																showDescription={false}
															/>
														</div>
														{#if selectedPassiveSkills.has(skillName)}
															<span class="text-green-400 ml-2">✓</span>
														{/if}
													</button>
												{/each}
											{:else}
												<div class="px-3 py-2 text-slate-400 text-xs text-center">
													{passiveSkillSearch.trim() ? 'No skills found' : 'Start typing to search...'}
												</div>
											{/if}
										</div>
									{/if}
								</div>
							</div>

							<!-- Clear Filters Button -->
							<div class="flex justify-center pt-2 border-t border-slate-700">
								<button
									onclick={clearAllFilters}
									class="px-4 py-2 bg-red-700 border border-red-600 rounded-lg text-sm text-white hover:bg-red-600 transition-colors flex items-center space-x-2"
								>
									<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
									</svg>
									<span>Clear All Filters</span>
								</button>
							</div>
						</div>

						<!-- Results Count -->
						<div class="border-t border-slate-700 pt-3">
							<div class="text-xs text-slate-500">
								Showing {filteredAndSortedPals().length} of {data.characterData.pals?.length || 0} pal{filteredAndSortedPals().length !== 1 ? 's' : ''}
								{#if filteredAndSortedPals().length !== (data.characterData.pals?.length || 0)}
									<span class="text-blue-400">(filtered)</span>
								{/if}
								{#if selectedGender || filterBoss !== 'all' || selectedElements.size > 0 || selectedWorkSkills.size > 0 || palNameSearch.trim() || selectedPassiveSkills.size > 0}
									<span class="text-orange-400 text-xs ml-2">
										[Active filters: 
										{#if selectedGender}Gender: {selectedGender}{/if}
										{#if filterBoss !== 'all'}{selectedGender ? ', ' : ''}Type: {filterBoss}{/if}
										{#if palNameSearch.trim()}{selectedGender || filterBoss !== 'all' ? ', ' : ''}Name: "{palNameSearch}"{/if}
										{#if selectedElements.size > 0}{selectedGender || filterBoss !== 'all' || palNameSearch.trim() ? ', ' : ''}Elements: {selectedElements.size}{/if}
										{#if selectedWorkSkills.size > 0}{selectedGender || filterBoss !== 'all' || selectedElements.size > 0 || palNameSearch.trim() ? ', ' : ''}Work: {selectedWorkSkills.size}{/if}
										{#if selectedPassiveSkills.size > 0}{selectedGender || filterBoss !== 'all' || selectedElements.size > 0 || selectedWorkSkills.size > 0 || palNameSearch.trim() ? ', ' : ''}Passive: {selectedPassiveSkills.size}{/if}
										]
									</span>
								{/if}
							</div>
						</div>
					</div>
				</div>

				<!-- Pals Grid -->
				{#if filteredAndSortedPals().length > 0}
					<div class="pal-cards-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 items-start">
						{#each filteredAndSortedPals() as pal}
							<PalCard 
								{pal}
								{sortBy}
								onElementClick={handleElementClick}
								onWorkSkillClick={handleWorkSkillClick}
								onTalentClick={handleTalentClick}
								onPassiveSkillToggle={togglePassiveSkill}
								{formatDate}
								{getElementIcon}
								{getCombinedTalent}
							/>
					{/each}
				</div>
			{:else}
				<div class="text-center py-12">
					<div class="text-slate-500 text-lg mb-2">No pals match your filters</div>
					<div class="text-slate-400 text-sm">Try adjusting your filter criteria to see more results.</div>
				</div>
			{/if}
		</div>
		{:else}
			<div class="text-center py-12">
				<div class="text-slate-500 text-lg mb-2">No pals found</div>
				<div class="text-slate-400 text-sm">This player doesn't own any pals yet.</div>
			</div>
		{/if}
	</div>
</div>
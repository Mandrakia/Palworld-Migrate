<script lang="ts">
	import { onMount } from 'svelte';
    import {sav_to_map, type Point, sav_to_front, normalizeToTopLeft} from '$lib/map_utils';
    import type { DungeonWithState } from '$lib/types';
    import type { PageData } from './$types';

    interface CampDTO{
        Coords: { x: number; y: number };
        GroupId: string;
    }

    interface Props {
        data: PageData;
    }

    let { data }: Props = $props();
	let camps: CampDTO[] = $state(data.camps);
	let dungeons: DungeonWithState[] = $state(data.dungeons);
	let mapElement: HTMLImageElement;
	let containerElement: HTMLDivElement;
	
	let zoom = $state(3.4);
	let panX = $state(0);
	let panY = $state(0);
	let isDragging = $state(false);
	let dragStartX = $state(0);
	let dragStartY = $state(0);
	let dragStartPanX = $state(0);
	let dragStartPanY = $state(0);
	
	// Calibrated values for proper camp positioning
	let offsetX = $state(-120);
	let offsetY = $state(-1560);
	let coordScale = $state(1.276);
	
	// Filter states
	let showCamps = $state(true);
	let showDungeons = $state(true);
	let showActiveDungeons = $state(true);
	let showInactiveDungeons = $state(true);

	// Tooltip state
	let tooltipVisible = $state(false);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipDungeon = $state(null);

	onMount(() => {
		// Set initial center position to game coords -210000, +165000
		setInitialCenter();
		
		// Focus the container so it can receive keyboard events
		if (containerElement) {
			containerElement.focus();
		}
		
		// Add global keyboard listener as backup
		const handleGlobalKeyDown = (event: KeyboardEvent) => {
			handleKeyDown(event);
		};
		
		document.addEventListener('keydown', handleGlobalKeyDown);
		
		return () => {
			document.removeEventListener('keydown', handleGlobalKeyDown);
		};
	});

	function setInitialCenter() {
		if (!mapElement || !containerElement) return;
		
		// Convert game coordinates to normalized coordinates
		const gameCoords = { x: -210000, y: 165000 };
		const normalizedCoords = normalizeToTopLeft(gameCoords);
		
		// Get map and container dimensions
		const containerRect = containerElement.getBoundingClientRect();
		const computedStyle = getComputedStyle(mapElement);
		const maxWidth = parseFloat(computedStyle.maxWidth) || containerRect.width * 0.8;
		const maxHeight = parseFloat(computedStyle.maxHeight) || containerRect.height * 0.8;
		
		const naturalWidth = mapElement.naturalWidth || 8192;
		const naturalHeight = mapElement.naturalHeight || 8192;
		const aspectRatio = naturalWidth / naturalHeight;
		
		let baseWidth, baseHeight;
		if (maxWidth / aspectRatio <= maxHeight) {
			baseWidth = maxWidth;
			baseHeight = maxWidth / aspectRatio;
		} else {
			baseWidth = maxHeight * aspectRatio;
			baseHeight = maxHeight;
		}
		
		// Calculate the pixel position on the map
		const mapCenterX = normalizedCoords.x * baseWidth;
		const mapCenterY = normalizedCoords.y * baseHeight;
		
		// Calculate pan to center this point in the viewport
		const viewportCenterX = containerRect.width / 2;
		const viewportCenterY = containerRect.height / 2;
		
		panX = viewportCenterX - (mapCenterX * zoom);
		panY = viewportCenterY - (mapCenterY * zoom);
	}

	let campPositions = $state([]);
	let dungeonPositions = $state([]);

	function calculateMapPositions() {
		if (!mapElement) {
			campPositions = [];
			dungeonPositions = [];
			return;
		}
		
		// Use the CSS-styled dimensions (max-width/height from CSS), not current getBoundingClientRect
		// This gives us the "base" size before any zoom transforms are applied
		const computedStyle = getComputedStyle(mapElement);
		const maxWidth = parseFloat(computedStyle.maxWidth) || window.innerWidth * 0.8;
		const maxHeight = parseFloat(computedStyle.maxHeight) || window.innerHeight * 0.8;
		
		// Calculate the actual displayed size respecting aspect ratio
		const naturalWidth = mapElement.naturalWidth || 8192;
		const naturalHeight = mapElement.naturalHeight || 8192;
		const aspectRatio = naturalWidth / naturalHeight;
		
		let baseWidth, baseHeight;
		if (maxWidth / aspectRatio <= maxHeight) {
			baseWidth = maxWidth;
			baseHeight = maxWidth / aspectRatio;
		} else {
			baseWidth = maxHeight * aspectRatio;
			baseHeight = maxHeight;
		}

		// Calculate camp positions
		if (camps.length > 0) {
			const positions = camps.map(camp => {
				const paldexCoords = normalizeToTopLeft(camp.Coords);
				const x = paldexCoords.x * baseWidth;
				const y = paldexCoords.y * baseHeight;
				return { ...camp, x, y };
			});
			campPositions = positions;
		}
		
		// Calculate dungeon positions
		if (dungeons.length > 0) {
			const positions = dungeons.map(dungeon => {
				const paldexCoords = normalizeToTopLeft({ x: dungeon.X, y: dungeon.Y });
				const x = paldexCoords.x * baseWidth;
				const y = paldexCoords.y * baseHeight;
				return { ...dungeon, x, y };
			});
			dungeonPositions = positions;
		}
	}

	$effect(() => {
		// Recalculate when camps/dungeons change or when calibration values change
		// Include offsetX, offsetY, coordScale in the effect to track changes
		offsetX; offsetY; coordScale; // Access these to make effect reactive to them
		
		if ((camps.length > 0 || dungeons.length > 0) && mapElement) {
			// Add small delay to ensure DOM is updated
			setTimeout(calculateMapPositions, 0);
		}
	});

	function formatTimeUntilDisappear(disappearAtTicks: number | undefined): string {
		if (!disappearAtTicks) return '';
		
		const currentTicks = Date.now() * 10000 + 621355968000000000; // Convert to .NET ticks
		const timeDiff = disappearAtTicks - currentTicks;
		
		if (timeDiff <= 0) return 'Expired';
		
		const seconds = Math.floor(timeDiff / 10000000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		
		if (hours > 0) {
			const remainingMinutes = minutes % 60;
			return `In ${hours}h ${remainingMinutes}m`;
		} else if (minutes > 0) {
			const remainingSeconds = seconds % 60;
			return `In ${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
		} else {
			return `In ${seconds}s`;
		}
	}

	function handleWheel(event: WheelEvent) {
		event.preventDefault();
		
		if (event.shiftKey) {
			// Shift + wheel: adjust coordinate scale for calibration (if needed)
			const delta = event.deltaY > 0 ? 0.95 : 1.05;
			coordScale = Math.max(0.1, Math.min(3, coordScale * delta));
		} else {
			// Normal wheel: zoom the view
			const delta = event.deltaY > 0 ? 0.9 : 1.1;
			const newZoom = Math.max(0.5, Math.min(25, zoom * delta));
			
			if (newZoom !== zoom) {
				const rect = containerElement.getBoundingClientRect();
				const centerX = event.clientX - rect.left;
				const centerY = event.clientY - rect.top;
				
				// Adjust pan to zoom towards mouse position
				panX = centerX - (centerX - panX) * (newZoom / zoom);
				panY = centerY - (centerY - panY) * (newZoom / zoom);
				
				zoom = newZoom;
			}
		}
	}

	function handleMouseDown(event: MouseEvent) {
		isDragging = true;
		dragStartX = event.clientX;
		dragStartY = event.clientY;
		dragStartPanX = panX;
		dragStartPanY = panY;
		event.preventDefault();
	}

	function handleMouseMove(event: MouseEvent) {
		if (!isDragging) return;
		
		const deltaX = event.clientX - dragStartX;
		const deltaY = event.clientY - dragStartY;
		
		panX = dragStartPanX + deltaX;
		panY = dragStartPanY + deltaY;
	}

	function handleMouseUp() {
		isDragging = false;
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (!event.ctrlKey) return;
		
		event.preventDefault();
		const step = 10; // pixels of adjustment
		
		switch (event.key) {
			case 'ArrowUp':
				offsetY -= step;
				break;
			case 'ArrowDown':
				offsetY += step;
				break;
			case 'ArrowLeft':
				offsetX -= step;
				break;
			case 'ArrowRight':
				offsetX += step;
				break;
		}
	}

	function showDungeonTooltip(event: MouseEvent, dungeon: any) {
		const rect = containerElement.getBoundingClientRect();
		tooltipX = event.clientX - rect.left + 10;
		tooltipY = event.clientY - rect.top - 10;
		tooltipDungeon = dungeon;
		tooltipVisible = true;
	}

	function hideDungeonTooltip() {
		tooltipVisible = false;
		tooltipDungeon = null;
	}
</script>

<!-- Main Content Area with Left Panel -->
<div class="h-full flex overflow-hidden">
	<!-- Left Panel -->
	<aside class="w-[350px] bg-slate-800 border-r border-slate-700 overflow-y-auto">
		<div class="p-4">
			<h2 class="text-lg font-semibold text-white mb-4">Map Filters</h2>
			
			<!-- Filter Controls -->
			<div class="space-y-4">
				<div class="space-y-3">
					<label class="flex items-center space-x-3 text-white cursor-pointer hover:text-blue-300 transition-colors">
						<input type="checkbox" bind:checked={showCamps} class="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-2" />
						<span class="text-sm font-medium">Show Camps</span>
					</label>
					<label class="flex items-center space-x-3 text-white cursor-pointer hover:text-blue-300 transition-colors">
						<input type="checkbox" bind:checked={showDungeons} class="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-2" />
						<span class="text-sm font-medium">Show Dungeons</span>
					</label>
				</div>
				
				{#if showDungeons}
					<div class="ml-6 space-y-2 border-l-2 border-slate-600 pl-4">
						<label class="flex items-center space-x-3 text-slate-300 cursor-pointer hover:text-blue-300 transition-colors">
							<input type="checkbox" bind:checked={showActiveDungeons} class="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-2" />
							<span class="text-sm">Active Dungeons</span>
						</label>
						<label class="flex items-center space-x-3 text-slate-300 cursor-pointer hover:text-blue-300 transition-colors">
							<input type="checkbox" bind:checked={showInactiveDungeons} class="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500 focus:ring-2" />
							<span class="text-sm">Inactive Dungeons</span>
						</label>
					</div>
				{/if}
			</div>
		</div>
	</aside>

	<!-- Map Container -->
	<div 
		class="flex-1 map-container"
		bind:this={containerElement}
		onwheel={handleWheel}
		onmousedown={handleMouseDown}
		onmousemove={handleMouseMove}
		onmouseup={handleMouseUp}
		onmouseleave={handleMouseUp}
		onkeydown={handleKeyDown}
		role="application"
		tabindex="0"
	>
	<div 
		class="map-wrapper"
		style="transform: translate({panX}px, {panY}px) scale({zoom}); transform-origin: 0 0;"
	>
		<img 
			bind:this={mapElement}
			src="/T_WorldMap.png" 
			alt="World Map" 
			class="world-map"
			draggable="false"
			onload={() => { calculateMapPositions(); setInitialCenter(); }}
		/>
		
		{#if showCamps}
			{#each campPositions as camp}
				<img 
					src="/T_icon_compass_camp.png" 
					alt="Camp {camp.GroupId}" 
					class="camp-icon"
					style="left: {camp.x}px; top: {camp.y}px; transform: translate(-50%, -50%) scale({1/zoom});"
					title="Camp {camp.GroupId}"
					draggable="false"
				/>
			{/each}
		{/if}
		
		{#if showDungeons}
			{#each dungeonPositions as dungeon}
				{#if (dungeon.IsActive && showActiveDungeons) || (!dungeon.IsActive && showInactiveDungeons)}
					<img 
						src="/T_icon_compass_dungeon.png"
						alt="Dungeon {dungeon.Name}" 
						class="dungeon-icon"
						class:active={dungeon.IsActive}
						class:inactive={!dungeon.IsActive}
						style="left: {dungeon.x}px; top: {dungeon.y}px; transform: translate(-50%, -50%) scale({1/zoom});"
						onmouseenter={(e) => showDungeonTooltip(e, dungeon)}
						onmouseleave={hideDungeonTooltip}
						draggable="false"
					/>
				{/if}
			{/each}
		{/if}
		
		</div>
		
		<!-- Custom Tooltip (outside of zoom wrapper) -->
		{#if tooltipVisible && tooltipDungeon}
			<div 
				class="dungeon-tooltip"
				style="left: {tooltipX}px; top: {tooltipY}px;"
			>
				<div class="tooltip-header">
					<span class="tooltip-status" class:active={tooltipDungeon.IsActive} class:inactive={!tooltipDungeon.IsActive}>
						{tooltipDungeon.IsActive ? 'Active' : 'Inactive'}
					</span>
				</div>
				
				{#if tooltipDungeon.IsActive && tooltipDungeon.DisappearAtTicks}
					<div class="tooltip-timer">
						<svg class="timer-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
							<circle cx="12" cy="12" r="10"></circle>
							<polyline points="12,6 12,12 16,14"></polyline>
						</svg>
						<span>{formatTimeUntilDisappear(tooltipDungeon.DisappearAtTicks)}</span>
					</div>
				{/if}
				
				<div class="tooltip-coords">
					<span>X: {Math.round(tooltipDungeon.X)}, Y: {Math.round(tooltipDungeon.Y)}</span>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.map-container {
		overflow: hidden;
		cursor: grab;
		user-select: none;
		background: #1a1a1a;
	}

	.map-container:active {
		cursor: grabbing;
	}

	.map-wrapper {
		position: relative;
		width: fit-content;
		height: fit-content;
	}

	.world-map {
		display: block;
		max-width: 80vw;
		max-height: 80vh;
		width: auto;
		height: auto;
	}

	.camp-icon {
		position: absolute;
		width: 48px;
		height: 48px;
		z-index: 10;
		pointer-events: none;
		filter: drop-shadow(0 0 4px rgba(255, 215, 0, 0.8));
	}
	
	.dungeon-icon {
		position: absolute;
		width: 32px;
		height: 32px;
		z-index: 10;
		pointer-events: auto;
		filter: drop-shadow(0 0 4px rgba(128, 0, 255, 0.8));
	}
	
	.dungeon-icon.active {
		filter: drop-shadow(0 0 4px rgba(255, 0, 0, 0.8));
	}
	
	.dungeon-icon.inactive {
		filter: drop-shadow(0 0 4px rgba(128, 128, 128, 0.8));
		opacity: 0.7;
	}

	.map-container:focus {
		outline: none;
	}

	.dungeon-tooltip {
		position: absolute;
		background: rgba(15, 23, 42, 0.95);
		border: 1px solid #475569;
		border-radius: 8px;
		padding: 12px;
		z-index: 1000;
		pointer-events: none;
		backdrop-filter: blur(8px);
		box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
		min-width: 200px;
		color: white;
	}

	.tooltip-header {
		margin-bottom: 8px;
	}

	.tooltip-status {
		padding: 2px 8px;
		border-radius: 4px;
		font-size: 11px;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.tooltip-status.active {
		background: #dc2626;
		color: #fef2f2;
	}

	.tooltip-status.inactive {
		background: #64748b;
		color: #f1f5f9;
	}

	.tooltip-timer {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 6px;
		color: #fbbf24;
		font-size: 13px;
		font-weight: 500;
	}

	.timer-icon {
		width: 14px;
		height: 14px;
		stroke-width: 2;
	}

	.tooltip-coords {
		font-size: 11px;
		color: #94a3b8;
		font-family: monospace;
	}
</style>
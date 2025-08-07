import { writable } from 'svelte/store';

export interface MapFilters {
	showCamps: boolean;
	showDungeons: boolean;
	showActiveDungeons: boolean;
	showInactiveDungeons: boolean;
	showPlayers: boolean;
}

export const mapFilters = writable<MapFilters>({
	showCamps: true,
	showDungeons: true,
	showActiveDungeons: true,
	showInactiveDungeons: true,
	showPlayers: true
});
// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type SaveFileWatcher from '$lib/SaveFileWatcher';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			saveWatcher: SaveFileWatcher | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {Pal} from "$save-edit/models/Pal";
import type {CharacterCardData, PlayerCardData} from '$lib/CharacterCardData';
import {sav_to_map} from "$lib/map_utils";

export const GET: RequestHandler = async ({ params, locals, url }) => {
    try {
        const {id} = params;
        const version = url.searchParams.get('version') || 'Live';
        const saveWatcher = locals.saveWatcher;

        if (!saveWatcher) {
            return json({error: 'Save file watcher not available'}, {status: 503});
        }

        // For now, only support Live version (cache data)
        // TODO: Implement backup version loading when needed
        if (version !== 'Live') {
            return json({error: 'Backup versions not yet supported'}, {status: 501});
        }

        // Get server data from cache
        const serverSave = saveWatcher.getServerSave(id);
        return json(serverSave.BaseCamps);
    }
    catch (err) {
        console.error(`Error getting world details for ${params.id}:`, err);
        return error(500, 'Failed to load world details');
    }
};
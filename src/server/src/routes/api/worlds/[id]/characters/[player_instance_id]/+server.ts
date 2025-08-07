import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {Pal} from "$save-edit/models/Pal";
import type {CharacterCardData, FullPlayerCardData, PlayerCardData} from '$lib/CharacterCardData';
import {toFullPlayerCard} from "$lib/mappers";
import type {Player} from "$save-edit/models/Player";
import {splitGuids} from "$lib/guidUtils";



export const GET: RequestHandler = async ({ params, locals, url }) => {
    try {
        const { id, player_instance_id } = params;
        const saveWatcher = locals.saveWatcher;

        if (!saveWatcher) {
            return json({ error: 'Save file watcher not available' }, { status: 503 });
        }

        const serverSave = saveWatcher.getServerSave(id);

        if (!serverSave) {
            return error(404, `Server ${id} not found`);
        }

        const [playerId, instanceId] = splitGuids(player_instance_id);
        const pWorld = serverSave.Characters.find(a=> a.PlayerId === playerId && a.InstanceId === instanceId) as Player;
        const pSave = saveWatcher.getPlayers(id).find(a=> a.PlayerUid === playerId && a.InstanceId === instanceId);

        if (!pWorld) {
            return error(404, `Player not found with PlayerId: ${playerId} and InstanceId: ${instanceId}`);
        }

        if (!pSave) {
            return error(404, `Player save not found with PlayerUid: ${playerId} and InstanceId: ${instanceId}`);
        }

        const cardData = toFullPlayerCard(pWorld, pSave, serverSave) as FullPlayerCardData;

        return json(cardData);

    } catch (err) {
        console.error(`Error getting world details for ${params.id}:`, err);
        return error(500, 'Failed to load world details');
    }
};
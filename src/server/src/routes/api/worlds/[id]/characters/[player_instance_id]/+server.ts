import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {Pal} from "$save-edit/models/Pal";
import type {CharacterCardData, FullPlayerCardData, PlayerCardData} from '$lib/CharacterCardData';
import {toFullPlayerCard} from "$lib/mappers";
import type {Player} from "$save-edit/models/Player";

function splitGuids(encoded: string): [string, string] {
    // Parse base36 string as BigInt
    let combined = 0n;
    for (let i = 0; i < encoded.length; i++) {
        const digit = encoded.charCodeAt(i);
        const value = digit >= 48 && digit <= 57 ? digit - 48 : digit - 87; // 0-9, a-z
        combined = combined * 36n + BigInt(value);
    }

    const hex = combined.toString(16).padStart(64, '0');

    const guid1 = hex.slice(0, 32).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
    const guid2 = hex.slice(32).replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');

    return [guid1, guid2];
}

export const GET: RequestHandler = async ({ params, locals, url }) => {
    try {
        const { id, player_instance_id } = params;
        const version = url.searchParams.get('version') || 'Live';
        const saveWatcher = locals.saveWatcher;

        if (!saveWatcher) {
            return json({ error: 'Save file watcher not available' }, { status: 503 });
        }

        if (version !== 'Live') {
            return json({ error: 'Backup versions not yet supported' }, { status: 501 });
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
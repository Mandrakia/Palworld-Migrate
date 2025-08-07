import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {Pal} from "$save-edit/models/Pal";
import type {CharacterCardData, PlayerCardData} from '$lib/CharacterCardData';

export const GET: RequestHandler = async ({ params, locals, url }) => {
  try {
    const { id } = params;
    const version = url.searchParams.get('version') || 'Live';
    const saveWatcher = locals.saveWatcher;
    
    if (!saveWatcher) {
      return json({ error: 'Save file watcher not available' }, { status: 503 });
    }
    
    // For now, only support Live version (cache data)
    // TODO: Implement backup version loading when needed
    if (version !== 'Live') {
      return json({ error: 'Backup versions not yet supported' }, { status: 501 });
    }
    
    // Get server data from cache
    const serverSave = saveWatcher.getServerSave(id);
    
    if (!serverSave) {
      return error(404, `Server ${id} not found`);
    }
    
    // Get players from Level.sav Characters filtered by IsPlayer
    const players = serverSave.Characters?.filter(character => {
      try {
        // Try calling IsPlayer as a getter
        return character.IsPlayer === true;
      } catch {
        try {
          // Try accessing as property
          return character.IsPlayer === true;
        } catch {
          return false;
        }
      }
    }) || [];
    const playerCards: PlayerCardData[] = [];
    for(let pWorld of players) {
        const pSave = saveWatcher.getPlayers(id).find(a=> a.PlayerUid === pWorld.PlayerId && a.InstanceId === pWorld.InstanceId);
        if(!pSave) continue;
        const pals = serverSave.Characters.filter(a => a instanceof Pal) as Pal[];
        const palCount = pals.filter(a=> a.ContainerId == pSave?.PalStorageContainerId).length;

        playerCards.push({
            type: "player",
            id: pWorld.PlayerId || 'unknown',
            instanceId: pWorld.InstanceId || 'unknown',
            name: pWorld.Nickname || pWorld.FilteredNickname || 'Unnamed Player',
            level: pWorld.Level || 1,
            stats: pWorld.Stats,
            addedStats: pWorld.AddedStats,
            palCount: palCount, // Would need to count owned pals from somewhere else
            gold: 0     // Would need to extract from inventory
        });
    }
    return json({
      server: {
        id: id,
        timestamp: serverSave.Timestamp,
        playerCount: playerCards.length,
        version: version
      },
      players: playerCards,
    });
    
  } catch (err) {
    console.error(`Error getting world details for ${params.id}:`, err);
    return error(500, 'Failed to load world details');
  }
};
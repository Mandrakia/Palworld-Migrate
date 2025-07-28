import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  try {
    const saveWatcher = locals.saveWatcher;
    
    if (!saveWatcher) {
      return json({ error: 'Save file watcher not available' }, { status: 503 });
    }
    
    const serverIds = saveWatcher.getAllServers();
    const worlds = [];
    
    for (const serverId of serverIds) {
      try {
        const players = saveWatcher.getPlayers(serverId);
        const backups = saveWatcher.getBackups(serverId);
        
        worlds.push({
          Id: serverId,
          PlayerCount: players.length,
          Backups: backups
        });
      } catch (error) {
        console.error(`Failed to get data for server ${serverId}:`, error);
        // Still include server but with default values
        worlds.push({
          Id: serverId,
          PlayerCount: 0,
          Backups: []
        });
      }
    }
    
    return json(worlds);
  } catch (error) {
    console.error('Error processing worlds:', error);
    return json({ error: 'Failed to load worlds' }, { status: 500 });
  }
};
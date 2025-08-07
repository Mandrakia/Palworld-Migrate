import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type {WorldDetail} from "$lib/interfaces";
import {PalRestApiClient} from "$lib/PalRestApiClient";
import type {Player} from "$save-edit/models/Player";

export const GET: RequestHandler = async ({ locals }) => {
  try {
    const saveWatcher = locals.saveWatcher;
    
    if (!saveWatcher) {
      return json({ error: 'Save file watcher not available' }, { status: 503 });
    }
    
    const serverCaches = saveWatcher.getAllServers();
    const worlds : WorldDetail[] = [];
    
    for (const serverCache of serverCaches) {
        const world : WorldDetail = {
            id: serverCache.id,
            players : serverCache.serverSave.Characters.filter(a=> a.IsPlayer && serverCache.players.find(x=> x.PlayerUid == a.PlayerId && x.InstanceId == a.InstanceId)).map(character =>{
                const player = character as Player;
                return {
                    id: player.PlayerId,
                    fileId: player.PlayerId.replaceAll('-','').toUpperCase(),
                    name: player.Nickname,
                    instanceId: player.InstanceId,
                    level: player.Level,
                }
            }),
            lastModified: serverCache.lastModified,
            palCount: serverCache.serverSave.Characters.filter(a=> !a.IsPlayer).length
        };
      try {
          if(serverCache.settings.rest_host && serverCache.settings.rest_password) {
              const restClient = new PalRestApiClient(serverCache.settings.rest_host, serverCache.settings.rest_protocol ?? "http", serverCache.settings.rest_password);
              const sInfo = await restClient.getServerInfo();
              world.name = sInfo.servername;
              world.description = sInfo.description != "" ? sInfo.description : undefined;
              const players = await restClient.getPlayerList();
              for(const player of players.players) {
                  const oP = world.players.find(x=> x.fileId === player.playerId);
                  if(oP) {
                      oP.isOnline = true;
                      oP.x = player.location_x;
                      oP.y = player.location_y;
                      oP.accountName = player.accountName;
                  }
              }
          }

        worlds.push(world);
      } catch (error) {
        console.error(`Failed to get data for server ${serverCache.id}:`, error);
        // Still include server but with default values
        worlds.push({
          Id: serverCache.id,
          PlayerCount: 0
        });
      }
    }
    
    return json(worlds);
  } catch (error) {
    console.error('Error processing worlds:', error);
    return json({ error: 'Failed to load worlds' }, { status: 500 });
  }
};
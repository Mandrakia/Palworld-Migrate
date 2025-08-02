import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {Pal} from "$save-edit/models/Pal";
import rawDungeons from "$lib/dungeons.json";
import type {Dungeon} from "$lib";
import type {DungeonSaveData} from "$save-edit/models/DungeonSaveData";

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

        const dungeons : Dungeon[] = rawDungeons;
        const serverSave = saveWatcher.getServerSave(id);
        
        // Get server time data for timestamp conversion
        const serverGameTime = serverSave.GameTime;
        const serverRealTime = serverSave.RealTime;
        
        // Calculate the offset between game time and real time
        const gameToRealOffset = serverRealTime - serverGameTime;
        
        return json(dungeons.map(dungeon=>{
            const state : DungeonSaveData = serverSave.DungeonSaveData.find(a=> a.MarkerPointId === dungeon.Id)
            
            // Convert game time ticks to real Unix timestamps
            let disappearAt: number | null = null;
            let respawnAt: number | null = null;
            
            if (state?.DisappearTimeAt) {
                // Convert game time to real time, then to Unix timestamp
                const realTimeTicks = state.DisappearTimeAt + gameToRealOffset;
                disappearAt = Math.floor((realTimeTicks - 621355968000000000) / 10000 / 1000);
            }
            
            if (state?.RespawnBossTimeAt) {
                // Convert game time to real time, then to Unix timestamp
                const realTimeTicks = state.RespawnBossTimeAt + gameToRealOffset;
                respawnAt = Math.floor((realTimeTicks - 621355968000000000) / 10000 / 1000);
            }
            
            return {
                ...dungeon, 
                IsActive: state && state.BossState === "EPalDungeonInstanceBossState::Spawned", 
                DisappearAtTicks: state?.DisappearTimeAt, 
                RespawnAtTicks: state?.RespawnBossTimeAt,
                DisappearAt: disappearAt,
                RespawnAt: respawnAt
            }

        }));
    }
    catch (err) {
        console.error(`Error getting world details for ${params.id}:`, err);
        return error(500, 'Failed to load world details');
    }
};
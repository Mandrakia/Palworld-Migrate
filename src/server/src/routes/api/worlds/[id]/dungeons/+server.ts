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
        
        // Debug logging
        console.log('Server GameTime:', serverGameTime);
        console.log('Server RealTime:', serverRealTime);
        console.log('Current Unix timestamp:', Math.floor(Date.now() / 1000));
        
        // Calculate the offset between game time and real time
        const gameToRealOffset = serverRealTime - serverGameTime;
        
        return json(dungeons.map(dungeon=>{
            const state : DungeonSaveData = serverSave.DungeonSaveData.find(a=> a.MarkerPointId === dungeon.Id)
            
            // Convert game time ticks to real Unix timestamps
            let disappearAt: number | null = null;
            let respawnAt: number | null = null;
            
            if (state?.DisappearTimeAt) {
                // Try different approaches to see what works
                
                // Approach 1: DisappearTimeAt is already Unix time in ticks
                const approach1 = Math.floor(state.DisappearTimeAt / 10000 / 1000);
                
                // Approach 2: DisappearTimeAt is .NET DateTime ticks
                const approach2 = Math.floor((state.DisappearTimeAt - 621355968000000000) / 10000 / 1000);
                
                // Approach 3: Game time difference method
                const gameTimeDiff = state.DisappearTimeAt - serverGameTime;
                const currentUnixTime = Math.floor(serverRealTime / 10000 / 1000);
                const approach3 = currentUnixTime + Math.floor(gameTimeDiff / 10000 / 1000);
                
                // Current timestamp for comparison
                const nowUnix = Math.floor(Date.now() / 1000);
                
                console.log('Testing approaches:', {
                    dungeonId: dungeon.Id,
                    disappearTimeAt: state.DisappearTimeAt,
                    serverGameTime,
                    serverRealTime,
                    currentUnix: nowUnix,
                    approach1: { value: approach1, minutesFromNow: (approach1 - nowUnix) / 60 },
                    approach2: { value: approach2, minutesFromNow: (approach2 - nowUnix) / 60 },
                    approach3: { value: approach3, minutesFromNow: (approach3 - nowUnix) / 60 },
                    shouldBe137mins: 'Which approach gives ~137 minutes?'
                });
                
                // For now, use approach 1
                disappearAt = approach1;
            }
            
            if (state?.RespawnBossTimeAt) {
                // RespawnBossTimeAt is in game time ticks, convert to real time
                const gameTimeDiff = state.RespawnBossTimeAt - serverGameTime;
                const currentUnixTime = Math.floor(serverRealTime / 10000 / 1000);
                const gameTimeDiffSeconds = Math.floor(gameTimeDiff / 10000 / 1000);
                respawnAt = currentUnixTime + gameTimeDiffSeconds;
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
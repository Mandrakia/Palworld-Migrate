import { watch, type FSWatcher } from 'chokidar';
import { readdir, stat } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { environment } from './env';
import { ServerSave } from '$save-edit/models/ServerSave';
import { CharacterSave } from '$save-edit/models/CharacterSave';
import { loadServerFile, convertPlayerFile } from './loader';

interface PlayerFileCache {
  character: CharacterSave;
  lastModified: Date;
}

interface ServerCache {
  serverSave: ServerSave | null;
  players: CharacterSave[];
  backups: string[];
  lastModified: Date;
  isLoading: boolean;
  playerFiles: Record<string, PlayerFileCache>;
}

class SaveFileWatcher {
  private static instance: SaveFileWatcher;
  private cache: Record<string, ServerCache> = {};
  private watcher: FSWatcher | null = null;
  private debounceTimers: Record<string, NodeJS.Timeout> = {};

  private constructor() {}

  static getInstance(): SaveFileWatcher {
    if (!SaveFileWatcher.instance) {
      SaveFileWatcher.instance = new SaveFileWatcher();
    }
    return SaveFileWatcher.instance;
  }

  async initialize(): Promise<void> {
    console.log('Initializing SaveFileWatcher...');
    
    try {
      await this.loadInitialCache();
      this.startWatching();
      console.log('SaveFileWatcher initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SaveFileWatcher:', error);
      throw error;
    }
  }

  private async loadInitialCache(): Promise<void> {
    const savePath = environment.savePath;
    const serverIds = await this.getServerDirectories();
    
    for (const serverId of serverIds) {
      console.log(`Loading initial cache for server: ${serverId}`);
      await this.loadServerCache(serverId);
    }
  }

  private async getServerDirectories(): Promise<string[]> {
    const savePath = environment.savePath;
    const entries = await readdir(savePath);
    const directories: string[] = [];
    
    for (const entry of entries) {
      const fullPath = join(savePath, entry);
      const stats = await stat(fullPath);
      if (stats.isDirectory()) {
        directories.push(entry);
      }
    }
    
    return directories;
  }

  private async loadServerCache(serverId: string): Promise<void> {
    if (!this.cache[serverId]) {
      this.cache[serverId] = {
        serverSave: null,
        players: [],
        backups: [],
        lastModified: new Date(),
        isLoading: false,
        playerFiles: {}
      };
    }

    const serverCache = this.cache[serverId];
    serverCache.isLoading = true;

    try {
      // Load main server save
      await this.loadServerSave(serverId);
      
      // Load all player files
      await this.loadPlayerFiles(serverId);
      
      // Load backup directories
      await this.loadBackupDirectories(serverId);
      
      serverCache.lastModified = new Date();
    } catch (error) {
      console.error(`Failed to load cache for server ${serverId}:`, error);
    } finally {
      serverCache.isLoading = false;
    }
  }

  private async loadServerSave(serverId: string): Promise<void> {
    try {
      const serverSave = await loadServerFile(serverId);
      this.cache[serverId].serverSave = serverSave;
      console.log(`Loaded server save for: ${serverId}`);
    } catch (error) {
      console.error(`Failed to load server save for ${serverId}:`, error);
      this.cache[serverId].serverSave = null;
    }
  }

  private async loadPlayerFiles(serverId: string): Promise<void> {
    const savePath = environment.savePath;
    const playersDir = join(savePath, serverId, 'Players');
    
    try {
      const playerFiles = await readdir(playersDir);
      const players: CharacterSave[] = [];
      const playerFileCache: Record<string, PlayerFileCache> = {};
      
      for (const file of playerFiles) {
        if (file.endsWith('.sav')) {
          const guid = file.replace('.sav', '');
          const filePath = join(playersDir, file);
          
          try {
            const stats = await stat(filePath);
            const character = await convertPlayerFile(serverId, guid);
            
            players.push(character);
            playerFileCache[guid] = {
              character,
              lastModified: stats.mtime
            };
            
            console.log(`Loaded player file: ${guid}`);
          } catch (error) {
            console.error(`Failed to load player file ${guid}:`, error);
          }
        }
      }
      
      this.cache[serverId].players = players;
      this.cache[serverId].playerFiles = playerFileCache;
    } catch (error) {
      console.error(`Failed to load player files for ${serverId}:`, error);
      this.cache[serverId].players = [];
      this.cache[serverId].playerFiles = {};
    }
  }

  private async loadBackupDirectories(serverId: string): Promise<void> {
    const savePath = environment.savePath;
    const backupWorldDir = join(savePath, serverId, 'backup', 'world');
    
    try {
      const backupEntries = await readdir(backupWorldDir);
      const backups: string[] = [];
      
      for (const entry of backupEntries) {
        const fullPath = join(backupWorldDir, entry);
        const stats = await stat(fullPath);
        if (stats.isDirectory()) {
          backups.push(entry);
        }
      }
      
      // Sort backup directories by name (datetime strings)
      backups.sort();
      this.cache[serverId].backups = backups;
      console.log(`Loaded ${backups.length} backup directories for: ${serverId}`);
    } catch (error) {
      console.error(`Failed to load backup directories for ${serverId}:`, error);
      this.cache[serverId].backups = [];
    }
  }

  private startWatching(): void {
    const savePath = environment.savePath;
    
    // Only watch specific files: Level.sav and Players/*.sav
    const watchPatterns = [
      join(savePath, '*/Level.sav'),
      join(savePath, '*/Players/*.sav')
    ];
    
    this.watcher = watch(watchPatterns, {
      ignored: /\.tmp$|\.temp$/,
      persistent: true,
      ignoreInitial: true
    });

    this.watcher
      .on('change', (path) => this.handleFileChange(path))
      .on('add', (path) => this.handleFileAdd(path))
      .on('unlink', (path) => this.handleFileDelete(path))
      .on('error', (error) => console.error('File watcher error:', error));

    console.log(`Started watching save files: Level.sav and Players/*.sav in: ${savePath}`);
  }

  private handleFileChange(filePath: string): void {
    this.debounceFileOperation(filePath, () => {
      console.log(`File changed: ${filePath}`);
      this.processFileChange(filePath);
    });
  }

  private handleFileAdd(filePath: string): void {
    this.debounceFileOperation(filePath, () => {
      console.log(`File added: ${filePath}`);
      this.processFileChange(filePath);
    });
  }

  private handleFileDelete(filePath: string): void {
    console.log(`File deleted: ${filePath}`);
    this.processFileDelete(filePath);
  }


  private debounceFileOperation(filePath: string, operation: () => void): void {
    const key = filePath;
    
    if (this.debounceTimers[key]) {
      clearTimeout(this.debounceTimers[key]);
    }
    
    this.debounceTimers[key] = setTimeout(() => {
      operation();
      delete this.debounceTimers[key];
    }, 30000); // 30 second debounce
  }

  private async processFileChange(filePath: string): Promise<void> {
    const serverId = this.extractServerIdFromPath(filePath);
    if (!serverId) return;

    const fileName = basename(filePath);
    
    if (fileName === 'Level.sav') {
      await this.loadServerSave(serverId);
    } else if (filePath.includes('/Players/') && fileName.endsWith('.sav')) {
      const guid = fileName.replace('.sav', '');
      await this.loadSinglePlayerFile(serverId, guid);
    }
  }

  private async processFileDelete(filePath: string): Promise<void> {
    const serverId = this.extractServerIdFromPath(filePath);
    if (!serverId) return;

    if (filePath.includes('/Players/') && filePath.endsWith('.sav')) {
      const guid = basename(filePath).replace('.sav', '');
      this.removePlayers(serverId, guid);
    }
  }


  private async loadSinglePlayerFile(serverId: string, guid: string): Promise<void> {
    try {
      const character = await convertPlayerFile(serverId, guid);
      const savePath = environment.savePath;
      const filePath = join(savePath, serverId, 'Players', `${guid}.sav`);
      const stats = await stat(filePath);

      // Update cache
      const serverCache = this.cache[serverId];
      if (serverCache) {
        // Remove old version if exists
        serverCache.players = serverCache.players.filter(p => 
          p.PlayerId !== character.PlayerId
        );
        
        // Add new version
        serverCache.players.push(character);
        serverCache.playerFiles[guid] = {
          character,
          lastModified: stats.mtime
        };
        
        console.log(`Updated player file in cache: ${guid}`);
      }
    } catch (error) {
      console.error(`Failed to load single player file ${guid}:`, error);
    }
  }

  private removePlayers(serverId: string, guid: string): void {
    const serverCache = this.cache[serverId];
    if (serverCache) {
      serverCache.players = serverCache.players.filter(p => {
        // Remove based on guid since we may not have PlayerId
        return !serverCache.playerFiles[guid] || 
               p.PlayerId !== serverCache.playerFiles[guid].character.PlayerId;
      });
      
      delete serverCache.playerFiles[guid];
      console.log(`Removed player from cache: ${guid}`);
    }
  }

  private extractServerIdFromPath(filePath: string): string | null {
    const savePath = environment.savePath;
    const relativePath = filePath.replace(savePath, '').replace(/^[\/\\]/, '');
    const parts = relativePath.split(/[\/\\]/);
    return parts.length > 0 ? parts[0] : null;
  }

  // Public API methods
  getServerCache(serverId: string): ServerCache | null {
    return this.cache[serverId] || null;
  }

  getAllServers(): string[] {
    return Object.keys(this.cache);
  }

  getServerSave(serverId: string): ServerSave | null {
    return this.cache[serverId]?.serverSave || null;
  }

  getPlayers(serverId: string): CharacterSave[] {
    return this.cache[serverId]?.players || [];
  }

  getBackups(serverId: string): string[] {
    return this.cache[serverId]?.backups || [];
  }

  isServerLoading(serverId: string): boolean {
    return this.cache[serverId]?.isLoading || false;
  }

  async refreshServer(serverId: string): Promise<void> {
    await this.loadServerCache(serverId);
  }

  destroy(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    
    // Clear all debounce timers
    Object.values(this.debounceTimers).forEach(timer => clearTimeout(timer));
    this.debounceTimers = {};
    
    console.log('SaveFileWatcher destroyed');
  }
}

export default SaveFileWatcher;
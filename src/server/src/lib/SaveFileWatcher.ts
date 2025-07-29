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
    console.log('SaveFileWatcher: Getting server directories from:', savePath);
    
    try {
      const entries = await readdir(savePath);
      console.log('SaveFileWatcher: Found entries:', entries);
      const directories: string[] = [];
      
      for (const entry of entries) {
        const fullPath = join(savePath, entry);
        const stats = await stat(fullPath);
        if (stats.isDirectory()) {
          directories.push(entry);
          console.log('SaveFileWatcher: Added server directory:', entry);
        }
      }
      
      console.log('SaveFileWatcher: Final server directories:', directories);
      return directories;
    } catch (error) {
      console.error('SaveFileWatcher: Error reading server directories:', error);
      return [];
    }
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
    
    // Watch the entire save directory and filter events
    console.log('SaveFileWatcher: Setting up file watching...');
    console.log('SaveFileWatcher: Watching path:', savePath);
    
    this.watcher = watch(savePath, {
      ignored: /\.tmp$|\.temp$/,
      persistent: true,
      ignoreInitial: true,
      usePolling: false,
      interval: 1000,
      binaryInterval: 3000,
      alwaysStat: true,
      depth: 99,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });

    this.watcher
      .on('change', (path) => {
        console.log('SaveFileWatcher: File changed:', path);
        if (this.isRelevantFile(path)) {
          this.handleFileChange(path);
        } else {
          console.log('SaveFileWatcher: Ignoring irrelevant file:', path);
        }
      })
      .on('add', (path) => {
        console.log('SaveFileWatcher: File added:', path);
        if (this.isRelevantFile(path)) {
          this.handleFileAdd(path);
        } else {
          console.log('SaveFileWatcher: Ignoring irrelevant file:', path);
        }
      })
      .on('unlink', (path) => {
        console.log('SaveFileWatcher: File deleted:', path);
        if (this.isRelevantFile(path)) {
          this.handleFileDelete(path);
        } else {
          console.log('SaveFileWatcher: Ignoring irrelevant file:', path);
        }
      })
      .on('error', (error) => console.error('SaveFileWatcher: File watcher error:', error))
      .on('ready', () => console.log('SaveFileWatcher: Ready and watching for changes'))
      .on('raw', (event, path, details) => {
        console.log('SaveFileWatcher: Raw event:', event, 'for path:', path);
      });

    console.log(`SaveFileWatcher: Started watching save files in: ${savePath}`);
  }

  private isRelevantFile(filePath: string): boolean {
    const fileName = basename(filePath);
    const isLevelSav = fileName === 'Level.sav';
    const isPlayerSav = filePath.includes('/Players/') && fileName.endsWith('.sav');
    
    console.log(`SaveFileWatcher: Checking file relevance: ${filePath}`);
    console.log(`SaveFileWatcher: - Is Level.sav: ${isLevelSav}`);
    console.log(`SaveFileWatcher: - Is Player .sav: ${isPlayerSav}`);
    
    return isLevelSav || isPlayerSav;
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
          p.PlayerUid !== character.PlayerUid
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
               p.PlayerUid !== serverCache.playerFiles[guid].character.PlayerUid;
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
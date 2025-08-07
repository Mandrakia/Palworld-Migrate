import {watch, type FSWatcher} from 'chokidar';
import {readdir, stat} from 'fs/promises';
import {join, dirname, basename} from 'path';
import {environment} from './env';
import {ServerSave} from '$save-edit/models/ServerSave';
import {CharacterSave} from '$save-edit/models/CharacterSave';
import {loadServerFile, convertPlayerFile} from './loader';
import type {ServerSettings, WorldSettings} from "$lib/interfaces";

interface PlayerFileCache {
  character: CharacterSave;
  lastModified: Date;
}

interface ServerCache {
  serverSave: ServerSave | null;
  id: string;
  players: CharacterSave[];
  lastModified: Date;
  settings: ServerSettings
  isLoading: boolean;
  playerFiles: Record<string, PlayerFileCache>;
}

interface WorldIdMapping {
  originalId: string;
  uniqueId: string;
  settings: ServerSettings;
}

class SaveFileWatcher {
  private static instance: SaveFileWatcher;
  private cache: Record<string, ServerCache> = {};
  private watchers: FSWatcher[] = [];
  private debounceTimers: Record<string, NodeJS.Timeout> = {};
  private worldIdMappings: Map<string, WorldIdMapping> = new Map();

  private constructor() {
  }

  static getInstance(): SaveFileWatcher {
    if (!SaveFileWatcher.instance) {
      SaveFileWatcher.instance = new SaveFileWatcher();
    }
    return SaveFileWatcher.instance;
  }

  async initialize(): Promise<void> {
    console.log('Initializing SaveFileWatcher...');

    try {
      await this.buildWorldIdMappings();
      await this.loadInitialCache();
      this.startWatching();
      console.log('SaveFileWatcher initialized successfully');
      console.log('World ID mappings:', Array.from(this.worldIdMappings.entries()));
    } catch (error) {
      console.error('Failed to initialize SaveFileWatcher:', error);
      throw error;
    }
  }

  private async buildWorldIdMappings(): Promise<void> {
    const worlds = environment.worldSettings;
    const seenIds = new Set<string>();

    console.log('Building world ID mappings for paths:', worlds);

    for (let pathIndex = 0; pathIndex < worlds.length; pathIndex++) {
      const world = worlds[pathIndex];

      try {
        const serverDirectories = await this.getWorldDirectories(world);

        for (const originalId of serverDirectories) {
          let uniqueId = originalId;

          // Handle collisions by appending _index
          if (seenIds.has(originalId)) {
            uniqueId = `${originalId}_${pathIndex}`;
            console.log(`World ID collision detected: ${originalId} -> ${uniqueId}`);
          }

          seenIds.add(uniqueId);

          this.worldIdMappings.set(uniqueId, {
            originalId,
            uniqueId,
            settings: world
          });

          console.log(`Mapped world: ${originalId} -> ${uniqueId} (path: ${world.directory})`);
        }
      } catch (error) {
        console.error(`Failed to scan save path ${world.directory}:`, error);
      }
    }
  }

  private async getWorldDirectories(world: ServerSettings): Promise<string[]> {
    console.log('SaveFileWatcher: Getting server directories from:', world.directory);

    try {
      const entries = await readdir(world.directory);
      console.log('SaveFileWatcher: Found entries:', entries);
      const directories: string[] = [];

      for (const entry of entries) {
        const fullPath = join(world.directory, entry);
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

  private async loadInitialCache(): Promise<void> {
    console.log('Loading initial cache for all mapped worlds...');

    for (const [uniqueId, mapping] of this.worldIdMappings.entries()) {
      console.log(`Loading initial cache for world: ${uniqueId}`);
      await this.loadServerCache(uniqueId);
    }
  }

  private async loadServerCache(uniqueId: string): Promise<void> {
    const mapping = this.worldIdMappings.get(uniqueId);
    if (!mapping) {
      console.error(`No mapping found for world ID: ${uniqueId}`);
      return;
    }

    if (!this.cache[uniqueId]) {
      this.cache[uniqueId] = {
        id: uniqueId,
        serverSave: null,
        players: [],
        lastModified: new Date(),
        isLoading: false,
        playerFiles: {},
        settings: mapping.settings,
      };
    }

    const serverCache = this.cache[uniqueId];
    serverCache.isLoading = true;

    try {
      // Load main server save
      await this.loadServerSave(uniqueId);

      // Load all player files
      await this.loadPlayerFiles(uniqueId);
    } catch (error) {
      console.error(`Failed to load cache for server ${uniqueId}:`, error);
    } finally {
      serverCache.isLoading = false;
    }
  }

  private async loadServerSave(uniqueId: string): Promise<void> {
    try {
      const serverSave = await loadServerFile(uniqueId);
      this.cache[uniqueId].serverSave = serverSave;

      const mapping = this.worldIdMappings.get(uniqueId);
      if (!mapping) return;
      const serverFile = join(mapping.settings.directory, mapping.originalId, 'Level.sav');
      const stats = await stat(serverFile);
      this.cache[uniqueId].lastModified = stats.mtime;
      console.log(`Loaded server save for: ${uniqueId}`);
    } catch (error) {
      console.error(`Failed to load server save for ${uniqueId}:`, error);
      this.cache[uniqueId].serverSave = null;
    }
  }

  private async loadPlayerFiles(uniqueId: string): Promise<void> {
    const mapping = this.worldIdMappings.get(uniqueId);
    if (!mapping) return;

    const playersDir = join(mapping.settings.directory, mapping.originalId, 'Players');

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
            const character = await convertPlayerFile(uniqueId, guid);

            players.push(character);
            playerFileCache[guid] = {
              character,
              lastModified: stats.mtime
            };

            console.log(`Loaded player file: ${guid} for world ${uniqueId}`);
          } catch (error) {
            console.error(`Failed to load player file ${guid} for world ${uniqueId}:`, error);
          }
        }
      }

      this.cache[uniqueId].players = players;
      this.cache[uniqueId].playerFiles = playerFileCache;
    } catch (error) {
      console.error(`Failed to load player files for ${uniqueId}:`, error);
      this.cache[uniqueId].players = [];
      this.cache[uniqueId].playerFiles = {};
    }
  }

  private startWatching(): void {
    const worldSettings = environment.worldSettings;

    console.log('SaveFileWatcher: Setting up file watching for multiple paths...');

    for (const world of worldSettings) {
      console.log('SaveFileWatcher: Watching path:', world.directory);

      const watcher = watch(world.directory, {
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

      watcher
        .on('change', (path) => {
          console.log('SaveFileWatcher: File changed:', path);
          if (this.isRelevantFile(path)) {
            this.handleFileChange(path);
          }
        })
        .on('add', (path) => {
          console.log('SaveFileWatcher: File added:', path);
          if (this.isRelevantFile(path)) {
            this.handleFileAdd(path);
          }
        })
        .on('unlink', (path) => {
          console.log('SaveFileWatcher: File deleted:', path);
          if (this.isRelevantFile(path)) {
            this.handleFileDelete(path);
          }
        })
        .on('error', (error) => console.error('SaveFileWatcher: File watcher error:', error))
        .on('ready', () => console.log(`SaveFileWatcher: Ready and watching for changes in: ${world.directory}`));

      this.watchers.push(watcher);
    }

    console.log(`SaveFileWatcher: Started watching ${worldSettings.length} save paths`);
  }

  private isRelevantFile(filePath: string): boolean {
    const fileName = basename(filePath);
    const isLevelSav = fileName === 'Level.sav';
    const isPlayerSav = filePath.includes('/Players/') && fileName.endsWith('.sav');
    return isLevelSav || isPlayerSav;
  }

  private handleFileChange(filePath: string): void {
    this.debounceFileOperation(filePath, () => {
      this.processFileChange(filePath);
    });
  }

  private handleFileAdd(filePath: string): void {
    this.debounceFileOperation(filePath, () => {
      this.processFileChange(filePath);
    });
  }

  private handleFileDelete(filePath: string): void {
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
    const uniqueId = this.extractUniqueIdFromPath(filePath);
    if (!uniqueId) return;

    const fileName = basename(filePath);

    if (fileName === 'Level.sav') {
      await this.loadServerSave(uniqueId);
    } else if (filePath.includes('/Players/') && fileName.endsWith('.sav')) {
      const guid = fileName.replace('.sav', '');
      await this.loadSinglePlayerFile(uniqueId, guid);
    }
  }

  private async processFileDelete(filePath: string): Promise<void> {
    const uniqueId = this.extractUniqueIdFromPath(filePath);
    if (!uniqueId) return;

    if (filePath.includes('/Players/') && filePath.endsWith('.sav')) {
      const guid = basename(filePath).replace('.sav', '');
      this.removePlayers(uniqueId, guid);
    }
  }

  private async loadSinglePlayerFile(uniqueId: string, guid: string): Promise<void> {
    const mapping = this.worldIdMappings.get(uniqueId);
    if (!mapping) return;

    try {
      const character = await convertPlayerFile(uniqueId, guid);
      const filePath = join(mapping.savePath, mapping.originalId, 'Players', `${guid}.sav`);
      const stats = await stat(filePath);

      // Update cache
      const serverCache = this.cache[uniqueId];
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

        console.log(`Updated player file in cache: ${guid} for world ${uniqueId}`);
      }
    } catch (error) {
      console.error(`Failed to load single player file ${guid} for world ${uniqueId}:`, error);
    }
  }

  private removePlayers(uniqueId: string, guid: string): void {
    const serverCache = this.cache[uniqueId];
    if (serverCache) {
      serverCache.players = serverCache.players.filter(p => {
        // Remove based on guid since we may not have PlayerId
        return !serverCache.playerFiles[guid] ||
          p.PlayerUid !== serverCache.playerFiles[guid].character.PlayerUid;
      });

      delete serverCache.playerFiles[guid];
      console.log(`Removed player from cache: ${guid} for world ${uniqueId}`);
    }
  }

  private extractUniqueIdFromPath(filePath: string): string | null {
    // Find which save path this file belongs to and extract the unique ID
    for (const [uniqueId, mapping] of this.worldIdMappings.entries()) {
      if (filePath.startsWith(mapping.savePath)) {
        const relativePath = filePath.replace(mapping.savePath, '').replace(/^[\/\\]/, '');
        const parts = relativePath.split(/[\/\\]/);
        if (parts.length > 0 && parts[0] === mapping.originalId) {
          return uniqueId;
        }
      }
    }
    return null;
  }

  // Public API methods - updated to work with unique IDs
  getServerCache(uniqueId: string): ServerCache | null {
    return this.cache[uniqueId] || null;
  }

  getAllServers(): ServerCache[] {
    return Object.values(this.cache);
  }

  getServerSave(uniqueId: string): ServerSave | null {
    return this.cache[uniqueId]?.serverSave || null;
  }

  getPlayers(uniqueId: string): CharacterSave[] {
    return this.cache[uniqueId]?.players || [];
  }

  isServerLoading(uniqueId: string): boolean {
    return this.cache[uniqueId]?.isLoading || false;
  }

  async refreshServer(uniqueId: string): Promise<void> {
    await this.loadServerCache(uniqueId);
  }

  // Helper methods for world ID mappings
  getWorldMapping(uniqueId: string): WorldIdMapping | null {
    return this.worldIdMappings.get(uniqueId) || null;
  }

  getAllWorldMappings(): WorldIdMapping[] {
    return Array.from(this.worldIdMappings.values());
  }

  // Convert between unique and original IDs
  getUniqueIdFromOriginal(originalId: string, pathIndex?: number): string | null {
    for (const [uniqueId, mapping] of this.worldIdMappings.entries()) {
      if (mapping.originalId === originalId && (pathIndex === undefined || mapping.pathIndex === pathIndex)) {
        return uniqueId;
      }
    }
    return null;
  }

  getOriginalIdFromUnique(uniqueId: string): string | null {
    const mapping = this.worldIdMappings.get(uniqueId);
    return mapping?.originalId || null;
  }

  destroy(): void {
    // Close all watchers
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];

    // Clear all debounce timers
    Object.values(this.debounceTimers).forEach(timer => clearTimeout(timer));
    this.debounceTimers = {};

    // Clear mappings
    this.worldIdMappings.clear();

    console.log('SaveFileWatcher destroyed');
  }
}

export default SaveFileWatcher;
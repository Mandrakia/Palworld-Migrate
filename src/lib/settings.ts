import * as fs from 'fs';
import * as path from 'path';

export interface Settings {
  savePath: string[];
  metaPath: string;
  server: {
    host: string;
    port: number;
    dev: boolean;
    'allowed-domains'?: string[];
  };
  saveEdit: {
    outputDir: string;
    verbose: boolean;
  };
}

class SettingsLoader {
  private settings: Settings | null = null;
  private rootDir: string;

  constructor(rootDir?: string) {
    this.rootDir = rootDir || this.findProjectRoot();
  }

  private findProjectRoot(): string {
    let currentDir = process.cwd();
    
    while (currentDir !== path.dirname(currentDir)) {
      const settingsPath = path.join(currentDir, 'settings.json');
      if (fs.existsSync(settingsPath)) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    
    return process.cwd();
  }

  private deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  private loadSettingsFile(filePath: string): Partial<Settings> | null {
    try {
      if (!fs.existsSync(filePath)) {
        return null;
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.warn(`Warning: Failed to parse settings file ${filePath}:`, error);
      return null;
    }
  }

  load(): Settings {
    if (this.settings) {
      return this.settings;
    }

    const settingsPath = path.join(this.rootDir, 'settings.json');
    const localSettingsPath = path.join(this.rootDir, 'settings.local.json');

    const baseSettings = this.loadSettingsFile(settingsPath);
    const localSettings = this.loadSettingsFile(localSettingsPath);

    if (!baseSettings) {
      throw new Error(`Settings file not found at ${settingsPath}`);
    }

    this.settings = localSettings 
      ? this.deepMerge(baseSettings, localSettings) as Settings
      : baseSettings as Settings;

    return this.settings;
  }

  get(key?: keyof Settings): Settings | Settings[keyof Settings] {
    const settings = this.load();
    return key ? settings[key] : settings;
  }

  reload(): Settings {
    this.settings = null;
    return this.load();
  }
}

const settingsLoader = new SettingsLoader();

export const getSettings = () => settingsLoader.get() as Settings;
export const getSetting = <K extends keyof Settings>(key: K) => settingsLoader.get(key) as Settings[K];
export const reloadSettings = () => settingsLoader.reload();

export default settingsLoader;
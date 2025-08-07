import { env } from '$env/dynamic/private';
import { getSetting } from './settings';
import type { ServerSettings } from './interfaces'


class Environment {
    private static instance: Environment;
    
    private constructor() {}
    
    static getInstance(): Environment {
        if (!Environment.instance) {
            Environment.instance = new Environment();
        }
        return Environment.instance;
    }
    
    get worldSettings(): ServerSettings[] {
        // Try settings first, then fall back to environment variable for backward compatibility
        try {
            const settingsPaths = getSetting('worlds');
            if (settingsPaths && Array.isArray(settingsPaths)) {
                return settingsPaths;
            }
        } catch (error) {
            console.warn('Failed to load settings, falling back to environment variables:', error);
        }
        
        const path = env.SAVE_PATH;
        if (!path) {
            throw new Error('savePath not found in settings.json and SAVE_PATH environment variable is not set');
        }
        return [{
          directory : path
        }]; // Convert single path to array for backward compatibility
    }
    
    get serverConfig() {
        try {
            return getSetting('server');
        } catch (error) {
            console.warn('Failed to load server settings:', error);
            return {
                host: 'localhost',
                port: 5173,
                dev: true
            };
        }
    }
}

export const environment = Environment.getInstance();
export { Environment };
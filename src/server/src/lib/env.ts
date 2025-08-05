import { env } from '$env/dynamic/private';
import { getSetting } from './settings';

class Environment {
    private static instance: Environment;
    
    private constructor() {}
    
    static getInstance(): Environment {
        if (!Environment.instance) {
            Environment.instance = new Environment();
        }
        return Environment.instance;
    }
    
    get savePaths(): string[] {
        // Try settings first, then fall back to environment variable for backward compatibility
        try {
            const settingsPaths = getSetting('savePath');
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
        return [path]; // Convert single path to array for backward compatibility
    }

    // Backward compatibility
    get savePath(): string {
        const paths = this.savePaths;
        return paths[0]; // Return first path for backward compatibility
    }

    // Helper methods for multi-path handling
    getPathIndex(savePath: string): number {
        const paths = this.savePaths;
        return paths.indexOf(savePath);
    }

    getPathByIndex(index: number): string | null {
        const paths = this.savePaths;
        return paths[index] || null;
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
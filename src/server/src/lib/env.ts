import { env } from '$env/dynamic/private';

class Environment {
    private static instance: Environment;
    
    private constructor() {}
    
    static getInstance(): Environment {
        if (!Environment.instance) {
            Environment.instance = new Environment();
        }
        return Environment.instance;
    }
    
    get savePath(): string {
        const path = env.SAVE_PATH;
        if (!path) {
            throw new Error('SAVE_PATH environment variable is not set');
        }
        return path;
    }
}

export const environment = Environment.getInstance();
export { Environment };
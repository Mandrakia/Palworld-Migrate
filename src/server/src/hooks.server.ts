import SaveFileWatcher from '$lib/SaveFileWatcher';

let watcher: SaveFileWatcher | null = null;

// Initialize the save file watcher when the server starts
export async function handle({ event, resolve }) {
    // Initialize watcher on first request if not already done
    if (!watcher) {
        try {
            watcher = SaveFileWatcher.getInstance();
            await watcher.initialize();
            console.log('Save file watcher initialized successfully');
        } catch (error) {
            console.error('Failed to initialize save file watcher:', error);
            // Continue without watcher - graceful degradation
        }
    }

    // Add watcher to locals for use in API routes
    event.locals.saveWatcher = watcher;

    return resolve(event);
}

// Cleanup when server shuts down
process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    if (watcher) {
        watcher.destroy();
        watcher = null;
    }
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    if (watcher) {
        watcher.destroy();
        watcher = null;
    }
    process.exit(0);
});
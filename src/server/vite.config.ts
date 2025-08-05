import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { getSetting } from './src/lib/settings';

// Load server settings
const serverSettings = getSetting('server');
const allowedDomains = serverSettings['allowed-domains'] || [];

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	server: {
		host: serverSettings.host || 'localhost',
		port: serverSettings.port || 5173,
		allowedHosts: allowedDomains.length > 0 ? allowedDomains : undefined,
		cors: {
			origin: allowedDomains.length > 0 ? allowedDomains : true,
			credentials: true
		}
	}
});

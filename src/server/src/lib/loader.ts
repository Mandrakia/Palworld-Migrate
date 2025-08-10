import {environment} from "$lib/env";
import {stat} from "fs/promises";
import {join, dirname} from "path";
import type {ServerSave} from "$save-edit/models/ServerSave";
import type {CharacterSave} from "$save-edit/models/CharacterSave";
import {spawn} from "child_process";
import SaveFileWatcher from "./SaveFileWatcher";

// FastAPI converter settings
const CONVERT_HOST = process.env.CONVERT_HOST ?? "127.0.0.1";
const CONVERT_PORT = Number(process.env.CONVERT_PORT ?? 8009);
const CONVERT_BASE_URL = `http://${CONVERT_HOST}:${CONVERT_PORT}`;
const CONVERT_AUTOSTART = (process.env.CONVERT_AUTOSTART ?? "true") === "true";
const CONVERT_PY_PATH = join(process.cwd(), "..", "save-tools", "convert.py");

async function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

async function isConvertHealthy(timeoutMs = 1000): Promise<boolean> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(`${CONVERT_BASE_URL}/health`, { signal: controller.signal });
        return res.ok;
    } catch {
        return false;
    } finally {
        clearTimeout(id);
    }
}

async function ensureConvertService(): Promise<void> {
    if (await isConvertHealthy()) return;
    if (!CONVERT_AUTOSTART) return;

    // Start FastAPI server if not running
    try {
        const child = spawn("python3", [
            CONVERT_PY_PATH,
            "--serve",
            "--host", CONVERT_HOST,
            "--port", String(CONVERT_PORT),
            "--workers", "1",
        ], {
            detached: true,
            stdio: "ignore",
        });
        child.unref();
    } catch (err) {
        console.error("Failed to spawn convert API:", err);
        return; // Don't block startup
    }

    // Wait until healthy (non-blocking for HTTP routes since this runs only when loader is invoked by watcher)
    for (let i = 0; i < 20; i++) {
        if (await isConvertHealthy()) return;
        await sleep(250);
    }
}

async function callConvert(filename: string, mode?: "server" | "player"): Promise<any> {
    await ensureConvertService();

    const body: Record<string, any> = {
        filename,
        convert_nan_to_null: true,
    };
    // Always request minimal DTOs from Python for performance and simplicity
    if (mode) {
        body.mode = mode;
    }

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 60_000);
    try {
        const res = await fetch(`${CONVERT_BASE_URL}/to-json`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        if (!res.ok) {
            const txt = await res.text().catch(() => "");
            throw new Error(`convert API ${res.status} ${res.statusText}: ${txt}`);
        }
        return await res.json();
    } finally {
        clearTimeout(id);
    }
}

function resolveServerPaths(uniqueId: string): { savePath: string; originalId: string } | null {
    // Try to get mapping from SaveFileWatcher if available
    try {
        const watcher = SaveFileWatcher.getInstance();
        const mapping = watcher.getWorldMapping(uniqueId);
        if (mapping) {
            return { savePath: mapping.settings.directory, originalId: mapping.originalId };
        }
    } catch (error) {
        console.warn('SaveFileWatcher not available, using fallback logic');
    }

    // Fallback: check if uniqueId contains path index suffix (_0, _1, etc.)
    const match = uniqueId.match(/^(.+)_(\d+)$/);
    if (match) {
        const [, originalId, pathIndexStr] = match;
        const pathIndex = parseInt(pathIndexStr);
        const savePaths = environment.worldSettings;
        const savePath = savePaths[pathIndex];
        if (savePath) {
            return { savePath: savePath.directory, originalId };
        }
    }

    // Fallback: assume it's an original ID and use first save path
    const savePaths = environment.worldSettings;
    if (savePaths.length > 0) {
        return { savePath: savePaths[0].directory, originalId: uniqueId };
    }

    return null;
}

async function convertSaveFileRaw(uniqueId: string, inputFileName: string, mode?: "server" | "player"): Promise<any> {
    const paths = resolveServerPaths(uniqueId);
    if (!paths) {
        throw new Error(`Unable to resolve server paths for ID: ${uniqueId}`);
    }
    const { savePath, originalId } = paths;
    const inputPath = join(savePath, originalId, inputFileName);
    return await callConvert(inputPath, mode);
}

export async function loadServerFile(uniqueId: string): Promise<ServerSave> {
    const servData = await convertSaveFileRaw(uniqueId, 'Level.sav', 'server');
    // Return plain DTO cast to expected type for structural compatibility
    return servData as unknown as ServerSave;
}

export async function convertPlayerFile(uniqueId: string, guid: string): Promise<CharacterSave> {
    const inputFileName = join('Players', `${guid}.sav`);
    const playerData = await convertSaveFileRaw(uniqueId, inputFileName, 'player');
    // Return plain DTO cast to expected type for structural compatibility
    return playerData as unknown as CharacterSave;
}
import {environment} from "$lib/env";
import {access, mkdir, readdir, readFile, stat, writeFile} from "fs/promises";
import {join, dirname} from "path";
import {ServerSave} from "$save-edit/models/ServerSave";
import {CharacterSave} from "$save-edit/models/CharacterSave";
import {homedir} from "os";
import {spawn} from "child_process";
import SaveFileWatcher from "./SaveFileWatcher";

async function ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
        await mkdir(dirPath, { recursive: true });
    } catch (error) {
        // Directory might already exist, ignore error
    }
}

async function isCacheValid(uniqueId: string, inputPath: string, outputPath: string): Promise<boolean> {
    const cacheDir = dirname(outputPath);
    const timestampPath = join(cacheDir, `${dirname(outputPath).split('/').pop()}_${inputPath.split('/').pop()}_timestamp`);

    try {
        await access(outputPath);
        await access(timestampPath);

        const inputStats = await stat(inputPath);
        const cachedTimestamp = await readFile(timestampPath, 'utf-8');

        return inputStats.mtime.getTime().toString() === cachedTimestamp.trim();
    } catch {
        return false;
    }
}

async function saveTimestamp(inputPath: string, outputPath: string): Promise<void> {
    const cacheDir = dirname(outputPath);
    const timestampPath = join(cacheDir, `${dirname(outputPath).split('/').pop()}_${inputPath.split('/').pop()}_timestamp`);

    const inputStats = await stat(inputPath);
    await writeFile(timestampPath, inputStats.mtime.getTime().toString());
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

async function convertSaveFile(uniqueId: string, inputFileName: string, outputFileName: string): Promise<string> {
    const paths = resolveServerPaths(uniqueId);
    if (!paths) {
        throw new Error(`Unable to resolve server paths for ID: ${uniqueId}`);
    }

    const { savePath, originalId } = paths;
    const cacheDir = join(homedir(), '.cache', 'palworld-edit', uniqueId);
    const inputPath = join(savePath, originalId, inputFileName);
    const outputPath = join(cacheDir, outputFileName);
    const convertScript = join(process.cwd(), '..', 'save-tools', 'convert.py');

    await ensureDirectoryExists(cacheDir);

    if (await isCacheValid(uniqueId, inputPath, outputPath)) {
        console.log(`Using cached conversion for ${uniqueId}/${inputFileName}`);
        return outputPath;
    }

    console.log(`Converting save file: ${uniqueId}/${inputFileName}`);
    await new Promise<void>((resolve, reject) => {
        const process = spawn('python3', [
            convertScript,
            '--to-json',
            '--minify-json',
            '--output', outputPath,
            '--force',
            inputPath
        ]);

        process.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Convert script failed with code ${code} for ${inputFileName}`));
            }
        });

        process.on('error', (error) => {
            reject(error);
        });
    });

    await saveTimestamp(inputPath, outputPath);
    return outputPath;
}

export async function loadServerFile(uniqueId: string): Promise<ServerSave> {
    const outputPath = await convertSaveFile(uniqueId, 'Level.sav', 'Level.sav.json');
    const servDataText = await readFile(outputPath, 'utf-8');
    const servData = JSON.parse(servDataText);
    return new ServerSave(servData);
}

export async function convertPlayerFile(uniqueId: string, guid: string): Promise<CharacterSave> {
    const inputFileName = join('Players', `${guid}.sav`);
    const outputFileName = `player_${guid}.json`;
    
    const outputPath = await convertSaveFile(uniqueId, inputFileName, outputFileName);
    const playerDataText = await readFile(outputPath, 'utf-8');
    const playerData = JSON.parse(playerDataText);
    return new CharacterSave(playerData);
}
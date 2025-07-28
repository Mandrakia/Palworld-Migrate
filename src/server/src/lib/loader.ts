import {environment} from "$lib/env";
import {access, mkdir, readdir, readFile, stat, writeFile} from "fs/promises";
import {join, dirname} from "path";
import {ServerSave} from "$save-edit/models/ServerSave";
import {CharacterSave} from "$save-edit/models/CharacterSave";
import {homedir} from "os";
import {spawn} from "child_process";

async function ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
        await mkdir(dirPath, { recursive: true });
    } catch (error) {
        // Directory might already exist, ignore error
    }
}

async function isCacheValid(serverId: string, inputPath: string, outputPath: string): Promise<boolean> {
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

async function convertSaveFile(serverId: string, inputFileName: string, outputFileName: string): Promise<string> {
    const savePath = environment.savePath;
    const cacheDir = join(homedir(), '.cache', 'palworld-edit', serverId);
    const inputPath = join(savePath, serverId, inputFileName);
    const outputPath = join(cacheDir, outputFileName);
    const convertScript = join(process.cwd(), '..', 'save-tools', 'convert.py');

    await ensureDirectoryExists(cacheDir);

    if (await isCacheValid(serverId, inputPath, outputPath)) {
        console.log(`Using cached conversion for ${serverId}/${inputFileName}`);
        return outputPath;
    }

    console.log(`Converting save file: ${serverId}/${inputFileName}`);
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

export async function loadServerFile(serverId: string): Promise<ServerSave> {
    const outputPath = await convertSaveFile(serverId, 'Level.sav', 'Level.sav.json');
    const servDataText = await readFile(outputPath, 'utf-8');
    const servData = JSON.parse(servDataText);
    return new ServerSave(servData);
}

export async function convertPlayerFile(serverId: string, guid: string): Promise<CharacterSave> {
    const inputFileName = join('Players', `${guid}.sav`);
    const outputFileName = `player_${guid}.json`;
    
    const outputPath = await convertSaveFile(serverId, inputFileName, outputFileName);
    const playerDataText = await readFile(outputPath, 'utf-8');
    const playerData = JSON.parse(playerDataText);
    return new CharacterSave(playerData);
}
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function migrateEnvToSettings() {
  const envPath = path.join(__dirname, 'src/server/.env.local');
  const settingsLocalPath = path.join(__dirname, 'settings.local.json');
  
  if (!fs.existsSync(envPath)) {
    console.log('No .env.local file found, nothing to migrate.');
    return;
  }
  
  if (fs.existsSync(settingsLocalPath)) {
    console.log('settings.local.json already exists, skipping migration.');
    return;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const settings = {};
  
  envContent.split('\n').forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const [key, value] = line.split('=');
      if (key && value) {
        switch (key.trim()) {
          case 'SAVE_PATH':
            settings.savePath = [value.trim()]; // Convert to array format
            break;
          case 'META':
            settings.metaPath = value.trim();
            break;
          case 'PORT':
            settings.server = settings.server || {};
            settings.server.port = parseInt(value.trim());
            break;
          case 'HOST':
            settings.server = settings.server || {};
            settings.server.host = value.trim();
            break;
        }
      }
    }
  });
  
  if (Object.keys(settings).length > 0) {
    fs.writeFileSync(settingsLocalPath, JSON.stringify(settings, null, 2));
    console.log('✅ Migrated environment variables to settings.local.json');
    console.log('📝 You can now remove your .env.local file');
  } else {
    console.log('No recognized environment variables found to migrate.');
  }
}

migrateEnvToSettings();
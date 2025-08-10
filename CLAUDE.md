# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Palworld toolkit, for reading a dedicated server state and displaying information about the different entities in a SvelteKit frontend.

## Development Commands

### Generate mappings (Classes to json formatted .sav files)
- `npm run meta`

### Web Server
- **Run dev mode with watch** : `npm run test-server`

## Architecture

### Sav file reading (src/save-edit)
- **SaveFileWatcher and loader**: Monitors changes in save directories provided by the settings and handles the convertion from .sav to .json and the loading
- **JsonWrapper**: Base class providing safe path navigation and manipulation of nested JSON structures. Includes utility methods for converting between .NET ticks and JavaScript Dates.
- **Generated Models**: Type-safe classes auto-generated from schema definitions that extend JsonWrapper:
  - `CharacterSave`: Main character data wrapper
  - `Player`, `Pal`: Character type implementations  
  - `ServerSave`: Top-level save file wrapper
  - `ItemContainer`, `Slot`: Inventory management

#### Code Generation System

The project uses a schema-driven approach located in `src/save-edit/generation/`:
- **character_meta.ts**: Class mappings for .sav files (both player files and server files)
- **schema.ts**: Defines interfaces for entity metadata, property definitions, and polymorphic type resolution
- **Generator.ts**: Reads schema files and generates TypeScript model classes with:
  - Getter/setter properties with proper typing
  - Polymorphic factory classes for runtime type resolution
  - Automatic dependency resolution and imports

#### Key Patterns

- **Path-based data access**: All data manipulation uses string array paths to navigate the JSON structure safely
- **Polymorphic types**: Uses discriminator fields and factory classes to handle different character types (Player vs Pal)
- **Immutable base data**: JsonWrapper preserves the original JSON structure while providing typed access

### SvelteKit frontend (src/server)

The web app is composed of a server/backend (SaveFileWatcher, Cache, API) and a frontend that loads those data by either SSR (+page.ts) or fetch calls.

#### Monitor save directories

- **src/lib/SaveFileWatcher.ts**: Monitors changes in save directories provided by the settings
- **src/lib/loader.ts**: Handle the convertion from .sav to .json and the loading

## File Structure

- `src/save-edit/`: Save file editing functionality
  - `models/`: Generated TypeScript classes for save file manipulation
  - `generation/`: Schema definitions and code generator
  - `Level.sav.json`: Sample save file data
  - `test.ts`: Development testing script
- `src/server/`: SvelteKit web application

## Important code rules

- Do not duplicate code. If any piece of code you write might be later used elsewhere then write it in a separate exported function/class/interface/svelte component.
- Try to Type everything (we use typescript so as much as possible everything should be typed, arguments, return types, lambda, variables etc)



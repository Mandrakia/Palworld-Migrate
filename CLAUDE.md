# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Palworld save file edition tool that allows modifying characters, pals, items, worlds as well as transferring characters between servers. The project uses TypeScript with a code generation system to create type-safe wrappers around Palworld's JSON save data structure.

## Development Commands

### Save Editor (src/save-edit)
- **Run TypeScript code**: `npx tsx src/save-edit/<file.ts>` (using tsx for direct TypeScript execution)
- **Compile TypeScript**: `cd src/save-edit && npx tsc` (outputs to `dist/` directory)
- **Code generation**: `npx tsx src/save-edit/generation/Generator.ts <meta-file-path>` (generates model classes from schema definitions)

### Web Server (src/server)
- **Development server**: `cd src/server && npm run dev`
- **Build**: `cd src/server && npm run build`
- **Preview**: `cd src/server && npm run preview`

## Architecture

### Core Components

- **JsonWrapper**: Base class providing safe path navigation and manipulation of nested JSON structures. Includes utility methods for converting between .NET ticks and JavaScript Dates.

- **Generated Models**: Type-safe classes auto-generated from schema definitions that extend JsonWrapper:
  - `CharacterSave`: Main character data wrapper
  - `Player`, `Pal`: Character type implementations  
  - `ServerSave`: Top-level save file wrapper
  - `ItemContainer`, `Slot`: Inventory management

### Code Generation System

The project uses a schema-driven approach located in `generation/`:

- **schema.ts**: Defines interfaces for entity metadata, property definitions, and polymorphic type resolution
- **Generator.ts**: Reads schema files and generates TypeScript model classes with:
  - Getter/setter properties with proper typing
  - Polymorphic factory classes for runtime type resolution
  - Automatic dependency resolution and imports

### Key Patterns

- **Path-based data access**: All data manipulation uses string array paths to navigate the JSON structure safely
- **Polymorphic types**: Uses discriminator fields and factory classes to handle different character types (Player vs Pal)
- **Immutable base data**: JsonWrapper preserves the original JSON structure while providing typed access

## File Structure

- `src/save-edit/`: Save file editing functionality
  - `models/`: Generated TypeScript classes for save file manipulation
  - `generation/`: Schema definitions and code generator
  - `Level.sav.json`: Sample save file data
  - `test.ts`: Development testing script
- `src/server/`: SvelteKit web application

## Objective

- Move the current code base in a sub folder : src/save-edit
- create a web server project (svelte) in src/server
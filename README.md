# @astermoe/dndbeyond-parser

Universal, zero-runtime-dependency TypeScript library for extracting and parsing D&D Beyond player characters, monsters/NPCs, and magic items into normalized, strongly-typed data structures, with built-in formatters to export them into clean Markdown with YAML frontmatter.

Designed to run seamlessly in both modern browser contexts (Chrome Extensions, WebExtensions) and Node.js environments (18+).

---

## What It Is & Why It Exists

If you manage tabletop campaigns across multiple tools—like D&D Beyond, Foundry VTT, Obsidian, NotebookLM, or Archivist.AI—getting consistent, structured data out of D&D Beyond can be frustrating.

This library solves that by providing:
1. **Normalized Data Models (`CharacterData`, `MonsterData`, `ItemData`)**: Resolves complex D&D Beyond character rules (ability modifiers, proficiencies, armor class formulas, multiclassing, feats, species traits, equipped inventory, and multi-source spell lists) and monster stat blocks into clean, typed TypeScript interfaces.
2. **Unified Markdown Output**: Matches the Markdown and YAML frontmatter schema established by the [foundry-markdown-sheets](https://github.com/nickmoline/foundry-markdown-sheets) Foundry VTT exporter module. Whether you export an actor sheet from Foundry VTT or a character from D&D Beyond, the resulting Markdown files share the exact same consistent structure and YAML frontmatter for your Obsidian vaults, NotebookLM, or Archivist.AI campaigns.
3. **Shared Core for Extensions**: Serves as the single parsing and formatting engine shared between the [dndbeyond-markdown-sheets](https://github.com/astermoline/dndbeyond-markdown-sheets) export extension and the [dndbeyond-archivist-sync](https://github.com/astermoline/dndbeyond-archivist-sync) extension.

---

## Features

- **Player Characters (`CharacterData`)**:
  - Full attribute and modifier resolution (base, bonus, override, ability score improvements).
  - Accurate saving throws and skills with proficiency, half-proficiency, and expertise.
  - Armor Class calculation factoring light/medium/heavy armor Dex caps, shields, unarmored defense, and magic bonuses.
  - Senses (Darkvision, Passive Perception/Insight/Investigation), speeds (walk, fly, hover, swim, climb, burrow), and languages.
  - Complete spell resolution across all sources: class spell lists, subclass/domain spells (`spells.class`), magic items (`spells.item`), feats (`spells.feat`), and species traits (`spells.race`), including prepared statuses and spell slot tracking.
  - Equipped inventory categorization with item counts, weights, and attunement status.
  - Biographies, appearances, personality traits, ideals, bonds, flaws, and notes.

- **Monsters & NPCs (`MonsterData`)**:
  - Direct integration with D&D Beyond's Monster JSON API (`https://monster-service.dndbeyond.com/v1/Monster/{id}`) for high-fidelity data.
  - Comprehensive fallback DOM scraper supporting both **Classic (2014)** and **Modern (2024)** stat block layouts.
  - Challenge rating, XP, hit point formulas, armor class formulas, senses, languages, damage resistances, immunities, and vulnerabilities.
  - Full traits, actions, bonus actions, reactions, legendary actions, and lair actions.

- **Magic Items & Equipment (`ItemData`)**:
  - Parsing from item detail pages, tooltip JSON endpoints (`/tooltip-json`), and embedded character inventory items.
  - Rarity, item types, attunement requirements, weights, costs, tags, notes, and sources.

- **Markdown Exporter (`foundry-markdown-sheets` & Obsidian format)**:
  - Generates Markdown files with structured YAML frontmatter matching the schema defined by the [`foundry-markdown-sheets`](https://github.com/nickmoline/foundry-markdown-sheets) Foundry VTT export module.
  - Tailored for seamless use in Obsidian, NotebookLM, and Archivist.AI.

---

## Installation

```bash
npm install @astermoe/dndbeyond-parser
```

---

## Quick Start

### 1. Parsing a Character Sheet

```ts
import { fetchCharacterById, parseCharacterJson, characterToMarkdown } from '@astermoe/dndbeyond-parser';

// Fetch directly by Character ID (e.g. from URL "https://www.dndbeyond.com/characters/131447412")
const character = await fetchCharacterById(131447412);

console.log(`${character.name} - Level ${character.totalLevel} ${character.species} ${character.classLine}`);
console.log(`HP: ${character.hp.value}/${character.hp.max} | AC: ${character.ac.value}`);

// Convert to Markdown matching the foundry-markdown-sheets format
const markdown = characterToMarkdown(character);
console.log(markdown);
```

### 2. Parsing a Monster Stat Block

```ts
import { fetchMonsterById, monsterToMarkdown } from '@astermoe/dndbeyond-parser';

// Fetch monster by ID (extracted from "https://www.dndbeyond.com/monsters/16907-goblin")
const goblin = await fetchMonsterById(16907);

console.log(`${goblin.name} (CR ${goblin.cr}, ${goblin.xp} XP)`);
console.log(`HP: ${goblin.hp.value} (${goblin.hp.formula}) | AC: ${goblin.ac.value}`);

// Convert to Markdown
const markdown = monsterToMarkdown(goblin);
```

### 3. Parsing an Item

```ts
import { fetchItemTooltipJson, itemToMarkdown } from '@astermoe/dndbeyond-parser';

// Fetch item by ID (from "https://www.dndbeyond.com/magic-items/4607-cloak-of-protection")
const cloak = await fetchItemTooltipJson(4607);

console.log(`${cloak.name} - ${cloak.type}, ${cloak.rarity} (Attunement: ${cloak.requiresAttunement})`);

const markdown = itemToMarkdown(cloak);
```

---

## Architecture & Data Models

### Normalized Models

- **`CharacterData`**: Complete representation of a player character.
- **`MonsterData`**: Complete representation of an NPC or monster.
- **`ItemData`**: Complete representation of equipment or magic items.

See `src/types/index.ts` for full TypeScript definitions.

---

## Acknowledgments & Inspiration

While this is an independent clean-room implementation, it was deeply inspired by and owes gratitude to several pioneering projects in the D&D Beyond and tabletop community:

- **[foundry-markdown-sheets](https://github.com/nickmoline/foundry-markdown-sheets)**: The Foundry VTT module that exports Foundry character and NPC sheets to Markdown. This library's Markdown formatting and YAML frontmatter schema were designed to match its output, providing a consistent Markdown schema across both platforms.
- **[dndbeyond-mcp](https://github.com/grahamethompson/dndbeyond-mcp)** by [Grahame Thompson](https://github.com/grahamethompson): An MCP (Model Context Protocol) server for D&D Beyond that provided invaluable reference for D&D Beyond's internal endpoints, particularly the monster service API (`https://monster-service.dndbeyond.com/v1/Monster/{id}`) and character query parameters (`includeCustomItems=true`).
- **[Beyond20](https://github.com/kakaroto/Beyond20)** by [KaKaRoTo](https://github.com/kakaroto): The gold standard browser extension for integrating D&D Beyond with VTTs like Roll20 and Foundry VTT. Beyond20 provided fantastic inspiration for navigating D&D Beyond's dynamic DOM structures and character sheet layouts.
- **[ddb-importer](https://github.com/MrPrimate/ddb-importer)** and **[ddb-importer-chrome](https://github.com/mrprimate/ddb-importer-chrome)** by [MrPrimate](https://github.com/MrPrimate): Landmark open-source tools for importing D&D Beyond content into Foundry VTT, establishing the patterns for working with Cobalt session cookies to authenticate against D&D Beyond endpoints.

---

## License

MIT © [Aster Moline](https://aster.quest) ([@astermoline](https://github.com/astermoline))

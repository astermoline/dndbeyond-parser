# @astermoe/dndbeyond-parser

Universal, zero-runtime-dependency TypeScript library for extracting and parsing D&D Beyond player characters, monsters/NPCs, and magic items into normalized, strongly-typed data structures. It also includes built-in formatters to export these entities into Markdown with YAML frontmatter—specifically tailored for the [`foundry-markdown-sheets`](https://github.com/nickmoline/foundry-markdown-sheets) Foundry VTT module and note-taking tools like Obsidian.

Designed to run seamlessly in both modern browser contexts (Chrome Extensions, WebExtensions) and Node.js environments (18+).

---

## Why This Exists

D&D Beyond is one of the most widely used platforms for managing D&D 5e characters, monsters, and items, but extracting its data in a clean, reusable format can be challenging:
1. **Normalized Data Models**: Provides structured TypeScript interfaces (`CharacterData`, `MonsterData`, `ItemData`) that resolve character stats, modifiers, equipped items, AC formulas, spell lists across multiple sources (class, subclass, feats, species, items), and monster actions into predictable objects.
2. **Markdown with YAML Frontmatter**: Foundry VTT does not natively support Markdown for character sheets or journal entries. The [`foundry-markdown-sheets`](https://github.com/nickmoline/foundry-markdown-sheets) module was built to enable Markdown-powered sheets inside Foundry. This library generates Markdown files with YAML frontmatter formatted specifically to be consumed by that module, as well as personal knowledge management tools like Obsidian.
3. **Cross-Platform Reusability**: Designed so that multiple tools—such as the `dndbeyond-markdown-sheets` Chrome extension and the `dndbeyond-archivist-sync` extension—can share the exact same battle-tested parsing and extraction logic.

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

- **Markdown Exporter (`foundry-markdown-sheets` & Obsidian)**:
  - Generates Markdown files with structured YAML frontmatter matching the schema defined by the [`foundry-markdown-sheets`](https://github.com/nickmoline/foundry-markdown-sheets) Foundry VTT module.
  - Cleanly renders in Obsidian and other markdown-based campaign managers.

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

// Convert to Markdown formatted for foundry-markdown-sheets / Obsidian
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

// Convert to Markdown formatted for foundry-markdown-sheets / Obsidian
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

While this is an independent clean-room implementation, it was deeply inspired by and owes gratitude to several pioneering projects in the D&D Beyond and virtual tabletop (VTT) community:

- **[foundry-markdown-sheets](https://github.com/nickmoline/foundry-markdown-sheets)**: The Foundry VTT module that enables Foundry to read and render Markdown sheets with YAML frontmatter. This library's Markdown formatting and frontmatter structure were created specifically to output files ready for use with this module.
- **[dndbeyond-mcp](https://github.com/grahamethompson/dndbeyond-mcp)** by [Grahame Thompson](https://github.com/grahamethompson): An MCP (Model Context Protocol) server for D&D Beyond that provided invaluable reference for D&D Beyond's internal endpoints, particularly the monster service API and character query parameters (`includeCustomItems=true`).
- **[Beyond20](https://github.com/kakaroto/Beyond20)** by [KaKaRoTo](https://github.com/kakaroto): The gold standard browser extension for integrating D&D Beyond with VTTs like Roll20 and Foundry VTT. Beyond20 provided fantastic inspiration for navigating D&D Beyond's dynamic DOM structures and character sheet layouts.
- **[ddb-importer](https://github.com/MrPrimate/ddb-importer)** and **[ddb-importer-chrome](https://github.com/mrprimate/ddb-importer-chrome)** by [MrPrimate](https://github.com/MrPrimate): Landmark open-source tools for importing D&D Beyond content into Foundry VTT, establishing the patterns for working with Cobalt session cookies to authenticate against D&D Beyond endpoints.

---

## License

MIT © [astermoe](https://github.com/astermoe)

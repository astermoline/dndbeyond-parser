# @astermoe/dndbeyond-parser

Universal, zero-runtime-dependency TypeScript library for parsing D&D Beyond player characters, monsters/NPCs, and magic items into normalized, strongly-typed data structures and Foundry VTT / Obsidian compatible Markdown.

Designed to run seamlessly in modern browser contexts (Chrome Extensions, WebExtensions) and Node.js (18+).

---

## Features

- **Player Characters (`CharacterData`)**:
  - Full attribute and modifier resolution (base, bonus, override, ability score improvements).
  - Accurate saving throws and skills with proficiency, half-proficiency, and expertise.
  - Armor Class calculation factoring light/medium/heavy armor Dex caps, shields, and magic bonuses.
  - Senses (Darkvision, Passive Perception/Insight), speeds (walk, fly, hover, swim, climb, burrow), and languages.
  - Complete spell resolution across all sources: class spell lists, subclass/domain spells (`spells.class`), magic items (`spells.item`), feats (`spells.feat`), and species traits (`spells.race`), including prepared statuses and spell slots.
  - Equipped inventory categorization with weights and attunement status.
  - Biographies, appearances, traits, and notes.

- **Monsters & NPCs (`MonsterData`)**:
  - Direct integration with D&D Beyond's Monster JSON API (`https://monster-service.dndbeyond.com/v1/Monster/{id}`) for pristine, high-fidelity data.
  - Comprehensive fallback DOM scraper supporting both **Classic (2014)** and **Modern (2024)** stat block layouts.
  - Challenge rating, XP, hit point formulas, armor class formulas, senses, languages, and damage adjustments.
  - Full traits, actions, bonus actions, reactions, legendary actions, and lair actions.

- **Magic Items & Equipment (`ItemData`)**:
  - Parsing from item detail pages, tooltip JSON endpoints (`/tooltip-json`), and embedded character inventory items.
  - Rarity, item types, attunement requirements, weights, tags, notes, and sources.

- **Foundry VTT & Obsidian Markdown Exporter**:
  - Formats all entities into clean Markdown with rich YAML frontmatter matching the schema used by [foundry-markdown-sheets](https://github.com/nickmoline/foundry-markdown-sheets).

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

// Fetch directly by Character ID (or from URL: "https://www.dndbeyond.com/characters/131447412")
const character = await fetchCharacterById(131447412);

console.log(`${character.name} - Level ${character.totalLevel} ${character.species} ${character.classLine}`);
console.log(`HP: ${character.hp.value}/${character.hp.max} | AC: ${character.ac.value}`);

// Convert to Foundry VTT / Obsidian Markdown
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

While this is an independent, clean-room implementation, it was deeply inspired by and owes gratitude to several pioneering projects in the D&D Beyond and tabletop virtual tabletop (VTT) community:

- **[dndbeyond-mcp](https://github.com/grahamethompson/dndbeyond-mcp)** by [Grahame Thompson](https://github.com/grahamethompson): Pioneered research into D&D Beyond's internal JSON API endpoints, in particular the monster service and character service query parameters.
- **[Beyond20](https://github.com/kakaroto/Beyond20)** by [KaKaRoTo](https://github.com/kakaroto): The gold standard for browser-based D&D Beyond integration with Roll20 and Foundry VTT, providing inspiration for DOM event handling and sheet adaptability.
- **[ddb-importer](https://github.com/MrPrimate/ddb-importer)** and **[ddb-importer-chrome](https://github.com/mrprimate/ddb-importer-chrome)** by [MrPrimate](https://github.com/MrPrimate): Landmark work in bringing D&D Beyond characters and compendiums into Foundry VTT, and establishing the Cobalt session cookie authentication workflow.
- **[foundry-markdown-sheets](https://github.com/nickmoline/foundry-markdown-sheets)**: The Foundry VTT module that defines the Markdown and YAML frontmatter schema this library outputs.

---

## License

MIT © [astermoe](https://github.com/astermoe)

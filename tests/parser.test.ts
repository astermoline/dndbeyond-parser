import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  cleanDdbImageUrl,
  parseCharacterJson,
  parseMonsterJson,
  parseItemTooltipJson,
  parseItemDom,
  characterToMarkdown,
  monsterToMarkdown,
  itemToMarkdown,
  parseSpellTooltipJson,
  parseSpellDom,
  spellToMarkdown,
  parseSourceDom,
  sourceToMarkdown,
  extractSpellId,
} from '../src';

const fixturesDir = path.resolve(__dirname, 'fixtures');

describe('Character Parser', () => {
  const rizJson = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'character-riz.json'), 'utf-8'));

  it('parses character metadata and abilities correctly', () => {
    const char = parseCharacterJson(rizJson);

    expect(char.name).toBe('Riz');
    expect(char.totalLevel).toBe(20);
    expect(char.species).toBe('Changeling');
    expect(char.classLine).toBe('Bard (College of Lore) 20');
    expect(char.abilities.strength.score).toBe(21);
    expect(char.abilities.strength.modifier).toBe('+5');
    expect(char.abilities.charisma.score).toBe(22);
    expect(char.abilities.charisma.modifier).toBe('+6');
    expect(char.proficiencyBonus).toBe(6);
  });

  it('includes spells from multiple sources (class, subclass, feats)', () => {
    const char = parseCharacterJson(rizJson);
    expect(char.spellcasting).toBeDefined();

    if (char.spellcasting) {
      // Check that spells are present across levels
      const allSpells = Object.values(char.spellcasting.groups).flat();
      expect(allSpells.length).toBeGreaterThan(25);

      // Verify a subclass/magical secret spell is captured
      const hasPowerWordHeal = allSpells.some((s) => s.name === 'Power Word Heal');
      expect(hasPowerWordHeal).toBe(true);

      // Verify cantrips
      const cantrips = char.spellcasting.groups[0] || [];
      expect(cantrips.some((s) => s.name === 'Vicious Mockery')).toBe(true);
    }
  });

  it('generates valid markdown with YAML frontmatter', () => {
    const char = parseCharacterJson(rizJson);
    const md = characterToMarkdown(char);

    expect(md).toMatch(/^---\nname: "Riz"/);
    expect(md).toContain('type: "character"');
    expect(md).toContain('level: 20');
    expect(md).toContain('## Core Stats');
    expect(md).toContain('### Ability Scores');
    expect(md).toContain('## Features & Talents');
    expect(md).toContain('## Inventory');
    expect(md).toContain('## Spellcasting');
    expect(md).toContain('image: "https://www.dndbeyond.com/avatars/59123/23/1581111423-131447412.jpeg"');
    expect(md).not.toContain('?width=150');
  });
  it('strips resizing query string parameters from character avatar URL', () => {
    const char = parseCharacterJson(rizJson);
    expect(char.avatarUrl).toBe('https://www.dndbeyond.com/avatars/59123/23/1581111423-131447412.jpeg');
    expect(char.avatarUrl).not.toContain('?width=150');

    const sampleUrl = 'https://www.dndbeyond.com/avatars/59417/207/1581111423-170163364.jpeg?width=150&height=150&fit=crop&quality=95&auto=webp';
    expect(cleanDdbImageUrl(sampleUrl)).toBe('https://www.dndbeyond.com/avatars/59417/207/1581111423-170163364.jpeg');
  });
});

describe('Monster Parser', () => {
  const goblinJson = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'monster-goblin.json'), 'utf-8'));
  const goblinBossJson = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'monster-goblin-boss-2024.json'), 'utf-8'));

  it('parses classic monster stats and actions accurately', () => {
    const goblin = parseMonsterJson(goblinJson);

    expect(goblin.name).toBe('Goblin');
    expect(goblin.cr).toBe('1/4');
    expect(goblin.xp).toBe(50);
    expect(goblin.ac.value).toBe(15);
    expect(goblin.ac.formula).toBe('(leather armor, shield)');
    expect(goblin.hp.value).toBe(7);
    expect(goblin.hp.formula).toBe('2d6');
    expect(goblin.speed).toContain('30 ft.');
    expect(goblin.abilities.dexterity.score).toBe(14);
    expect(goblin.abilities.dexterity.modifier).toBe('+2');

    // Traits and Actions
    expect(goblin.traits.some((t) => t.name === 'Nimble Escape')).toBe(true);
    expect(goblin.actions.some((a) => a.name === 'Scimitar')).toBe(true);
    expect(goblin.actions.some((a) => a.name === 'Shortbow')).toBe(true);
  });

  it('parses 2024 monster stats and reactions accurately', () => {
    const boss = parseMonsterJson(goblinBossJson);

    expect(boss.name).toBe('Goblin Boss');
    expect(boss.cr).toBe('1');
    expect(boss.xp).toBe(200);
    expect(boss.ac.value).toBe(17);
    expect(boss.hp.value).toBe(21);
    expect(boss.hp.formula).toBe('6d6');
    expect(boss.reactions.some((r) => r.name === 'Redirect Attack')).toBe(true);
  });

  it('generates valid monster Markdown with YAML frontmatter', () => {
    const goblin = parseMonsterJson(goblinJson);
    const md = monsterToMarkdown(goblin);

    expect(md).toMatch(/^---\nname: "Goblin"/);
    expect(md).toContain('type: "npc"');
    expect(md).toContain('cr: "1/4"');
    expect(md).toContain('## Actions');
    expect(md).toContain('### Scimitar');
  });
});

describe('Item Parser', () => {
  const cloakJson = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'item-cloak.json'), 'utf-8'));

  it('parses item tooltip and byline correctly', () => {
    const item = parseItemTooltipJson(cloakJson);

    expect(item.name).toBe('Cloak of Protection');
    expect(item.type).toBe('Wondrous Item');
    expect(item.rarity).toBe('uncommon');
    expect(item.requiresAttunement).toBe(true);
    expect(item.description).toContain('+1 bonus to Armor Class and saving throws');
  });

  it('generates valid item Markdown with frontmatter', () => {
    const item = parseItemTooltipJson(cloakJson);
    const md = itemToMarkdown(item);

    expect(md).toMatch(/^---\nname: "Cloak of Protection"/);
    expect(md).toContain('type: "item"');
    expect(md).toContain('attunement: true');
    expect(md).toContain('# Cloak of Protection');
  });
  it('parses item details and extracts high-resolution lightbox image', () => {
    const mockRoot = {
      querySelector: (selector: string) => {
        if (selector.includes('page-title')) {
          return { textContent: 'Staff of the Magi' };
        }
        if (selector.includes('data-lightbox')) {
          return {
            getAttribute: (attr: string) =>
              attr === 'href'
                ? 'https://www.dndbeyond.com/avatars/thumbnails/55227/411/1000/1000/639081773424222752.png'
                : null,
          };
        }
        if (selector.includes('magic-item-image')) {
          return {
            src: 'https://www.dndbeyond.com/avatars/thumbnails/55227/411/1000/1000/639081773424222752.png',
            getAttribute: () => 'https://www.dndbeyond.com/avatars/thumbnails/55227/411/1000/1000/639081773424222752.png',
          };
        }
        if (selector.includes('details')) {
          return { textContent: 'Staff, legendary (requires attunement by a Sorcerer, Warlock, or Wizard)' };
        }
        if (selector.includes('more-info-content')) {
          return {
            innerHTML: '<p>This staff has 50 charges...</p>',
            querySelector: () => null,
          };
        }
        return null;
      },
      querySelectorAll: () => [],
    } as any;

    const item = parseItemDom(mockRoot);
    expect(item.name).toBe('Staff of the Magi');
    expect(item.type).toBe('Staff');
    expect(item.rarity).toBe('legendary');
    expect(item.requiresAttunement).toBe(true);
    expect(item.image).toBe('https://www.dndbeyond.com/avatars/thumbnails/55227/411/1000/1000/639081773424222752.png');
    expect(item.description).toContain('This staff has 50 charges');
  });
});


describe('Spell Parser', () => {
  const fireballTooltip = {
    Type: "spell",
    Id: 2618887,
    Tooltip: `<div class="tooltip tooltip-spell">
    <div class="tooltip-header">
        <div class="tooltip-header-text">
            <div class="tooltip-header-title">Fireball </div>
            <div class="tooltip-header-subtitle">Player’s Handbook</div>
        </div>
    </div>
    <div class="tooltip-body">
        <div class="tooltip-body-statblock">
            <div class="tooltip-body-statblock-item tooltip-body-statblock-item-level">
                <div class="tooltip-body-statblock-item-value">3rd</div>
            </div>
            <div class="tooltip-body-statblock-item tooltip-body-statblock-item-castingtime">
                <div class="tooltip-body-statblock-item-value">1 Action </div>
            </div>
            <div class="tooltip-body-statblock-item tooltip-body-statblock-item-range">
                <div class="tooltip-body-statblock-item-value">150 ft. (20 ft.)</div>
            </div>
            <div class="tooltip-body-statblock-item tooltip-body-statblock-item-components">
                <div class="tooltip-body-statblock-item-value">V, S, M</div>
            </div>
            <div class="tooltip-body-statblock-item tooltip-body-statblock-item-duration">
                <div class="tooltip-body-statblock-item-value">Instantaneous</div>
            </div>
            <div class="tooltip-body-statblock-item tooltip-body-statblock-item-school">
                <div class="tooltip-body-statblock-item-value">Evocation</div>
            </div>
            <div class="tooltip-body-statblock-item tooltip-body-statblock-item-save">
                <div class="tooltip-body-statblock-item-value">DEX Save</div>
            </div>
            <div class="tooltip-body-statblock-item tooltip-body-statblock-item-damage">
                <div class="tooltip-body-statblock-item-value"><span class="damage-effect-text">Fire</span></div>
            </div>
        </div>
        <div class="tooltip-body-description">
            <div class="tooltip-body-description-text">
                <p>A bright streak flashes from you to a point you choose...</p>
            </div>
        </div>
    </div>
</div>`
  };

  it('extracts spell ID from URL or numeric ID', () => {
    expect(extractSpellId("https://www.dndbeyond.com/spells/2618887-fireball")).toBe(2618887);
    expect(extractSpellId("2618887")).toBe(2618887);
    expect(extractSpellId("https://www.dndbeyond.com/spells")).toBe(null);
  });

  it('parses spell tooltip json accurately', () => {
    const spell = parseSpellTooltipJson(fireballTooltip);
    expect(spell.name).toBe("Fireball");
    expect(spell.level).toBe(3);
    expect(spell.school).toBe("Evocation");
    expect(spell.castingTime).toBe("1 Action");
    expect(spell.range).toBe("150 ft. (20 ft.)");
    expect(spell.components).toBe("V, S, M");
    expect(spell.duration).toBe("Instantaneous");
    expect(spell.attackSave).toBe("DEX Save");
    expect(spell.damageEffect).toBe("Fire");
    expect(spell.source).toBe("Player’s Handbook");
    expect(spell.description).toContain("A bright streak flashes");
  });

  it('parses spell DOM details with material components and classes', () => {
    const mockRoot = {
      querySelector: (selector: string) => {
        if (selector.includes("page-title")) return { textContent: "Fireball" };
        if (selector.includes("ddb-statblock-item-level")) return { textContent: "3rd" };
        if (selector.includes("ddb-statblock-item-casting-time")) return { textContent: "1 Action" };
        if (selector.includes("ddb-statblock-item-range-area")) return { textContent: "150 ft. (20 ft.)" };
        if (selector.includes("ddb-statblock-item-components")) return { textContent: "V, S, M *" };
        if (selector.includes("ddb-statblock-item-duration")) return { textContent: "Instantaneous" };
        if (selector.includes("ddb-statblock-item-school")) return { textContent: "Evocation" };
        if (selector.includes("ddb-statblock-item-attack-save")) return { textContent: "DEX Save" };
        if (selector.includes("ddb-statblock-item-damage-effect")) return { textContent: "Fire" };
        if (selector.includes("spell-source")) return { textContent: "Player’s Handbook, pg. 274" };
        if (selector.includes("more-info-content")) {
          return {
            innerHTML: "<p>A bright streak flashes...</p>",
            querySelector: (s: string) => s.includes("components-blurb") ? { textContent: "* - (a ball of bat guano and sulfur)" } : null,
            cloneNode: () => ({
              querySelector: () => ({ remove: () => {} }),
              innerHTML: "<p>A bright streak flashes...</p>",
            }),
          };
        }
        return null;
      },
      querySelectorAll: (selector: string) => {
        if (selector.includes("spell-tag")) return [{ textContent: "Damage" }];
        if (selector.includes("class-tag")) return [{ textContent: "Sorcerer" }, { textContent: "Wizard" }];
        return [];
      },
    } as any;

    const spell = parseSpellDom(mockRoot);
    expect(spell.name).toBe("Fireball");
    expect(spell.level).toBe(3);
    expect(spell.material).toBe("(a ball of bat guano and sulfur)");
    expect(spell.classes).toEqual(["Sorcerer", "Wizard"]);
    expect(spell.tags).toEqual(["Damage"]);
    expect(spell.source).toBe("Player’s Handbook, pg. 274");
  });

  it('generates valid spell markdown with YAML frontmatter', () => {
    const spell = parseSpellTooltipJson(fireballTooltip);
    spell.classes = ["Sorcerer", "Wizard"];
    spell.tags = ["Damage"];
    const md = spellToMarkdown(spell);

    expect(md).toMatch(/^---\nname: "Fireball"/);
    expect(md).toContain('type: "spell"');
    expect(md).toContain("level: 3");
    expect(md).toContain('school: "Evocation"');
    expect(md).toContain('- "Sorcerer"');
    expect(md).toContain("# Fireball");
    expect(md).toContain("*3rd-Level Evocation*");
    expect(md).toContain("- **Casting Time:** 1 Action");
    expect(md).toContain("- **Attack/Save:** DEX Save");
    expect(md).toContain("- **Classes:** Sorcerer, Wizard");
  });

  it('formats Cantrips appropriately in markdown', () => {
    const cantrip = {
      name: "Acid Splash",
      level: 0,
      school: "Evocation",
      castingTime: "1 Action",
      range: "60 ft. (5 ft.)",
      components: "V, S",
      duration: "Instantaneous",
      description: "You create an acidic bubble...",
      attackSave: "DEX Save",
      damageEffect: "Acid",
    };
    const md = spellToMarkdown(cantrip);
    expect(md).toContain("*Evocation Cantrip*");
    expect(md).toContain("level: 0");
  });
});


describe('Source Chapter Parser', () => {
  it('parses source chapter DOM accurately', () => {
    const mockDoc = {
      querySelector: (selector: string) => {
        if (selector.includes("page-title")) return { textContent: "Character Origins" };
        if (selector.includes("p-article-content")) {
          return {
            innerHTML: "<p>This chapter describes background and species.</p><h2>Origin Components</h2><p>Facets of your character.</p>",
            cloneNode: () => ({
              querySelectorAll: () => [],
              innerHTML: "<p>This chapter describes background and species.</p><h2>Origin Components</h2><p>Facets of your character.</p>",
            }),
          };
        }
        return null;
      },
      querySelectorAll: (selector: string) => {
        if (selector.includes("breadcrumb")) {
          return [
            { textContent: "Home" },
            { textContent: "Sources" },
            { textContent: "D&D Beyond Basic Rules" },
            { textContent: "Character Origins" },
          ];
        }
        return [];
      },
    } as any;

    const source = parseSourceDom(mockDoc, "https://www.dndbeyond.com/sources/dnd/br-2024/character-origins");
    expect(source.title).toBe("Character Origins");
    expect(source.bookTitle).toBe("D&D Beyond Basic Rules");
    expect(source.url).toBe("https://www.dndbeyond.com/sources/dnd/br-2024/character-origins");
    expect(source.content).toContain("This chapter describes background and species.");
  });

  it('generates clean markdown with YAML frontmatter for source chapters', () => {
    const chapter = {
      title: "Character Origins",
      bookTitle: "D&D Beyond Basic Rules",
      url: "https://www.dndbeyond.com/sources/dnd/br-2024/character-origins",
      content: "## Origin Components\n\nEach part of your character’s origin reflects facets of your character.",
    };

    const md = sourceToMarkdown(chapter);
    expect(md).toMatch(/^---\nname: "Character Origins"/);
    expect(md).toContain('type: "source"');
    expect(md).toContain('book: "D&D Beyond Basic Rules"');
    expect(md).toContain("# Character Origins");
    expect(md).toContain("*D&D Beyond Basic Rules*");
    expect(md).toContain("## Origin Components");
  });
});

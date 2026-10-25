import { cleanDdbImageUrl } from '../utils/image';
import { CharacterData, MonsterData, ItemData, SpellData, SourceChapterData } from '../types';

export function escapeYamlString(str?: string | number | null): string {
  if (str === undefined || str === null) return '""';
  const escaped = String(str).replace(/"/g, '\\"').replace(/\n/g, ' ');
  return `"${escaped}"`;
}

export function toYamlArray(items: Array<string | number>, indent = 2): string {
  if (!items || items.length === 0) return '[]';
  const spaces = ' '.repeat(indent);
  let yaml = '\n';
  for (const item of items) {
    yaml += `${spaces}- ${escapeYamlString(item)}\n`;
  }
  return yaml.trimEnd();
}

/**
 * Formats a CharacterData object into Markdown with YAML frontmatter
 */
export function characterToMarkdown(c: CharacterData): string {
  const cleanAvatarUrl = cleanDdbImageUrl(c.avatarUrl);
  const avatar = cleanAvatarUrl ? `![${c.name}](${cleanAvatarUrl})\n\n` : '';

  const frontmatter = `---
name: ${escapeYamlString(c.name)}
type: "character"
image: ${escapeYamlString(cleanAvatarUrl)}
species: ${escapeYamlString(c.species)}
class: ${escapeYamlString(c.classLine)}
background: ${escapeYamlString(c.background)}
alignment: ${escapeYamlString(c.alignment)}
level: ${c.totalLevel}
hp:
  value: ${c.hp.value}
  max: ${c.hp.max}
  temp: ${c.hp.temp}
ac: ${c.ac.value}
initiative: ${escapeYamlString(c.initiative)}
speed: ${escapeYamlString(c.speed)}
proficiency_bonus: ${escapeYamlString(`+${c.proficiencyBonus}`)}
senses: ${toYamlArray(c.senses, 2)}
languages: ${toYamlArray(c.languages, 2)}
abilities:
  strength:
    score: ${c.abilities.strength.score}
    modifier: ${escapeYamlString(c.abilities.strength.modifier)}
    saves: ${escapeYamlString(c.abilities.strength.save)}
    proficiency: ${escapeYamlString(c.abilities.strength.isProficient ? 'proficient' : 'none')}
  dexterity:
    score: ${c.abilities.dexterity.score}
    modifier: ${escapeYamlString(c.abilities.dexterity.modifier)}
    saves: ${escapeYamlString(c.abilities.dexterity.save)}
    proficiency: ${escapeYamlString(c.abilities.dexterity.isProficient ? 'proficient' : 'none')}
  constitution:
    score: ${c.abilities.constitution.score}
    modifier: ${escapeYamlString(c.abilities.constitution.modifier)}
    saves: ${escapeYamlString(c.abilities.constitution.save)}
    proficiency: ${escapeYamlString(c.abilities.constitution.isProficient ? 'proficient' : 'none')}
  intelligence:
    score: ${c.abilities.intelligence.score}
    modifier: ${escapeYamlString(c.abilities.intelligence.modifier)}
    saves: ${escapeYamlString(c.abilities.intelligence.save)}
    proficiency: ${escapeYamlString(c.abilities.intelligence.isProficient ? 'proficient' : 'none')}
  wisdom:
    score: ${c.abilities.wisdom.score}
    modifier: ${escapeYamlString(c.abilities.wisdom.modifier)}
    saves: ${escapeYamlString(c.abilities.wisdom.save)}
    proficiency: ${escapeYamlString(c.abilities.wisdom.isProficient ? 'proficient' : 'none')}
  charisma:
    score: ${c.abilities.charisma.score}
    modifier: ${escapeYamlString(c.abilities.charisma.modifier)}
    saves: ${escapeYamlString(c.abilities.charisma.save)}
    proficiency: ${escapeYamlString(c.abilities.charisma.isProficient ? 'proficient' : 'none')}
---`;

  const savesOutput = Object.entries(c.abilities).map(([ab, data]) => {
    const name = ab.charAt(0).toUpperCase() + ab.slice(1);
    const profLabel = data.isProficient ? ' (Proficient)' : '';
    return `- **${name}:** ${data.save}${profLabel}`;
  });

  const skillsOutput = c.skills.map((s) => {
    let profLabel = '';
    if (s.proficiency === 'expertise') profLabel = ' (Expertise)';
    else if (s.proficiency === 'proficient') profLabel = ' (Proficient)';
    else if (s.proficiency === 'half') profLabel = ' (Half Proficient)';
    return `- **${s.name}:** ${s.formatted}${profLabel} (Passive: ${s.passive})`;
  });

  let body = `
# ${c.name}
${avatar}*Level ${c.totalLevel} ${c.species} ${c.classLine} | Background: ${c.background} | Alignment: ${c.alignment}*

## Core Stats
- **Armor Class:** ${c.ac.value}
- **Hit Points:** ${c.hp.value} / ${c.hp.max}${c.hp.temp ? ` (Temp: ${c.hp.temp})` : ''}
- **Speed:** ${c.speed}
- **Initiative:** ${c.initiative}
- **Proficiency Bonus:** +${c.proficiencyBonus}
- **Senses:** ${c.senses.join(', ') || 'None'}
- **Languages:** ${c.languages.join(', ') || 'None'}

### Ability Scores
| STR | DEX | CON | INT | WIS | CHA |
| :---: | :---: | :---: | :---: | :---: | :---: |
| ${c.abilities.strength.score} (${c.abilities.strength.modifier}) | ${c.abilities.dexterity.score} (${c.abilities.dexterity.modifier}) | ${c.abilities.constitution.score} (${c.abilities.constitution.modifier}) | ${c.abilities.intelligence.score} (${c.abilities.intelligence.modifier}) | ${c.abilities.wisdom.score} (${c.abilities.wisdom.modifier}) | ${c.abilities.charisma.score} (${c.abilities.charisma.modifier}) |

### Saving Throws
${savesOutput.join('\n')}

### Skills
${skillsOutput.join('\n')}

---
`;

  // Features Section
  if (c.features.length > 0) {
    body += `\n## Features & Talents\n`;
    const sortedFeatures = [...c.features].sort((a, b) => a.name.localeCompare(b.name));
    for (const f of sortedFeatures) {
      body += `\n### ${f.name}\n- **Type:** ${f.type}${f.source ? ` (${f.source})` : ''}\n\n${f.description}\n`;
    }
    body += `\n---\n`;
  }

  // Inventory Section
  if (c.inventory.length > 0) {
    body += `\n## Inventory\n`;

    const categories: Record<string, string[]> = {
      Weapons: [],
      'Armor & Shield': [],
      'Equipment & Gear': [],
      Consumables: [],
      Tools: [],
      Containers: [],
      'Other Loot': [],
    };

    c.inventory.forEach((item) => {
      const eq = item.equipped ? ' (Equipped)' : '';
      const attune = item.requiresAttunement ? ' (Requires Attunement)' : '';
      let props = '';
      if (item.notes && item.notes.length) {
        props = ` | ${item.notes.join(' | ')}`;
      }

      const itemMd = `\n#### ${item.name}${eq}${attune}\n- **Quantity:** ${item.quantity} | **Weight:** ${item.totalWeight} lbs${props}\n\n${item.description}\n`;

      const t = (item.type || '').toLowerCase();
      if (t === 'weapon') categories.Weapons.push(itemMd);
      else if (t === 'armor' || t === 'shield') categories['Armor & Shield'].push(itemMd);
      else if (t === 'potion' || t === 'consumable') categories.Consumables.push(itemMd);
      else if (t === 'tool') categories.Tools.push(itemMd);
      else if (t === 'container') categories.Containers.push(itemMd);
      else if (t === 'loot') categories['Other Loot'].push(itemMd);
      else categories['Equipment & Gear'].push(itemMd);
    });

    Object.entries(categories).forEach(([title, items]) => {
      if (items.length > 0) {
        body += `\n### ${title}\n` + items.join('');
      }
    });

    body += `\n---\n`;
  }

  // Spellcasting Section
  if (c.spellcasting) {
    const sc = c.spellcasting;
    body += `\n## Spellcasting\n`;
    body += `**Spellcasting Ability:** ${sc.ability} (Spell Save DC: ${sc.saveDC}, Spell Attack Bonus: ${sc.attackBonus})\n`;

    Object.keys(sc.groups)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((lvl) => {
        const slot = c.spellSlots.find((s) => s.level === lvl);
        const slotInfo = slot ? ` (${slot.available - slot.used}/${slot.available} slots)` : '';
        const title = lvl === 0 ? 'Cantrips' : `Level ${lvl} Spells${slotInfo}`;

        body += `\n### ${title}\n`;
        sc.groups[lvl].forEach((s) => {
          body += `\n#### ${s.name}\n`;
          body += `- **School:** ${s.school}\n`;
          body += `- **Casting Time:** ${s.castingTime}\n`;
          body += `- **Range:** ${s.range}\n`;
          body += `- **Components:** ${s.components}\n`;
          body += `- **Duration:** ${s.duration}\n\n`;
          body += `${s.description}\n`;
        });
      });

    body += `\n---\n`;
  }

  // Bio & Appearance Section
  if (c.bio.appearance || c.bio.backstory) {
    body += `\n## Biography & Appearance\n`;
    if (c.bio.appearance) {
      body += `\n### Appearance\n${c.bio.appearance}\n`;
    }
    if (c.bio.backstory) {
      body += `\n### Biography\n${c.bio.backstory}\n`;
    }
  }

  return `${frontmatter}\n${body}`.trim() + '\n';
}

/**
 * Formats a MonsterData object into Markdown with YAML frontmatter
 */
export function monsterToMarkdown(m: MonsterData): string {
  const cleanImgUrl = cleanDdbImageUrl(m.imageUrl);
  const imgMarkdown = cleanImgUrl ? `![${m.name}](${cleanImgUrl})\n\n` : '';

  const frontmatter = `---
name: ${escapeYamlString(m.name)}
type: "npc"
image: ${escapeYamlString(cleanImgUrl)}
cr: "${m.cr}"
xp: ${m.xp}
size: ${escapeYamlString(m.size)}
type_tags: ${escapeYamlString(m.type)}
alignment: ${escapeYamlString(m.alignment)}
hp:
  value: ${m.hp.value}
  max: ${m.hp.max}
  temp: 0
  formula: ${escapeYamlString(m.hp.formula || '')}
ac: ${m.ac.value}${m.ac.formula ? ` ${m.ac.formula}` : ''}
speed: ${escapeYamlString(m.speed)}
senses: ${toYamlArray(m.senses, 2)}
languages: ${toYamlArray(m.languages, 2)}
abilities:
  strength:
    score: ${m.abilities.strength.score}
    modifier: ${escapeYamlString(m.abilities.strength.modifier)}
    saves: ${escapeYamlString(m.abilities.strength.save)}
    proficiency: ${escapeYamlString(m.abilities.strength.isProficient ? 'proficient' : 'none')}
  dexterity:
    score: ${m.abilities.dexterity.score}
    modifier: ${escapeYamlString(m.abilities.dexterity.modifier)}
    saves: ${escapeYamlString(m.abilities.dexterity.save)}
    proficiency: ${escapeYamlString(m.abilities.dexterity.isProficient ? 'proficient' : 'none')}
  constitution:
    score: ${m.abilities.constitution.score}
    modifier: ${escapeYamlString(m.abilities.constitution.modifier)}
    saves: ${escapeYamlString(m.abilities.constitution.save)}
    proficiency: ${escapeYamlString(m.abilities.constitution.isProficient ? 'proficient' : 'none')}
  intelligence:
    score: ${m.abilities.intelligence.score}
    modifier: ${escapeYamlString(m.abilities.intelligence.modifier)}
    saves: ${escapeYamlString(m.abilities.intelligence.save)}
    proficiency: ${escapeYamlString(m.abilities.intelligence.isProficient ? 'proficient' : 'none')}
  wisdom:
    score: ${m.abilities.wisdom.score}
    modifier: ${escapeYamlString(m.abilities.wisdom.modifier)}
    saves: ${escapeYamlString(m.abilities.wisdom.save)}
    proficiency: ${escapeYamlString(m.abilities.wisdom.isProficient ? 'proficient' : 'none')}
  charisma:
    score: ${m.abilities.charisma.score}
    modifier: ${escapeYamlString(m.abilities.charisma.modifier)}
    saves: ${escapeYamlString(m.abilities.charisma.save)}
    proficiency: ${escapeYamlString(m.abilities.charisma.isProficient ? 'proficient' : 'none')}
---`;

  let body = `
# ${m.name}
${imgMarkdown}*${m.size} ${m.type}, ${m.alignment}*

- **Challenge Rating:** ${m.cr} (${m.xp} XP)
- **AC:** ${m.ac.value}${m.ac.formula ? ` ${m.ac.formula}` : ''}
- **HP:** ${m.hp.value} / ${m.hp.max}${m.hp.formula ? ` (${m.hp.formula})` : ''}
- **Speed:** ${m.speed}
- **Senses:** ${m.senses.join(', ') || 'None'}
- **Languages:** ${m.languages.join(', ') || 'None'}

### Ability Scores
| STR | DEX | CON | INT | WIS | CHA |
| :---: | :---: | :---: | :---: | :---: | :---: |
| ${m.abilities.strength.score} (${m.abilities.strength.modifier}) | ${m.abilities.dexterity.score} (${m.abilities.dexterity.modifier}) | ${m.abilities.constitution.score} (${m.abilities.constitution.modifier}) | ${m.abilities.intelligence.score} (${m.abilities.intelligence.modifier}) | ${m.abilities.wisdom.score} (${m.abilities.wisdom.modifier}) | ${m.abilities.charisma.score} (${m.abilities.charisma.modifier}) |

---
`;

  const formatSection = (title: string, list: Array<{ name: string; description: string }>) => {
    if (!list || list.length === 0) return '';
    let out = `\n## ${title}\n`;
    list.forEach((item) => {
      out += `\n### ${item.name}\n${item.description}\n`;
    });
    return out + `\n---\n`;
  };

  body += formatSection('Traits & Passive Abilities', m.traits);
  body += formatSection('Actions', m.actions);
  body += formatSection('Bonus Actions', m.bonusActions);
  body += formatSection('Reactions', m.reactions);
  body += formatSection('Legendary Actions', m.legendaryActions);
  body += formatSection('Lair Actions', m.lairActions);

  if (m.description) {
    body += `\n## Biography & Description\n\n${m.description}\n`;
  }

  return `${frontmatter}\n${body}`.trim() + '\n';
}

/**
 * Formats an ItemData object into Markdown with YAML frontmatter
 */
export function itemToMarkdown(item: ItemData): string {
  const cleanImgUrl = cleanDdbImageUrl(item.image);
  const imgMarkdown = cleanImgUrl ? `![${item.name}](${cleanImgUrl})\n\n` : '';

  const frontmatter = `---
name: ${escapeYamlString(item.name)}
type: "item"
item_type: ${escapeYamlString(item.type)}
rarity: ${escapeYamlString(item.rarity || 'Common')}
attunement: ${item.requiresAttunement}
image: ${escapeYamlString(cleanImgUrl)}
source: ${escapeYamlString(item.source)}
---`;

  let subhead = `*${item.type}`;
  if (item.rarity) subhead += `, ${item.rarity}`;
  if (item.requiresAttunement) subhead += ` (${item.attunementDescription || 'requires attunement'})`;
  subhead += `*`;

  let body = `
# ${item.name}
${imgMarkdown}${subhead}

${item.description}
`;

  if (item.notes && item.notes.length) {
    body += `\n- **Notes:** ${item.notes.join(', ')}`;
  }
  if (item.tags && item.tags.length) {
    body += `\n- **Tags:** ${item.tags.join(', ')}`;
  }
  if (item.source) {
    body += `\n- **Source:** ${item.source}`;
  }

  return `${frontmatter}\n${body}`.trim() + '\n';
}

/**
 * Formats a SpellData object into Markdown with YAML frontmatter
 */
export function spellToMarkdown(spell: SpellData): string {
  const cleanImgUrl = cleanDdbImageUrl(spell.image);
  const imgMarkdown = cleanImgUrl ? `![${spell.name}](${cleanImgUrl})\n\n` : "";

  const frontmatter = `---
name: ${escapeYamlString(spell.name)}
type: "spell"
level: ${spell.level}
school: ${escapeYamlString(spell.school)}
casting_time: ${escapeYamlString(spell.castingTime)}
range: ${escapeYamlString(spell.range)}
components: ${escapeYamlString(spell.components)}
material: ${escapeYamlString(spell.material)}
duration: ${escapeYamlString(spell.duration)}
concentration: ${Boolean(spell.concentration)}
ritual: ${Boolean(spell.ritual)}
attack_save: ${escapeYamlString(spell.attackSave)}
damage_effect: ${escapeYamlString(spell.damageEffect)}
classes: ${toYamlArray(spell.classes || [], 2)}
tags: ${toYamlArray(spell.tags || [], 2)}
source: ${escapeYamlString(spell.source)}
image: ${escapeYamlString(cleanImgUrl)}
---`;

  let levelSchool = "";
  if (spell.level === 0) {
    levelSchool = `${spell.school} Cantrip`;
  } else {
    const ordinal =
      spell.level === 1 ? "1st" :
      spell.level === 2 ? "2nd" :
      spell.level === 3 ? "3rd" : `${spell.level}th`;
    levelSchool = `${ordinal}-Level ${spell.school}`;
  }
  if (spell.ritual) {
    levelSchool += " (Ritual)";
  }

  let body = `
# ${spell.name}
${imgMarkdown}*${levelSchool}*

- **Casting Time:** ${spell.castingTime}
- **Range/Area:** ${spell.range}
- **Components:** ${spell.components}${spell.material ? ` *(${spell.material})*` : ""}
- **Duration:** ${spell.duration}
- **School:** ${spell.school}
`;

  if (spell.attackSave) {
    body += `- **Attack/Save:** ${spell.attackSave}\n`;
  }
  if (spell.damageEffect) {
    body += `- **Damage/Effect:** ${spell.damageEffect}\n`;
  }

  body += `\n${spell.description}\n`;

  const metaItems: string[] = [];
  if (spell.classes && spell.classes.length) {
    metaItems.push(`- **Classes:** ${spell.classes.join(", ")}`);
  }
  if (spell.tags && spell.tags.length) {
    metaItems.push(`- **Tags:** ${spell.tags.join(", ")}`);
  }
  if (spell.source) {
    metaItems.push(`- **Source:** ${spell.source}`);
  }

  if (metaItems.length > 0) {
    body += `\n---\n${metaItems.join("\n")}\n`;
  }

  return `${frontmatter}\n${body}`.trim() + "\n";
}

/**
 * Formats a SourceChapterData object into Markdown with YAML frontmatter
 */
export function sourceToMarkdown(chapter: SourceChapterData): string {
  const frontmatter = `---
name: ${escapeYamlString(chapter.title)}
type: "source"
book: ${escapeYamlString(chapter.bookTitle || "")}
url: ${escapeYamlString(chapter.url || "")}
---`;

  let body = `# ${chapter.title}\n`;
  if (chapter.bookTitle) {
    body += `*${chapter.bookTitle}*\n\n`;
  }
  body += `${chapter.content}\n`;

  return `${frontmatter}\n\n${body}`.trim() + "\n";
}

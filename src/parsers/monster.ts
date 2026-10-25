import { resolveFetch } from '../utils/fetch';
import { MonsterData, AbilityName, AbilityScoreData, ActionItemData } from '../types';
import { formatModifier, ALIGNMENTS } from '../utils/modifiers';
import { htmlToMarkdown } from '../utils/html';

export interface FetchMonsterOptions {
  fetchFn?: typeof fetch;
}

export function extractMonsterId(urlOrId: string | number): number | null {
  if (typeof urlOrId === 'number') return urlOrId;
  const match = String(urlOrId).match(/\/monsters\/(\d+)/);
  if (match) return parseInt(match[1], 10);
  const numericOnly = String(urlOrId).replace(/[^\d]/g, '');
  if (numericOnly) return parseInt(numericOnly, 10);
  return null;
}

export async function fetchMonsterById(
  monsterId: string | number,
  options: FetchMonsterOptions = {}
): Promise<MonsterData> {
  const id = extractMonsterId(monsterId);
  if (!id) {
    throw new Error(`Could not parse numeric D&D Beyond monster ID from: "${monsterId}"`);
  }

  const url = `https://monster-service.dndbeyond.com/v1/Monster/${id}`;
  const fetcher = resolveFetch(options.fetchFn);

  const response = await fetcher.call(globalThis, url, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} loading monster ${id}: ${await response.text().catch(() => '')}`);
  }

  const json = await response.json();
  if (!json || !json.data) {
    throw new Error(`Invalid response received for monster ID: ${id}`);
  }

  return parseMonsterJson(json.data);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseMonsterJson(d: any): MonsterData {
  if (!d || typeof d !== 'object') {
    throw new Error('Invalid monster data provided to parseMonsterJson');
  }

  const abilityKeys: AbilityName[] = [
    'strength',
    'dexterity',
    'constitution',
    'intelligence',
    'wisdom',
    'charisma',
  ];

  const abilities = {} as Record<AbilityName, AbilityScoreData>;
  (d.stats || []).forEach((st: any, idx: number) => {
    const ab = abilityKeys[idx];
    if (ab) {
      const score = st.value ?? 10;
      const modValue = Math.floor((score - 10) / 2);
      abilities[ab] = {
        score,
        modifier: formatModifier(modValue),
        modValue,
        save: formatModifier(modValue),
        saveValue: modValue,
        isProficient: false,
      };
    }
  });

  // Saving throw overrides
  const savingThrows: string[] = [];
  (d.savingThrows || []).forEach((st: any) => {
    const ab = abilityKeys[st.statId - 1];
    if (ab && abilities[ab]) {
      const saveVal = st.value ?? abilities[ab].modValue;
      abilities[ab].saveValue = saveVal;
      abilities[ab].save = formatModifier(saveVal);
      abilities[ab].isProficient = true;
      savingThrows.push(`${ab.charAt(0).toUpperCase() + ab.slice(1)} ${formatModifier(saveVal)}`);
    }
  });

  // Speed
  const speedParts: string[] = [];
  (d.movements || []).forEach((m: any) => {
    const typeNames: Record<number, string> = {
      1: 'walk',
      2: 'burrow',
      3: 'climb',
      4: 'fly',
      5: 'swim',
    };
    const tName = typeNames[m.movementId] || 'walk';
    if (tName === 'walk') {
      speedParts.unshift(`${m.speed} ft.`);
    } else {
      speedParts.push(`${m.speed} ft. (${tName})`);
    }
  });
  const speedStr = speedParts.join(', ') || '30 ft.';

  // Senses
  const sensesList: string[] = [];
  (d.senses || []).forEach((s: any) => {
    const senseNames: Record<number, string> = {
      1: 'Blindsight',
      2: 'Darkvision',
      3: 'Tremorsense',
      4: 'Truesight',
    };
    const name = senseNames[s.senseId] || 'Sense';
    sensesList.push(`${name} ${s.notes || ''}`.trim());
  });
  if (d.passivePerception) {
    sensesList.push(`Passive Perception ${d.passivePerception}`);
  }

  // Languages
  const langStr = (d.languageDescription || '').trim() || 'None';
  const languages = langStr !== 'None' ? langStr.split(',').map((l: string) => l.trim()) : [];

  // Parse HTML section blocks into structured ActionItemData
  function parseHtmlActionSection(html: string): ActionItemData[] {
    if (!html) return [];
    const items: ActionItemData[] = [];

    // Match paragraphs with bold titles: <p><em><strong>Name.</strong></em> Description...</p>
    const pRegex = /<p[^>]*>(?:<em><strong>|<strong><em>|<strong>)([\s\S]*?)(?:<\/strong><\/em>|<\/em><\/strong>|<\/strong>)\.?\s*([\s\S]*?)<\/p>/gi;
    let match: RegExpExecArray | null;

    while ((match = pRegex.exec(html)) !== null) {
      const name = match[1].replace(/<[^>]+>/g, '').replace(/\.$/, '').trim();
      const descHtml = match[2];
      const description = htmlToMarkdown(descHtml).trim();
      if (name) {
        items.push({ name, description });
      }
    }

    // Fallback if no matching paragraphs found: convert entire section
    if (items.length === 0 && html.trim()) {
      items.push({
        name: 'Action',
        description: htmlToMarkdown(html).trim(),
      });
    }

    return items;
  }

  // CR and XP
  const crMap: Record<number, { cr: string; xp: number }> = {
    1: { cr: '0', xp: 10 },
    2: { cr: '1/8', xp: 25 },
    3: { cr: '1/4', xp: 50 },
    4: { cr: '1/2', xp: 100 },
    5: { cr: '1', xp: 200 },
    6: { cr: '2', xp: 450 },
    7: { cr: '3', xp: 700 },
    8: { cr: '4', xp: 1100 },
    9: { cr: '5', xp: 1800 },
    10: { cr: '6', xp: 2300 },
    11: { cr: '7', xp: 2900 },
    12: { cr: '8', xp: 3900 },
    13: { cr: '9', xp: 5000 },
    14: { cr: '10', xp: 5900 },
    15: { cr: '11', xp: 7200 },
    16: { cr: '12', xp: 8400 },
    17: { cr: '13', xp: 10000 },
    18: { cr: '14', xp: 11500 },
    19: { cr: '15', xp: 13000 },
    20: { cr: '16', xp: 15000 },
    21: { cr: '17', xp: 18000 },
    22: { cr: '18', xp: 20000 },
    23: { cr: '19', xp: 22000 },
    24: { cr: '20', xp: 25000 },
    25: { cr: '21', xp: 33000 },
    26: { cr: '22', xp: 41000 },
    27: { cr: '23', xp: 50000 },
    28: { cr: '24', xp: 62000 },
    29: { cr: '25', xp: 75000 },
    30: { cr: '26', xp: 90000 },
    31: { cr: '27', xp: 105000 },
    32: { cr: '28', xp: 120000 },
    33: { cr: '29', xp: 135000 },
    34: { cr: '30', xp: 155000 },
  };

  const crInfo = crMap[d.challengeRatingId] || { cr: '0', xp: 0 };

  const sizeMap: Record<number, string> = {
    2: 'Tiny',
    3: 'Small',
    4: 'Medium',
    5: 'Large',
    6: 'Huge',
    7: 'Gargantuan',
  };
  const size = sizeMap[d.sizeId] || 'Medium';

  const typeMap: Record<number, string> = {
    1: 'Aberration',
    2: 'Beast',
    3: 'Celestial',
    4: 'Construct',
    5: 'Dragon',
    6: 'Elemental',
    7: 'Fey',
    8: 'Fiend',
    9: 'Giant',
    10: 'Humanoid',
    11: 'Monstrosity',
    12: 'Ooze',
    13: 'Plant',
    14: 'Undead',
  };
  const type = typeMap[d.typeId] || 'Creature';

  return {
    id: d.id,
    name: d.name || 'Unnamed Monster',
    imageUrl: d.largeAvatarUrl || d.avatarUrl || undefined,
    cr: crInfo.cr,
    xp: crInfo.xp,
    size,
    type,
    alignment: ALIGNMENTS[d.alignmentId] || 'Unaligned',
    ac: {
      value: d.armorClass || 10,
      formula: (d.armorClassDescription || '').trim() || undefined,
    },
    hp: {
      value: d.averageHitPoints || 10,
      max: d.averageHitPoints || 10,
      formula: d.hitPointDice?.diceString || undefined,
    },
    speed: speedStr,
    abilities,
    savingThrows,
    skills: (d.skills || []).map((s: any) => `Skill ${s.skillId} +${s.value}`),
    senses: sensesList,
    languages,
    traits: parseHtmlActionSection(d.specialTraitsDescription || ''),
    actions: parseHtmlActionSection(d.actionsDescription || ''),
    bonusActions: parseHtmlActionSection(d.bonusActionsDescription || ''),
    reactions: parseHtmlActionSection(d.reactionsDescription || ''),
    legendaryActions: parseHtmlActionSection(d.legendaryActionsDescription || ''),
    lairActions: parseHtmlActionSection(d.lairDescription || ''),
    description: htmlToMarkdown(d.characteristicsDescription || ''),
    environments: (d.environments || []).map(String),
  };
}

/**
 * Fallback DOM Parser when on an unlisted or homebrew monster page
 */
export function parseMonsterDom(root: HTMLElement | Document): MonsterData {
  const is2024 = Boolean(root.querySelector('.mon-stat-block-2024'));
  const prefix = is2024 ? '.mon-stat-block-2024' : '.mon-stat-block';

  // 1. Name
  const nameEl = root.querySelector(`${prefix}__name-link, ${prefix}__name`);
  const name = nameEl ? (nameEl.textContent || '').trim() : 'Unnamed Monster';

  // 2. Meta: Size, Type, Alignment
  const metaEl = root.querySelector(`${prefix}__meta`);
  const metaText = metaEl ? (metaEl.textContent || '').trim() : 'Medium beast, unaligned';

  let size = 'Medium';
  let type = 'beast';
  let alignment = 'unaligned';

  if (metaText.includes(',')) {
    const parts = metaText.split(',');
    alignment = parts[parts.length - 1].trim();
    const typePart = parts.slice(0, parts.length - 1).join(',').trim();
    const firstSpace = typePart.indexOf(' ');
    if (firstSpace !== -1) {
      size = typePart.substring(0, firstSpace).trim();
      type = typePart.substring(firstSpace + 1).trim();
    } else {
      type = typePart;
    }
  }

  // 3. Attributes (AC, HP, Speed)
  let acVal = 10;
  let acFormula: string | undefined = undefined;
  let hpVal = 10;
  let hpFormula: string | undefined = undefined;
  let speedStr = '30 ft.';

  const attrEls = root.querySelectorAll(`${prefix}__attribute`);
  attrEls.forEach((attr) => {
    const label = (attr.querySelector(`${prefix}__attribute-label`)?.textContent || '').trim().toUpperCase();
    const valEl = attr.querySelector(`${prefix}__attribute-data-value, ${prefix}__attribute-value`);
    const extraEl = attr.querySelector(`${prefix}__attribute-data-extra`);

    if (label.includes('AC') || label.includes('ARMOR CLASS')) {
      if (valEl) acVal = parseInt((valEl.textContent || '10').replace(/[^\d]/g, ''), 10) || 10;
      if (extraEl) acFormula = (extraEl.textContent || '').trim();
    } else if (label.includes('HP') || label.includes('HIT POINTS')) {
      if (valEl) hpVal = parseInt((valEl.textContent || '10').replace(/[^\d]/g, ''), 10) || 10;
      if (extraEl) hpFormula = (extraEl.textContent || '').replace(/[()]/g, '').trim();
    } else if (label.includes('SPEED')) {
      if (valEl) speedStr = (valEl.textContent || '30 ft.').trim();
    }
  });

  // 4. Ability Scores
  const abilityKeys: AbilityName[] = [
    'strength',
    'dexterity',
    'constitution',
    'intelligence',
    'wisdom',
    'charisma',
  ];
  const abilities = {} as Record<AbilityName, AbilityScoreData>;

  // Check 2024 table rows first
  const rows = root.querySelectorAll('table.stat-table tbody tr');
  if (rows.length >= 6) {
    rows.forEach((row) => {
      const th = row.querySelector('th');
      const tds = row.querySelectorAll('td');
      if (th && tds.length >= 3) {
        const abShort = (th.textContent || '').trim().toUpperCase();
        const map: Record<string, AbilityName> = {
          STR: 'strength',
          DEX: 'dexterity',
          CON: 'constitution',
          INT: 'intelligence',
          WIS: 'wisdom',
          CHA: 'charisma',
        };
        const abName = map[abShort];
        if (abName) {
          const score = parseInt(tds[0].textContent || '10', 10) || 10;
          const modText = (tds[1].textContent || '+0').trim();
          const saveText = (tds[2].textContent || modText).trim();
          const modValue = Math.floor((score - 10) / 2);

          abilities[abName] = {
            score,
            modifier: formatModifier(modText),
            modValue,
            save: formatModifier(saveText),
            saveValue: parseInt(saveText.replace(/[^\d+-]/g, ''), 10) || modValue,
            isProficient: saveText !== modText,
          };
        }
      }
    });
  } else {
    // Classic .ability-block stats
    abilityKeys.forEach((ab) => {
      const short = ab.substring(0, 3);
      const statEl = root.querySelector(`.ability-block__stat--${short}`);
      const scoreEl = statEl?.querySelector('.ability-block__score');
      const score = scoreEl ? parseInt(scoreEl.textContent || '10', 10) : 10;
      const modValue = Math.floor((score - 10) / 2);
      abilities[ab] = {
        score,
        modifier: formatModifier(modValue),
        modValue,
        save: formatModifier(modValue),
        saveValue: modValue,
        isProficient: false,
      };
    });
  }

  // 5. Tidbits (CR, XP, Senses, Languages)
  let cr = '0';
  let xp = 0;
  const senses: string[] = [];
  const languages: string[] = [];

  const tidbitEls = root.querySelectorAll(`${prefix}__tidbit`);
  tidbitEls.forEach((tb) => {
    const label = (tb.querySelector(`${prefix}__tidbit-label`)?.textContent || '').trim().toUpperCase();
    const data = (tb.querySelector(`${prefix}__tidbit-data`)?.textContent || '').trim();

    if (label.includes('CHALLENGE') || label === 'CR') {
      const match = data.match(/^([^\s]+)\s*\(([^)]+)\)/);
      if (match) {
        cr = match[1];
        xp = parseInt(match[2].replace(/[^\d]/g, ''), 10) || 0;
      } else {
        cr = data;
      }
    } else if (label.includes('SENSES')) {
      data.split(',').forEach((s) => senses.push(s.trim()));
    } else if (label.includes('LANGUAGES')) {
      data.split(',').forEach((l) => languages.push(l.trim()));
    }
  });

  // 6. Action Sections with safe st.remove()
  function parseDomSection(headingName: string): ActionItemData[] {
    const items: ActionItemData[] = [];
    const blocks = root.querySelectorAll(`${prefix}__description-block`);

    blocks.forEach((block) => {
      const heading = (block.querySelector(`${prefix}__description-block-heading`)?.textContent || '').trim().toUpperCase();
      if (!heading.includes(headingName)) return;

      const paragraphs = block.querySelectorAll('p');
      paragraphs.forEach((p) => {
        const strong = p.querySelector('strong');
        if (!strong) return;

        const actionName = (strong.textContent || '').replace(/\.$/, '').trim();
        const pClone = p.cloneNode(true) as HTMLElement;
        const stClone = pClone.querySelector('strong');
        if (stClone) {
          // Safe node removal regardless of nesting inside <em>
          stClone.remove();
        }

        const desc = htmlToMarkdown(pClone.innerHTML).trim();
        if (actionName) {
          items.push({ name: actionName, description: desc });
        }
      });
    });

    return items;
  }

  const traits = parseDomSection('TRAIT');
  const actions = parseDomSection('ACTION');
  const bonusActions = parseDomSection('BONUS');
  const reactions = parseDomSection('REACTION');
  const legendaryActions = parseDomSection('LEGENDARY');
  const lairActions = parseDomSection('LAIR');

  const imgEl = root.querySelector(`${prefix}__image img, .monster-image-lightbox-link img`) as HTMLImageElement | null;
  const imageUrl = imgEl?.src || undefined;

  return {
    name,
    imageUrl,
    cr,
    xp,
    size,
    type,
    alignment,
    ac: { value: acVal, formula: acFormula },
    hp: { value: hpVal, max: hpVal, formula: hpFormula },
    speed: speedStr,
    abilities,
    savingThrows: [],
    skills: [],
    senses: senses.length ? senses : ['Passive Perception 10'],
    languages: languages.length ? languages : ['Common'],
    traits,
    actions,
    bonusActions,
    reactions,
    legendaryActions,
    lairActions,
  };
}

import { cleanDdbImageUrl } from '../utils/image';
import { resolveFetch } from '../utils/fetch';
import {
  CharacterData,
  ClassLevelData,
  CharacterFeatureData,
  InventoryItemData,
  SpellData,
  SpellcastingData,
  SpellSlotData,
} from '../types';
import {
  calculateAbilities,
  calculateSkills,
  calculateProficiencyBonus,
  formatModifier,
  ALIGNMENTS,
} from '../utils/modifiers';
import { htmlToMarkdown } from '../utils/html';

export interface FetchCharacterOptions {
  includeCustomItems?: boolean;
  cobaltSession?: string;
  authToken?: string;
  fetchFn?: typeof fetch;
}

let cachedCobaltToken: { token: string; expiresAt: number } | null = null;

export async function getCobaltAuthToken(options: FetchCharacterOptions = {}): Promise<string | null> {
  if (options.authToken) {
    return options.authToken;
  }

  if (cachedCobaltToken && cachedCobaltToken.expiresAt > Date.now()) {
    return cachedCobaltToken.token;
  }

  try {
    const fetcher = resolveFetch(options.fetchFn);
    const authHeaders: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    if (options.cobaltSession) {
      authHeaders["Cookie"] = `CobaltSession=${options.cobaltSession}`;
    }

    const authRes = await fetcher.call(globalThis, "https://auth-service.dndbeyond.com/v1/cobalt-token", {
      method: "POST",
      headers: authHeaders,
      credentials: "include",
    });

    if (authRes.ok) {
      const data = await authRes.json();
      if (data && data.token) {
        const ttl = typeof data.ttl === "number" ? data.ttl : 300;
        cachedCobaltToken = {
          token: data.token,
          expiresAt: Date.now() + Math.max(10, ttl - 30) * 1000,
        };
        return data.token;
      }
    }
  } catch {
    // Ignore and fallback
  }

  return null;
}

export function extractCharacterId(urlOrId: string | number): number | null {
  if (typeof urlOrId === "number") return urlOrId;
  const str = String(urlOrId).trim();
  const match = str.match(/\/characters\/(\d+)/);
  if (match) return parseInt(match[1], 10);
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  return null;
}

export async function fetchCharacterById(
  characterId: string | number,
  options: FetchCharacterOptions = {}
): Promise<CharacterData> {
  const id = extractCharacterId(characterId);
  if (!id) {
    throw new Error(`Could not parse D&D Beyond character ID from: "${characterId}"`);
  }
  const customItems = options.includeCustomItems !== false;
  const url = `https://character-service.dndbeyond.com/character/v5/character/${id}?includeCustomItems=${customItems}`;

  const fetcher = resolveFetch(options.fetchFn);

  const doFetch = async (authToken?: string | null) => {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (authToken) {
      headers["Authorization"] = authToken.startsWith("Bearer ") ? authToken : `Bearer ${authToken}`;
    }

    if (options.cobaltSession) {
      headers["Cookie"] = `CobaltSession=${options.cobaltSession}`;
    }

    return fetcher.call(globalThis, url, {
      headers,
      credentials: "include",
    });
  };

  let token = await getCobaltAuthToken(options);
  let response = await doFetch(token);

  // If 401/403 and we had a cached token, retry once with refreshed token
  if ((response.status === 401 || response.status === 403) && cachedCobaltToken) {
    cachedCobaltToken = null;
    token = await getCobaltAuthToken(options);
    if (token) {
      response = await doFetch(token);
    }
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} loading character ${id}: ${await response.text().catch(() => "")}`);
  }

  const json = await response.json();
  if (!json.success || !json.data) {
    throw new Error(json.message || `Failed to retrieve character data for ID: ${id}`);
  }

  return parseCharacterJson(json.data);
}

/**
 * Looks up a character sheet customization value from D&D Beyond's `characterValues` array.
 * Common `typeId`s:
 * - 8: Custom Name (string)
 * - 9: Custom Notes (string)
 * - 10: Damage Bonus (number | string)
 * - 12: To-Hit Bonus (number)
 * - 19: Cost Override in gp (number)
 * - 20: Silvered (boolean)
 * - 21: Adamantine (boolean)
 * - 22: Weight Override in lbs (number)
 */
export function getCharacterCustomValue(
  characterValues: any[] | undefined,
  entityId: string | number | undefined | null,
  entityTypeId: string | number | undefined | null,
  typeId: number
): any {
  if (!Array.isArray(characterValues) || entityId === undefined || entityId === null) {
    return undefined;
  }
  const idStr = String(entityId);
  const typeIdStr = entityTypeId !== undefined && entityTypeId !== null ? String(entityTypeId) : null;

  for (let i = characterValues.length - 1; i >= 0; i--) {
    const cv = characterValues[i];
    if (!cv || cv.typeId !== typeId || String(cv.valueId) !== idStr) continue;
    if (typeIdStr !== null && cv.valueTypeId !== undefined && cv.valueTypeId !== null) {
      if (String(cv.valueTypeId) !== typeIdStr) continue;
    }
    if (cv.value !== undefined && cv.value !== null) {
      return cv.value;
    }
  }

  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseCharacterJson(d: any): CharacterData {
  if (!d || typeof d !== 'object') {
    throw new Error('Invalid character data provided to parseCharacterJson');
  }

  // 1. Classes and Level
  let totalLevel = 0;
  const classes: ClassLevelData[] = (d.classes || []).map((cls: any) => {
    const name = cls.definition?.name || 'Unknown Class';
    const level = cls.level || 0;
    totalLevel += level;
    const subclass = cls.subclassDefinition?.name || undefined;
    return { name, subclass, level };
  });

  const classLine = classes.length
    ? classes.map((c) => (c.subclass ? `${c.name} (${c.subclass}) ${c.level}` : `${c.name} ${c.level}`)).join(' / ')
    : 'None';

  const profBonus = calculateProficiencyBonus(totalLevel);

  // 2. Ability Scores and Skills
  const abilities = calculateAbilities(d, totalLevel);
  const skills = calculateSkills(d, abilities, profBonus);

  // 3. Species, Background, Alignment
  const species = d.race?.fullName || d.race?.baseRaceName || 'Unknown Species';
  const background = d.background?.definition?.name || d.customBackground?.name || 'None';
  const alignment = ALIGNMENTS[d.alignmentId] || 'None';

  // 4. Hit Points
  const conMod = abilities.constitution.modValue;
  const allModifiers = Object.values(d.modifiers || {})
    .flat()
    .filter(Boolean) as any[];

  let flatHpBonus = 0;
  let perLevelHpBonus = 0;
  allModifiers.forEach((mod) => {
    if (mod.type === 'bonus') {
      if (mod.subType === 'hit-points') flatHpBonus += mod.value || 0;
      if (mod.subType === 'hit-points-per-level') perLevelHpBonus += mod.value || 0;
    }
  });

  const baseHP = d.baseHitPoints || 0;
  let maxHP = baseHP + conMod * totalLevel + flatHpBonus + perLevelHpBonus * totalLevel;
  if (d.overrideHitPoints) maxHP = d.overrideHitPoints;
  if (d.bonusHitPoints) maxHP += d.bonusHitPoints;

  const removedHP = d.removedHitPoints || 0;
  const currentHP = maxHP - removedHP;
  const tempHP = d.temporaryHitPoints || 0;

  // 5. Armor Class
  const equippedItems = (d.inventory || []).filter((item: any) => item.equipped);
  const equippedArmor = equippedItems.find(
    (item: any) => item.definition && item.definition.filterType === 'Armor' && item.definition.armorTypeId !== 4
  );
  const equippedShield = equippedItems.find(
    (item: any) => item.definition && item.definition.filterType === 'Armor' && item.definition.armorTypeId === 4
  );

  let baseAC = 10;
  let dexLimit = Infinity;
  let dexBonusActive = true;

  if (equippedArmor) {
    baseAC = equippedArmor.definition.armorClass || 10;
    const armorType = equippedArmor.definition.armorTypeId;
    if (armorType === 2) dexLimit = 2; // Medium Armor
    else if (armorType === 3) dexBonusActive = false; // Heavy Armor
  }

  const dexAC = dexBonusActive ? Math.min(dexLimit, abilities.dexterity.modValue) : 0;
  const shieldAC = equippedShield ? equippedShield.definition.armorClass || 2 : 0;

  let acBonus = 0;
  allModifiers.forEach((mod) => {
    if (mod.type === 'bonus' && mod.subType === 'armor-class') {
      acBonus += mod.value || 0;
    }
  });

  const totalAC = baseAC + dexAC + shieldAC + acBonus;

  // 6. Speeds
  let walkSpeed = d.race?.weightSpeeds?.normal?.walk || 30;
  let speedBonus = 0;
  allModifiers.forEach((mod) => {
    if (mod.type === 'bonus' && (mod.subType === 'speed' || mod.subType === 'speed-walk')) {
      speedBonus += mod.value || 0;
    }
  });
  walkSpeed += speedBonus;

  const speedsObj: CharacterData['speeds'] = { walk: walkSpeed };
  const rawSpeeds = d.race?.weightSpeeds?.normal || {};

  if (rawSpeeds.fly) {
    let flySpeed = rawSpeeds.fly;
    allModifiers.forEach((mod) => {
      if (mod.type === 'bonus' && mod.subType === 'speed-flying') flySpeed += mod.value || 0;
      if (mod.type === 'set' && mod.subType === 'innate-speed-flying') flySpeed = Math.max(flySpeed, mod.value || walkSpeed);
    });
    const canHover = allModifiers.some(
      (mod) => mod.subType === 'innate-speed-flying' && String(mod.restriction || '').toLowerCase().includes('hover')
    );
    speedsObj.fly = flySpeed;
    speedsObj.hover = canHover;
  }
  if (rawSpeeds.swim) speedsObj.swim = rawSpeeds.swim;
  if (rawSpeeds.climb) speedsObj.climb = rawSpeeds.climb;
  if (rawSpeeds.burrow) speedsObj.burrow = rawSpeeds.burrow;

  const speedParts = [`${walkSpeed} ft`];
  if (speedsObj.fly) speedParts.push(`${speedsObj.fly} ft (fly)${speedsObj.hover ? ' (hover)' : ''}`);
  if (speedsObj.swim) speedParts.push(`${speedsObj.swim} ft (swim)`);
  if (speedsObj.climb) speedParts.push(`${speedsObj.climb} ft (climb)`);
  if (speedsObj.burrow) speedParts.push(`${speedsObj.burrow} ft (burrow)`);
  const speedStr = speedParts.join(', ');

  // 7. Senses & Languages
  let darkvisionRange = 0;
  allModifiers.forEach((mod) => {
    if (mod.type === 'set-base' && mod.subType === 'darkvision') {
      darkvisionRange = Math.max(darkvisionRange, mod.value || 0);
    }
  });
  if (d.race?.racialTraits) {
    d.race.racialTraits.forEach((t: any) => {
      if (t.definition?.name === 'Darkvision') darkvisionRange = Math.max(darkvisionRange, 60);
    });
  }

  const perceptionSkill = skills.find((s) => s.name === 'Perception');
  const passivePerception = perceptionSkill ? perceptionSkill.passive : 10 + abilities.wisdom.modValue;

  const senses: string[] = [];
  if (darkvisionRange > 0) senses.push(`Darkvision ${darkvisionRange} ft`);
  senses.push(`Passive Perception ${passivePerception}`);

  const langSet = new Set<string>();
  allModifiers.forEach((mod) => {
    if (mod.type === 'language') {
      const lName = mod.friendlySubtypeName || mod.subType;
      if (lName) {
        langSet.add(lName.charAt(0).toUpperCase() + lName.slice(1).toLowerCase());
      }
    }
  });
  const languages = Array.from(langSet);

  // 8. Features & Traits
  const features: CharacterFeatureData[] = [];

  const resolveFeatureNameAndDesc = (def: any) => {
    const rawCustomName = getCharacterCustomValue(d.characterValues, def.id, def.entityTypeId, 8);
    const customName = typeof rawCustomName === 'string' && rawCustomName.trim() ? rawCustomName.trim() : undefined;
    let desc = htmlToMarkdown(def.description);
    const rawCustomNotes = getCharacterCustomValue(d.characterValues, def.id, def.entityTypeId, 9);
    if (typeof rawCustomNotes === 'string' && rawCustomNotes.trim()) {
      const cleanedNotes = rawCustomNotes.replace(/\r\n/g, '\n').trim();
      desc = desc ? `**Notes:** ${cleanedNotes}\n\n${desc}` : `**Notes:** ${cleanedNotes}`;
    }
    return {
      name: customName || def.name,
      description: desc,
    };
  };

  // Racial traits
  if (d.race?.racialTraits) {
    d.race.racialTraits.forEach((trait: any) => {
      const t = trait.definition;
      if (t && !t.hideInSheet) {
        const resolved = resolveFeatureNameAndDesc(t);
        features.push({
          name: resolved.name,
          type: 'Species Trait',
          description: resolved.description,
        });
      }
    });
  }

  // Class features
  if (d.classes) {
    d.classes.forEach((cls: any) => {
      if (cls.classFeatures) {
        cls.classFeatures.forEach((feat: any) => {
          const f = feat.definition;
          if (f && !f.hideInSheet && cls.level >= feat.requiredLevel) {
            const resolved = resolveFeatureNameAndDesc(f);
            features.push({
              name: resolved.name,
              type: 'Class Feature',
              source: cls.definition?.name,
              description: resolved.description,
            });
          }
        });
      }
    });
  }

  // Feats
  if (d.feats) {
    d.feats.forEach((feat: any) => {
      const f = feat.definition;
      if (f) {
        const resolved = resolveFeatureNameAndDesc(f);
        features.push({
          name: resolved.name,
          type: 'Feat',
          description: resolved.description,
        });
      }
    });
  }

  // 9. Inventory
  const inventory: InventoryItemData[] = (d.inventory || []).map((item: any) => {
    const def = item.definition || {};
    const qty = item.quantity ?? 1;
    const isHomebrew = Boolean(def.isHomebrew || item.isHomebrew);
    const isCustomItem = Boolean(def.isCustomItem || item.isCustomItem);
    let hasCustomization = isCustomItem;

    const rawCustomName = getCharacterCustomValue(d.characterValues, item.id, item.entityTypeId, 8);
    const customName = typeof rawCustomName === 'string' && rawCustomName.trim() ? rawCustomName.trim() : undefined;
    const baseName = def.name || 'Unknown Item';
    const name = customName || baseName;
    const originalName = customName && customName !== baseName ? baseName : undefined;
    if (originalName) {
      hasCustomization = true;
    }

    const rawCustomWeight = getCharacterCustomValue(d.characterValues, item.id, item.entityTypeId, 22);
    const parsedCustomWeight =
      rawCustomWeight !== undefined && rawCustomWeight !== null && rawCustomWeight !== ''
        ? Number(rawCustomWeight)
        : NaN;
    if (!Number.isNaN(parsedCustomWeight)) {
      hasCustomization = true;
    }
    const wt = !Number.isNaN(parsedCustomWeight) ? parsedCustomWeight : (def.weight || 0);
    const totalWeight = parseFloat((qty * wt).toFixed(1));

    const rawCustomCost = getCharacterCustomValue(d.characterValues, item.id, item.entityTypeId, 19);
    const parsedCustomCost =
      rawCustomCost !== undefined && rawCustomCost !== null && rawCustomCost !== ''
        ? Number(rawCustomCost)
        : NaN;
    if (!Number.isNaN(parsedCustomCost)) {
      hasCustomization = true;
    }
    const costVal = !Number.isNaN(parsedCustomCost) ? parsedCustomCost : def.cost;
    const cost =
      costVal !== undefined && costVal !== null && costVal !== '' && (!Number.isNaN(parsedCustomCost) || Boolean(costVal))
        ? `${costVal} gp`
        : undefined;

    const propNames: string[] = Array.isArray(def.properties)
      ? def.properties.map((p: any) => p?.name).filter(Boolean)
      : [];
    if (getCharacterCustomValue(d.characterValues, item.id, item.entityTypeId, 20)) {
      hasCustomization = true;
      if (!propNames.includes('Silvered')) propNames.push('Silvered');
    }
    if (getCharacterCustomValue(d.characterValues, item.id, item.entityTypeId, 21)) {
      hasCustomization = true;
      if (!propNames.includes('Adamantine')) propNames.push('Adamantine');
    }
    if (getCharacterCustomValue(d.characterValues, item.id, item.entityTypeId, 28)) {
      hasCustomization = true;
      if (!propNames.includes('Pact Weapon')) propNames.push('Pact Weapon');
    }
    if (getCharacterCustomValue(d.characterValues, item.id, item.entityTypeId, 29)) {
      hasCustomization = true;
      if (!propNames.includes('Hex Weapon')) propNames.push('Hex Weapon');
    }

    const notes: string[] = [];
    if (propNames.length > 0) {
      notes.push(`Properties: ${propNames.join(', ')}`);
    }

    const rawToHitOverride = getCharacterCustomValue(d.characterValues, item.id, item.entityTypeId, 13);
    if (rawToHitOverride !== undefined && rawToHitOverride !== null && rawToHitOverride !== '') {
      const num = Number(rawToHitOverride);
      if (!Number.isNaN(num)) {
        hasCustomization = true;
        notes.push(`To-Hit Override: ${num >= 0 ? `+${num}` : num}`);
      }
    }

    const rawToHitBonus = getCharacterCustomValue(d.characterValues, item.id, item.entityTypeId, 12);
    if (rawToHitBonus !== undefined && rawToHitBonus !== null && rawToHitBonus !== '') {
      const num = Number(rawToHitBonus);
      if (!Number.isNaN(num) && num !== 0) {
        hasCustomization = true;
        notes.push(`To-Hit Bonus: ${num > 0 ? `+${num}` : num}`);
      }
    }

    const rawDamageBonus = getCharacterCustomValue(d.characterValues, item.id, item.entityTypeId, 10);
    if (rawDamageBonus !== undefined && rawDamageBonus !== null && rawDamageBonus !== '') {
      const num = Number(rawDamageBonus);
      if (!Number.isNaN(num) && num !== 0) {
        hasCustomization = true;
        notes.push(`Damage Bonus: ${num > 0 ? `+${num}` : num}`);
      } else if (Number.isNaN(num) && String(rawDamageBonus).trim()) {
        hasCustomization = true;
        notes.push(`Damage Bonus: ${String(rawDamageBonus).trim()}`);
      }
    }

    const rawSaveDcOverride = getCharacterCustomValue(d.characterValues, item.id, item.entityTypeId, 15);
    if (rawSaveDcOverride !== undefined && rawSaveDcOverride !== null && rawSaveDcOverride !== '') {
      const num = Number(rawSaveDcOverride);
      if (!Number.isNaN(num)) {
        hasCustomization = true;
        notes.push(`Save DC: ${num}`);
      }
    }

    const rawSaveDcBonus = getCharacterCustomValue(d.characterValues, item.id, item.entityTypeId, 14);
    if (rawSaveDcBonus !== undefined && rawSaveDcBonus !== null && rawSaveDcBonus !== '') {
      const num = Number(rawSaveDcBonus);
      if (!Number.isNaN(num) && num !== 0) {
        hasCustomization = true;
        notes.push(`Save DC Bonus: ${num > 0 ? `+${num}` : num}`);
      }
    }

    let description = htmlToMarkdown(def.description);
    const rawCustomNotes = getCharacterCustomValue(d.characterValues, item.id, item.entityTypeId, 9);
    if (typeof rawCustomNotes === 'string' && rawCustomNotes.trim()) {
      hasCustomization = true;
      const cleanedNotes = rawCustomNotes.replace(/\r\n/g, '\n').trim();
      if (cleanedNotes.includes('\n')) {
        description = description ? `**Notes:** ${cleanedNotes}\n\n${description}` : `**Notes:** ${cleanedNotes}`;
      } else {
        notes.push(`Notes: ${cleanedNotes}`);
      }
    }

    return {
      id: item.id || def.id,
      name,
      ...(originalName ? { originalName } : {}),
      type: def.filterType || 'Gear',
      rarity: def.rarity || undefined,
      ...(isHomebrew ? { isHomebrew: true } : {}),
      ...(isCustomItem ? { isCustomItem: true } : {}),
      ...(hasCustomization ? { isCustomized: true } : {}),
      requiresAttunement: Boolean(def.canAttune),
      attunementDescription: def.attunementDescription || undefined,
      weight: wt,
      cost,
      image: cleanDdbImageUrl(def.largeAvatarUrl || def.avatarUrl),
      description,
      notes: notes.length ? notes : undefined,
      tags: def.tags || [],
      source: def.sources?.[0]?.sourceId ? `Source ID ${def.sources[0].sourceId}` : undefined,
      quantity: qty,
      equipped: Boolean(item.equipped),
      totalWeight,
      containerId: item.containerEntityId || null,
    };
  });

  // Custom items added directly on the D&D Beyond character sheet
  if (Array.isArray(d.customItems)) {
    d.customItems.forEach((ci: any) => {
      if (!ci || !ci.name) return;
      const qty = ci.quantity ?? 1;
      const parsedWt = ci.weight !== undefined && ci.weight !== null && ci.weight !== '' ? Number(ci.weight) : 0;
      const wt = !Number.isNaN(parsedWt) ? parsedWt : 0;
      const totalWeight = parseFloat((qty * wt).toFixed(1));

      let cost: string | undefined = undefined;
      if (ci.cost !== undefined && ci.cost !== null && ci.cost !== '') {
        const costStr = String(ci.cost).trim();
        if (costStr && Number(costStr) !== 0) {
          cost = /[a-z]/i.test(costStr) ? costStr : `${costStr} gp`;
        }
      }

      const notes: string[] = [];
      let description = htmlToMarkdown(ci.description || '');
      if (typeof ci.notes === 'string' && ci.notes.trim()) {
        const cleanedNotes = ci.notes.replace(/\r\n/g, '\n').trim();
        if (cleanedNotes.includes('\n')) {
          description = description ? `**Notes:** ${cleanedNotes}\n\n${description}` : `**Notes:** ${cleanedNotes}`;
        } else {
          notes.push(`Notes: ${cleanedNotes}`);
        }
      }

      inventory.push({
        id: ci.id,
        name: String(ci.name).trim(),
        type: ci.type || 'Other Gear',
        isCustomItem: true,
        isCustomized: true,
        requiresAttunement: false,
        weight: wt,
        cost,
        description,
        notes: notes.length ? notes : undefined,
        tags: [],
        quantity: qty,
        equipped: Boolean(ci.equipped),
        totalWeight,
        containerId: ci.containerEntityId || null,
      });
    });
  }

  // 10. Spells (Class, Subclass, Feat, Race, Item, Background)
  const spellMap = new Map<string, SpellData>();

  function addRawSpell(spellObj: any, source: SpellData['source']) {
    const def = spellObj?.definition;
    if (!def || !def.name) return;

    const rawCustomName = getCharacterCustomValue(d.characterValues, spellObj.id, spellObj.entityTypeId, 8);
    const customName = typeof rawCustomName === 'string' && rawCustomName.trim() ? rawCustomName.trim() : undefined;
    const spellName = customName || def.name;
    const originalName = customName && customName !== def.name ? def.name : undefined;

    if (!spellMap.has(spellName)) {
      const act = def.activation;
      let castTime = '1 Action';
      if (act) {
        const timeVal = act.activationTime ? `${act.activationTime} ` : '';
        const actTypes: Record<number, string> = {
          1: 'Action',
          3: 'Bonus Action',
          4: 'Reaction',
          6: 'Minute',
          7: 'Hour',
          8: 'Special',
        };
        castTime = `${timeVal}${actTypes[act.activationType] || 'Action'}`;
      }

      const rangeVal = def.range ? (def.range.rangeValue ? `${def.range.rangeValue} ft` : def.range.origin || 'Self') : 'Self';

      const compParts: string[] = [];
      if (def.components?.includes(1)) compParts.push('V');
      if (def.components?.includes(2)) compParts.push('S');
      if (def.components?.includes(3)) compParts.push('M');
      let compStr = compParts.join(', ') || 'None';
      if (def.componentsDescription) compStr += ` (${def.componentsDescription})`;

      const duration = def.duration
        ? `${def.duration.durationInterval || ''} ${def.duration.durationUnit || ''}`.trim() || def.duration.durationType || 'Instantaneous'
        : 'Instantaneous';

      let description = htmlToMarkdown(def.description);
      const rawCustomNotes = getCharacterCustomValue(d.characterValues, spellObj.id, spellObj.entityTypeId, 9);
      if (typeof rawCustomNotes === 'string' && rawCustomNotes.trim()) {
        const cleanedNotes = rawCustomNotes.replace(/\r\n/g, '\n').trim();
        description = description ? `**Notes:** ${cleanedNotes}\n\n${description}` : `**Notes:** ${cleanedNotes}`;
      }

      spellMap.set(spellName, {
        id: spellObj.id ?? def.id,
        name: spellName,
        ...(originalName ? { originalName } : {}),
        level: def.level || 0,
        school: def.school || 'Unknown',
        castingTime: castTime,
        range: rangeVal,
        components: compStr,
        duration,
        description,
        source,
        prepared: Boolean(spellObj.prepared),
        alwaysPrepared: Boolean(spellObj.alwaysPrepared),
        concentration: Boolean(def.concentration),
        ritual: Boolean(def.ritual),
      });
    }
  }

  // Class spells (from spell list)
  if (d.classSpells) {
    d.classSpells.forEach((cSpells: any) => {
      (cSpells.spells || []).forEach((s: any) => addRawSpell(s, 'class'));
    });
  }

  // Subclass and class feature bonus spells (e.g. Life Domain, Magical Secrets)
  if (d.spells?.class) {
    d.spells.class.forEach((s: any) => addRawSpell(s, 'subclass'));
  }

  // Feat spells
  if (d.spells?.feat) {
    d.spells.feat.forEach((s: any) => addRawSpell(s, 'feat'));
  }

  // Racial spells
  if (d.spells?.race) {
    d.spells.race.forEach((s: any) => addRawSpell(s, 'race'));
  }

  // Item spells
  if (d.spells?.item) {
    d.spells.item.forEach((s: any) => addRawSpell(s, 'item'));
  }

  // Background spells
  if (d.spells?.background) {
    d.spells.background.forEach((s: any) => addRawSpell(s, 'other'));
  }

  let spellcasting: SpellcastingData | undefined = undefined;
  if (spellMap.size > 0) {
    // Find highest spellcasting ability
    let spellAbilityName = 'intelligence';
    const classAbilityScores: number[] = [];

    (d.classes || []).forEach((cls: any) => {
      if (cls.definition?.spellCastingAbilityId) {
        const abNames: Record<number, string> = {
          1: 'strength',
          2: 'dexterity',
          3: 'constitution',
          4: 'intelligence',
          5: 'wisdom',
          6: 'charisma',
        };
        const abKey = abNames[cls.definition.spellCastingAbilityId] || 'intelligence';
        spellAbilityName = abKey;
        classAbilityScores.push(abilities[abKey as keyof typeof abilities].modValue);
      }
    });

    const spellAbilityMod = classAbilityScores.length ? Math.max(...classAbilityScores) : abilities.intelligence.modValue;

    let spellDCBonus = 0;
    let spellAttackBonus = 0;
    allModifiers.forEach((mod) => {
      if (mod.type === 'bonus') {
        if (mod.subType === 'spell-save-dc') spellDCBonus += mod.value || 0;
        if (mod.subType === 'spell-attacks') spellAttackBonus += mod.value || 0;
      }
    });

    const saveDC = 8 + profBonus + spellAbilityMod + spellDCBonus;
    const attackBonus = formatModifier(profBonus + spellAbilityMod + spellAttackBonus);

    const groups: Record<number, SpellData[]> = {};
    for (const spell of spellMap.values()) {
      if (!groups[spell.level]) groups[spell.level] = [];
      groups[spell.level].push(spell);
    }

    // Sort spells inside levels alphabetically
    Object.keys(groups).forEach((lvl) => {
      groups[Number(lvl)].sort((a, b) => a.name.localeCompare(b.name));
    });

    spellcasting = {
      ability: spellAbilityName.charAt(0).toUpperCase() + spellAbilityName.slice(1),
      saveDC,
      attackBonus,
      groups,
    };
  }

  // 11. Spell Slots
  const spellSlots: SpellSlotData[] = (d.spellSlots || []).map((slot: any) => ({
    level: slot.level,
    used: slot.used || 0,
    available: slot.available || 0,
  }));

  // 12. Bio & Notes
  const bio = {
    appearance: htmlToMarkdown(d.traits?.appearance || ''),
    backstory: htmlToMarkdown(d.notes?.backstory || ''),
    personality: htmlToMarkdown(d.traits?.personalityTraits || ''),
    ideals: htmlToMarkdown(d.traits?.ideals || ''),
    bonds: htmlToMarkdown(d.traits?.bonds || ''),
    flaws: htmlToMarkdown(d.traits?.flaws || ''),
  };

  return {
    id: d.id,
    name: d.name || 'Unnamed Character',
    avatarUrl: cleanDdbImageUrl(d.decorations?.avatarUrl || d.avatarUrl),
    species,
    classes,
    totalLevel,
    classLine,
    background,
    alignment,
    hp: {
      value: currentHP,
      max: maxHP,
      temp: tempHP,
      override: d.overrideHitPoints,
      base: baseHP,
    },
    ac: {
      value: totalAC,
      base: baseAC,
      dexBonus: dexAC,
      shieldBonus: shieldAC,
      otherBonus: acBonus,
    },
    initiative: formatModifier(abilities.dexterity.modValue),
    speed: speedStr,
    speeds: speedsObj,
    proficiencyBonus: profBonus,
    senses,
    languages,
    abilities,
    skills,
    features,
    inventory,
    spellcasting,
    spellSlots,
    bio,
  };
}

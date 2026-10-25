import { AbilityName, AbilityScoreData, SkillData, SkillProficiencyLevel } from '../types';

export const ABILITY_NAMES: AbilityName[] = [
  'strength',
  'dexterity',
  'constitution',
  'intelligence',
  'wisdom',
  'charisma',
];

export const ALIGNMENTS: Record<number, string> = {
  1: 'Lawful Good',
  2: 'Neutral Good',
  3: 'Chaotic Good',
  4: 'Lawful Neutral',
  5: 'Neutral',
  6: 'Chaotic Neutral',
  7: 'Lawful Evil',
  8: 'Neutral Evil',
  9: 'Chaotic Evil',
};

export const SKILL_DEFINITIONS: Record<string, { ab: AbilityName; name: string }> = {
  acrobatics: { ab: 'dexterity', name: 'Acrobatics' },
  'animal-handling': { ab: 'wisdom', name: 'Animal Handling' },
  arcana: { ab: 'intelligence', name: 'Arcana' },
  athletics: { ab: 'strength', name: 'Athletics' },
  deception: { ab: 'charisma', name: 'Deception' },
  history: { ab: 'intelligence', name: 'History' },
  insight: { ab: 'wisdom', name: 'Insight' },
  intimidation: { ab: 'charisma', name: 'Intimidation' },
  investigation: { ab: 'intelligence', name: 'Investigation' },
  medicine: { ab: 'wisdom', name: 'Medicine' },
  nature: { ab: 'intelligence', name: 'Nature' },
  perception: { ab: 'wisdom', name: 'Perception' },
  performance: { ab: 'charisma', name: 'Performance' },
  persuasion: { ab: 'charisma', name: 'Persuasion' },
  religion: { ab: 'intelligence', name: 'Religion' },
  'sleight-of-hand': { ab: 'dexterity', name: 'Sleight of Hand' },
  stealth: { ab: 'dexterity', name: 'Stealth' },
  survival: { ab: 'wisdom', name: 'Survival' },
};

export function formatModifier(mod: number | string | null | undefined): string {
  if (mod === undefined || mod === null || mod === '') return '+0';
  const num = typeof mod === 'number' ? mod : parseInt(String(mod).replace(/[^\d+-]/g, ''), 10);
  if (isNaN(num)) return '+0';
  return num >= 0 ? `+${num}` : `${num}`;
}

export function calculateProficiencyBonus(totalLevel: number): number {
  return Math.floor((Math.max(1, totalLevel) - 1) / 4) + 2;
}

export interface RawDdbCharacterData {
  stats?: Array<{ value: number | null }>;
  bonusStats?: Array<{ value: number | null }>;
  overrideStats?: Array<{ value: number | null }>;
  modifiers?: Record<string, Array<{
    type?: string;
    subType?: string;
    value?: number;
    friendlySubtypeName?: string;
    restriction?: string;
  }>>;
}

export function calculateAbilities(
  data: RawDdbCharacterData,
  totalLevel: number
): Record<AbilityName, AbilityScoreData> {
  const allModifiers = Object.values(data.modifiers || {})
    .flat()
    .filter(Boolean);
  const profBonus = calculateProficiencyBonus(totalLevel);

  const abilities = {} as Record<AbilityName, AbilityScoreData>;

  ABILITY_NAMES.forEach((ab, idx) => {
    const baseScore = data.stats?.[idx]?.value ?? 10;
    const manualBonus = data.bonusStats?.[idx]?.value ?? 0;

    let score = baseScore + manualBonus;
    let bonusSum = 0;
    let setVal: number | null = null;

    allModifiers.forEach((mod) => {
      if (mod.type === 'bonus' && mod.subType === `${ab}-score`) {
        bonusSum += mod.value || 0;
      }
      if (mod.type === 'set' && mod.subType === `${ab}-score`) {
        setVal = Math.max(setVal || 0, mod.value || 0);
      }
    });

    score += bonusSum;
    if (setVal !== null && setVal > score) {
      score = setVal;
    }

    const overrideVal = data.overrideStats?.[idx]?.value;
    if (overrideVal !== undefined && overrideVal !== null) {
      score = overrideVal;
    }

    const modValue = Math.floor((score - 10) / 2);
    const modifier = formatModifier(modValue);

    // Saving throw calculation
    let isProf = false;
    allModifiers.forEach((mod) => {
      if (mod.type === 'proficiency' && mod.subType === `${ab}-saving-throws`) {
        isProf = true;
      }
    });

    let saveBonus = 0;
    allModifiers.forEach((mod) => {
      if (
        mod.type === 'bonus' &&
        (mod.subType === `${ab}-saving-throws` || mod.subType === 'saving-throws')
      ) {
        saveBonus += mod.value || 0;
      }
    });

    const saveValue = modValue + (isProf ? profBonus : 0) + saveBonus;
    const save = formatModifier(saveValue);

    abilities[ab] = {
      score,
      modifier,
      modValue,
      save,
      saveValue,
      isProficient: isProf,
    };
  });

  return abilities;
}

export function calculateSkills(
  data: RawDdbCharacterData,
  abilities: Record<AbilityName, AbilityScoreData>,
  profBonus: number
): SkillData[] {
  const allModifiers = Object.values(data.modifiers || {})
    .flat()
    .filter(Boolean);
  const skills: SkillData[] = [];

  Object.entries(SKILL_DEFINITIONS).forEach(([key, info]) => {
    const abMod = abilities[info.ab].modValue;
    let isProf = false;
    let isExpert = false;
    let hasHalfProf = false;

    allModifiers.forEach((mod) => {
      if (mod.subType === key) {
        if (mod.type === 'proficiency') isProf = true;
        if (mod.type === 'expertise') isExpert = true;
      }
      if (mod.type === 'half-proficiency' && mod.subType === 'ability-checks') {
        hasHalfProf = true;
      }
    });

    let bonus = 0;
    allModifiers.forEach((mod) => {
      if (mod.type === 'bonus' && (mod.subType === key || mod.subType === 'ability-checks')) {
        bonus += mod.value || 0;
      }
    });

    let skillVal = abMod + bonus;
    let level: SkillProficiencyLevel = 'none';

    if (isExpert) {
      skillVal += profBonus * 2;
      level = 'expertise';
    } else if (isProf) {
      skillVal += profBonus;
      level = 'proficient';
    } else if (hasHalfProf) {
      skillVal += Math.floor(profBonus / 2);
      level = 'half';
    }

    let passiveBonus = 0;
    if (key === 'perception') {
      allModifiers.forEach((mod) => {
        if (mod.type === 'bonus' && mod.subType === 'passive-perception') {
          passiveBonus += mod.value || 0;
        }
      });
    }

    const passive = 10 + skillVal + passiveBonus;

    skills.push({
      name: info.name,
      ability: info.ab,
      value: skillVal,
      formatted: formatModifier(skillVal),
      proficiency: level,
      passive,
    });
  });

  return skills;
}

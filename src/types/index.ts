export type AbilityName = 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom' | 'charisma';

export interface AbilityScoreData {
  score: number;
  modifier: string;
  modValue: number;
  save: string;
  saveValue: number;
  isProficient: boolean;
}

export type SkillProficiencyLevel = 'none' | 'half' | 'proficient' | 'expertise';

export interface SkillData {
  name: string;
  ability: AbilityName;
  value: number;
  formatted: string;
  proficiency: SkillProficiencyLevel;
  passive: number;
}

export interface ClassLevelData {
  name: string;
  subclass?: string;
  level: number;
}

export interface CharacterFeatureData {
  name: string;
  type: 'Species Trait' | 'Class Feature' | 'Feat' | 'Feature';
  source?: string;
  description: string;
}

export interface ItemData {
  id?: string | number;
  name: string;
  type: string;
  rarity?: string;
  requiresAttunement: boolean;
  attunementDescription?: string;
  weight?: number;
  cost?: string;
  image?: string;
  description: string;
  notes?: string[];
  tags?: string[];
  source?: string;
}

export interface InventoryItemData extends ItemData {
  quantity: number;
  equipped: boolean;
  totalWeight: number;
  containerId?: number | null;
}

export interface SpellData {
  id?: string | number;
  name: string;
  level: number;
  school: string;
  castingTime: string;
  range: string;
  components: string;
  material?: string;
  duration: string;
  description: string;
  attackSave?: string;
  damageEffect?: string;
  source?: string;
  classes?: string[];
  tags?: string[];
  image?: string;
  prepared?: boolean;
  alwaysPrepared?: boolean;
  concentration?: boolean;
  ritual?: boolean;
}

export interface SpellcastingData {
  ability: string;
  saveDC: number;
  attackBonus: string;
  groups: Record<number, SpellData[]>;
}

export interface SpellSlotData {
  level: number;
  used: number;
  available: number;
}

export interface CharacterBioData {
  appearance?: string;
  backstory?: string;
  personality?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
}

export interface CharacterData {
  id: string | number;
  name: string;
  avatarUrl?: string;
  species: string;
  classes: ClassLevelData[];
  totalLevel: number;
  classLine: string;
  background: string;
  alignment: string;
  hp: {
    value: number;
    max: number;
    temp: number;
    override?: number;
    base?: number;
  };
  ac: {
    value: number;
    formula?: string;
    base: number;
    dexBonus: number;
    shieldBonus: number;
    otherBonus: number;
  };
  initiative: string;
  speed: string;
  speeds: {
    walk: number;
    fly?: number;
    swim?: number;
    climb?: number;
    burrow?: number;
    hover?: boolean;
  };
  proficiencyBonus: number;
  senses: string[];
  languages: string[];
  abilities: Record<AbilityName, AbilityScoreData>;
  skills: SkillData[];
  features: CharacterFeatureData[];
  inventory: InventoryItemData[];
  spellcasting?: SpellcastingData;
  spellSlots: SpellSlotData[];
  bio: CharacterBioData;
}

export interface ActionItemData {
  name: string;
  description: string;
}

export interface MonsterData {
  id?: string | number;
  name: string;
  imageUrl?: string;
  cr: string;
  xp: number;
  size: string;
  type: string;
  subtype?: string;
  alignment: string;
  ac: {
    value: number;
    formula?: string;
  };
  hp: {
    value: number;
    max: number;
    formula?: string;
  };
  speed: string;
  abilities: Record<AbilityName, AbilityScoreData>;
  savingThrows: string[];
  skills: string[];
  damageResistances?: string[];
  damageImmunities?: string[];
  conditionImmunities?: string[];
  senses: string[];
  languages: string[];
  traits: ActionItemData[];
  actions: ActionItemData[];
  bonusActions: ActionItemData[];
  reactions: ActionItemData[];
  legendaryActions: ActionItemData[];
  lairActions: ActionItemData[];
  description?: string;
  environments?: string[];
}

export interface SourceChapterData {
  title: string;
  bookTitle?: string;
  url?: string;
  content: string;
}

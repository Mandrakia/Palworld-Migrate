import palsData from './pals.json';
import passives from './pal_passives.json';

export interface PalPassiveSkill {
    InternalName: string;
    Rating: number,
    I18n: Record<string, StringDesc>,
    Buff: Buff
}
export interface StringDesc {
    Name: string,
    Description: string
}
export interface Buff {
    b_Attack : number;
    b_Defense : number;
    b_CraftSpeed : number;
    b_MoveSpeed : number;
}
export interface PalDatabaseEntry {
  OverrideNameTextID: string;
  NamePrefixID: string;
  OverridePartnerSkillTextID: string;
  IsPal: boolean;
  Tribe: string;
  BPClass: string;
  ZukanIndex: number;
  ZukanIndexSuffix: string;
  Size: string;
  Rarity: number;
  ElementType1: string;
  ElementType2: string;
  GenusCategory: string;
  Organization: string;
  Weapon: string;
  WeaponEquip: boolean;
  Hp: number;
  MeleeAttack: number;
  ShotAttack: number;
  Defense: number;
  Support: number;
  CraftSpeed: number;
  WorkSuitability_EmitFlame: number;
  WorkSuitability_Watering: number;
  WorkSuitability_Seeding: number;
  WorkSuitability_GenerateElectricity: number;
  WorkSuitability_Handcraft: number;
  WorkSuitability_Collection: number;
  WorkSuitability_Deforest: number;
  WorkSuitability_Mining: number;
  WorkSuitability_Transport: number;
  WorkSuitability_MonsterFarm: number;
    WorkSuitability_Cool: number;
    WorkSuitability_ProductMedicine: number;
  IsBoss: boolean;
  Price: number;
  level: number;
  CombiRank: number;
  Combinations: Combination[];
}
export interface Combination  {
    ParentTribeA: string;
    ParentGenderA: string;
    ParentTribeB: string;
    ParentGenderB: string;
    ChildCharacterID: string;
}
export type PalDatabase = Record<string, PalDatabaseEntry>;

export const palDatabase: PalDatabase = palsData as PalDatabase;
export function getPassive(passiveId: string) : PalPassiveSkill {
    return passives[passiveId];
}
export function getPalData(characterId: string): PalDatabaseEntry | null {
  // Try direct lookup first
  if (palDatabase[characterId]) {
    return palDatabase[characterId];
  }
  
  // Try case-insensitive lookup
  const lowerCharacterId = characterId.toLowerCase();
  for (const [key, data] of Object.entries(palDatabase)) {
    if (key.toLowerCase() === lowerCharacterId || data.BPClass?.toLowerCase() === lowerCharacterId) {
      return data;
    }
  }
  
  return null;
}

export function cleanElementType(elementType: string): string {
  return elementType.replace('EPalElementType::', '');
}

export function cleanSizeType(size: string): string {
  return size.replace('EPalSizeType::', '');
}

export function cleanTribe(tribe: string): string {
  return tribe.replace('EPalTribeID::', '');
}

//Get data from backups
export function toRealTime(gameTimeTicks: number) : number {
    // Known pairs: ts = real ticks (.NET), gt = game time
    const ts1 = 638898025627830000n;
    const gt1 = 388580560000000n;

    const ts2 = 638897723789080000n;
    const gt2 = 374999550000000n;

    // Interpolation
    const ratio = Number(gameTimeTicks - Number(gt2)) / Number(gt1 - gt2);
    const interpolatedTicks = ts2 + BigInt(Math.round(Number(ts1 - ts2) * ratio));

    // .NET ticks to JS Date (ticks since 0001-01-01 to ms since 1970-01-01)
    const epochTicks = 621355968000000000n;
    const msSinceUnixEpoch = (interpolatedTicks - epochTicks) / 10000n;
    return Number(msSinceUnixEpoch); // UNIX timestamp in milliseconds
}
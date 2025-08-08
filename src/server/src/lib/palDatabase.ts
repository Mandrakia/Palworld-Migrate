import palsData from '../../../databases/pals.json';
import passives from '../../../databases/pal_passives.json';
import type { LocalizedPassiveSkill } from './interfaces/passive-skills';

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
export type PalPassiveDatabase = Record<string, PalPassiveSkill>;
export const palDatabase: PalDatabase = palsData as PalDatabase;
export const palPassiveDatabase: PalPassiveDatabase = passives as PalPassiveDatabase;

export function getPassive(passiveId: string) : PalPassiveSkill {
    return palPassiveDatabase[passiveId];
}

const localizedPassives = new Map<string,Map<string, LocalizedPassiveSkill>>();
export function getLocalizedPassive(passiveId: string, locale: string) : LocalizedPassiveSkill {
  if(!localizedPassives.has(locale)){
    localizedPassives.set(locale, new Map<string, LocalizedPassiveSkill>());
  }
  if(! localizedPassives.get(locale)!.has(passiveId)){
    const passive = getPassive(passiveId);
    localizedPassives.get(locale)!.set(passiveId,{
      Name: passive.I18n[locale].Name,
      Description: passive.I18n[locale].Description,
      Rating: passive.Rating,
      Buff: {
          Attack: passive.Buff.b_Attack,
          Defense: passive.Buff.b_Defense,
          CraftSpeed: passive.Buff.b_CraftSpeed,
          MoveSpeed: passive.Buff.b_MoveSpeed
      },
      Id: passiveId
    });
  }   
  return localizedPassives.get(locale)!.get(passiveId)!;
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
export function toRealTime(gameTimeTicks: number): number {
    // Known pairs: ts = real ticks (.NET, in LOCAL TIME), gt = game time
    const ts1 = 638898025627830000n;
    const gt1 = 388580560000000n;

    const ts2 = 638897723789080000n;
    const gt2 = 374999550000000n;

    // Interpolation
    const ratio = Number(gameTimeTicks - Number(gt2)) / Number(gt1 - gt2);
    const interpolatedTicks = ts2 + BigInt(Math.round(Number(ts1 - ts2) * ratio));

    // .NET ticks to JS ms since 1970-01-01 (LOCAL)
    const epochTicks = 621355968000000000n;
    const localMs = (interpolatedTicks - epochTicks) / 10000n;

    // Offset from UTC in ms
    const offsetMs = new Date(Number(localMs)).getTimezoneOffset() * 60 * 1000;

    // Convert to UTC by subtracting local offset
    return Number(localMs) + offsetMs;
}
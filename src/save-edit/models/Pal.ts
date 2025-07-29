import { Character } from './Character';
import { CharacterFactory } from './CharacterFactory';
export class Pal extends Character {
  constructor(node: any) {
    super(node);
  }

  get CharacterId(): string {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","CharacterID","value"]);
  }

  set CharacterId(value: string) {
    this.setPath(["value","RawData","value","object","SaveParameter","value","CharacterID","value"], value);
  }

  get Gender(): string {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","Gender","value","value"]);
  }

  set Gender(value: string) {
    this.setPath(["value","RawData","value","object","SaveParameter","value","Gender","value","value"], value);
  }

  get Level(): number {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","Level","value","value"]);
  }

  set Level(value: number) {
    this.setPath(["value","RawData","value","object","SaveParameter","value","Level","value","value"], value);
  }

  get EquipWaza(): string[] {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","EquipWaza","value","values"]);
    }

  get TalentHP(): number {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","Talent_HP","value","value"]);
  }

  set TalentHP(value: number) {
    this.setPath(["value","RawData","value","object","SaveParameter","value","Talent_HP","value","value"], value);
  }

  get TalentShot(): number {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","Talent_Shot","value","value"]);
  }

  set TalentShot(value: number) {
    this.setPath(["value","RawData","value","object","SaveParameter","value","Talent_Shot","value","value"], value);
  }

  get TalentDefense(): number {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","Talent_Defense","value","value"]);
  }

  set TalentDefense(value: number) {
    this.setPath(["value","RawData","value","object","SaveParameter","value","Talent_Defense","value","value"], value);
  }

  get PassiveSkillList(): string[] {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","PassiveSkillList","value","values"]);
    }

  get OldOwnerPlayerUIds(): string[] {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","OldOwnerPlayerUIds","value","values"]);
    }

  get ContainerId(): string {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","SlotId","value","ContainerId","value","ID","value"]);
  }

  set ContainerId(value: string) {
    this.setPath(["value","RawData","value","object","SaveParameter","value","SlotId","value","ContainerId","value","ID","value"], value);
  }

  get SlotIndex(): number {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","SlotId","value","SlotIndex","value"]);
  }

  set SlotIndex(value: number) {
    this.setPath(["value","RawData","value","object","SaveParameter","value","SlotId","value","SlotIndex","value"], value);
  }

  get FriendshipPoint(): number {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","FriendshipPoint","value"]);
  }

  set FriendshipPoint(value: number) {
    this.setPath(["value","RawData","value","object","SaveParameter","value","FriendshipPoint","value"], value);
  }

  get FriendshipBasecampSec(): number {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","FriendshipBasecampSec","value"]);
  }

  set FriendshipBasecampSec(value: number) {
    this.setPath(["value","RawData","value","object","SaveParameter","value","FriendshipBasecampSec","value"], value);
  }

 get OwnedTime(): Date {
    return this.ticksToDate(this.getPath(["value","RawData","value","object","SaveParameter","value","OwnedTime","value"]));
  }

  set OwnedTime(value: Date) {
    this.setPath(["value","RawData","value","object","SaveParameter","value","OwnedTime","value"], this.dateToTicks(value));
  }

  get OwnerPlayerUId(): string {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","OwnerPlayerUId","value"]);
  }

  set OwnerPlayerUId(value: string) {
    this.setPath(["value","RawData","value","object","SaveParameter","value","OwnerPlayerUId","value"], value);
  }

  get Rank(): number {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","Rank","value","value"]);
  }

  set Rank(value: number) {
    this.setPath(["value","RawData","value","object","SaveParameter","value","Rank","value","value"], value);
  }
}

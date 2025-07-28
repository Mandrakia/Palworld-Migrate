import { JsonWrapper } from './JsonWrapper';
import { Player } from './Player';
import { Pal } from './Pal';
import { StatPoint } from './StatPoint';
export class Character extends JsonWrapper {
  constructor(node: any) {
    super(node);
  }

  get Nickname(): string {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","NickName","value"]);
  }

  set Nickname(value: string) {
    this.setPath(["value","RawData","value","object","SaveParameter","value","NickName","value"], value);
  }

  get FilteredNickname(): string {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","FilteredNickName","value"]);
  }

  set FilteredNickname(value: string) {
    this.setPath(["value","RawData","value","object","SaveParameter","value","FilteredNickName","value"], value);
  }

  get IsPlayer(): boolean {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","IsPlayer","value"]);
  }

  set IsPlayer(value: boolean) {
    this.setPath(["value","RawData","value","object","SaveParameter","value","IsPlayer","value"], value);
  }

  get PlayerId(): string {
    return this.getPath(["key","PlayerUId","value"]);
  }

  set PlayerId(value: string) {
    this.setPath(["key","PlayerUId","value"], value);
  }

  get InstanceId(): string {
    return this.getPath(["key","InstanceId","value"]);
  }

  set InstanceId(value: string) {
    this.setPath(["key","InstanceId","value"], value);
  }

  get Level(): number {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","Level","value","value"]);
  }

  set Level(value: number) {
    this.setPath(["value","RawData","value","object","SaveParameter","value","Level","value","value"], value);
  }

  get Exp(): number {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","Exp","value"]);
  }

  set Exp(value: number) {
    this.setPath(["value","RawData","value","object","SaveParameter","value","Exp","value"], value);
  }

  get Hp(): number {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","Hp","value","Value","value"]);
  }

  set Hp(value: number) {
    this.setPath(["value","RawData","value","object","SaveParameter","value","Hp","value","Value","value"], value);
  }

  get FullStomach(): number {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","FullStomach","value"]);
  }

  set FullStomach(value: number) {
    this.setPath(["value","RawData","value","object","SaveParameter","value","FullStomach","value"], value);
  }

  get Stats(): StatPoint[] {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","GotStatusPointList","value","values"])?.map((x: any) => new StatPoint(x)) ?? [];
  }

  get GroupId(): string {
    return this.getPath(["value","RawData","value","group_id"]);
  }

  set GroupId(value: string) {
    this.setPath(["value","RawData","value","group_id"], value);
  }

  get AddedStats(): StatPoint[] {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","GotExStatusPointList","value","values"])?.map((x: any) => new StatPoint(x)) ?? [];
  }
}

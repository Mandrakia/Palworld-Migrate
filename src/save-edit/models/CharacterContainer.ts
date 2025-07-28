import { JsonWrapper } from './JsonWrapper';
import { CharacterSlot } from './CharacterSlot';
export class CharacterContainer extends JsonWrapper {
  constructor(node: any) {
    super(node);
  }

  get Id(): string {
    return this.getPath(["key","ID","value"]);
  }

  set Id(value: string) {
    this.setPath(["key","ID","value"], value);
  }

  get SlotNum(): number {
    return this.getPath(["value","SlotNum","value"]);
  }

  set SlotNum(value: number) {
    this.setPath(["value","SlotNum","value"], value);
  }

  get Slots(): CharacterSlot[] {
    return this.getPath(["value","Slots","value","values"])?.map((x: any) => new CharacterSlot(x)) ?? [];
  }
}

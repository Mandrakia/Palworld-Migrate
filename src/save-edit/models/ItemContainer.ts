import { JsonWrapper } from './JsonWrapper';
import { Slot } from './Slot';
export class ItemContainer extends JsonWrapper {
  constructor(node: any) {
    super(node);
  }

  get Id(): string {
    return this.getPath(["key","ID","value"]);
  }

  set Id(value: string) {
    this.setPath(["key","ID","value"], value);
  }

  get BelongToGroup(): string {
    return this.getPath(["value","BelongInfo","value","GroupId","value"]);
  }

  set BelongToGroup(value: string) {
    this.setPath(["value","BelongInfo","value","GroupId","value"], value);
  }

  get ControllableByOthers(): boolean {
    return this.getPath(["value","BelongInfo","value","bControllableOthers","value"]);
  }

  set ControllableByOthers(value: boolean) {
    this.setPath(["value","BelongInfo","value","bControllableOthers","value"], value);
  }

  get SlotNum(): number {
    return this.getPath(["value","SlotNum","value"]);
  }

  set SlotNum(value: number) {
    this.setPath(["value","SlotNum","value"], value);
  }

  get Slots(): Slot[] {
    return this.getPath(["value","Slots","value","values"])?.map((x: any) => new Slot(x)) ?? [];
  }
}

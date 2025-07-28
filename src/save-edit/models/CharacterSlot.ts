import { JsonWrapper } from './JsonWrapper';
export class CharacterSlot extends JsonWrapper {
  constructor(node: any) {
    super(node);
  }

  get Index(): number {
    return this.getPath(["SlotIndex","value"]);
  }

  set Index(value: number) {
    this.setPath(["SlotIndex","value"], value);
  }

  get PlayerUId(): string {
    return this.getPath(["RawData","value","player_uid"]);
  }

  set PlayerUId(value: string) {
    this.setPath(["RawData","value","player_uid"], value);
  }

  get InstanceId(): string {
    return this.getPath(["RawData","value","instance_id"]);
  }

  set InstanceId(value: string) {
    this.setPath(["RawData","value","instance_id"], value);
  }
}

import { JsonWrapper } from './JsonWrapper';
export class Slot extends JsonWrapper {
  constructor(node: any) {
    super(node);
  }

  get Index(): number {
    return this.getPath(["RawData","value","slot_index"]);
  }

  set Index(value: number) {
    this.setPath(["RawData","value","slot_index"], value);
  }

  get Count(): number {
    return this.getPath(["RawData","value","count"]);
  }

  set Count(value: number) {
    this.setPath(["RawData","value","count"], value);
  }

  get ItemId(): string {
    return this.getPath(["RawData","value","item","static_id"]);
  }

  set ItemId(value: string) {
    this.setPath(["RawData","value","item","static_id"], value);
  }

  get DynamidId(): string {
    return this.getPath(["RawData","value","item","dynamic_id","local_id_in_created_world"]);
  }

  set DynamidId(value: string) {
    this.setPath(["RawData","value","item","dynamic_id","local_id_in_created_world"], value);
  }
}

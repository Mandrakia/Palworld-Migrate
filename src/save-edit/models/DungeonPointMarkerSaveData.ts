import { JsonWrapper } from './JsonWrapper';
export class DungeonPointMarkerSaveData extends JsonWrapper {
  constructor(node: any) {
    super(node);
  }

  get MarkerPointId(): string {
    return this.getPath(["MarkerPointId","value"]);
  }

  set MarkerPointId(value: string) {
    this.setPath(["MarkerPointId","value"], value);
  }

  get NextRespawnGameTime(): number {
    return this.getPath(["NextRespawnGameTime","value","Ticks","value"]);
  }

  set NextRespawnGameTime(value: number) {
    this.setPath(["NextRespawnGameTime","value","Ticks","value"], value);
  }
}

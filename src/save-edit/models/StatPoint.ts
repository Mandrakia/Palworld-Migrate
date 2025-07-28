import { JsonWrapper } from './JsonWrapper';
export class StatPoint extends JsonWrapper {
  constructor(node: any) {
    super(node);
  }

  get Name(): string {
    return this.getPath(["StatusName","value"]);
  }

  set Name(value: string) {
    this.setPath(["StatusName","value"], value);
  }

  get Value(): number {
    return this.getPath(["StatusPoint","value"]);
  }

  set Value(value: number) {
    this.setPath(["StatusPoint","value"], value);
  }
}

import { JsonWrapper } from './JsonWrapper';
export class Coords extends JsonWrapper {
  constructor(node: any) {
    super(node);
  }

  get x(): number {
    return this.getPath(["translation","x"]);
  }

  set x(value: number) {
    this.setPath(["translation","x"], value);
  }

  get y(): number {
    return this.getPath(["translation","y"]);
  }

  set y(value: number) {
    this.setPath(["translation","y"], value);
  }

  get z(): number {
    return this.getPath(["translation","z"]);
  }

  set z(value: number) {
    this.setPath(["translation","z"], value);
  }
}

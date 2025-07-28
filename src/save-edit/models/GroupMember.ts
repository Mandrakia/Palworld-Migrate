import { JsonWrapper } from './JsonWrapper';
export class GroupMember extends JsonWrapper {
  constructor(node: any) {
    super(node);
  }

  get PlayerId(): string {
    return this.getPath(["guid"]);
  }

  set PlayerId(value: string) {
    this.setPath(["guid"], value);
  }

  get InstanceId(): string {
    return this.getPath(["instance_id"]);
  }

  set InstanceId(value: string) {
    this.setPath(["instance_id"], value);
  }
}

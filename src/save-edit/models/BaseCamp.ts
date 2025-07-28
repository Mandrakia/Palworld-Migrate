import { JsonWrapper } from './JsonWrapper';
export class BaseCamp extends JsonWrapper {
  constructor(node: any) {
    super(node);
  }

  get Id(): string {
    return this.getPath(["key"]);
  }

  set Id(value: string) {
    this.setPath(["key"], value);
  }

  get ContainerId(): string {
    return this.getPath(["value","WorkerDirector","value","RawData","value","container_id"]);
  }

  set ContainerId(value: string) {
    this.setPath(["value","WorkerDirector","value","RawData","value","container_id"], value);
  }

  get GroupId(): string {
    return this.getPath(["value","RawData","value","group_id_belong_to"]);
  }

  set GroupId(value: string) {
    this.setPath(["value","RawData","value","group_id_belong_to"], value);
  }

  get OwnerInstanceId(): string {
    return this.getPath(["value","RawData","value","owner_map_object_instance_id"]);
  }

  set OwnerInstanceId(value: string) {
    this.setPath(["value","RawData","value","owner_map_object_instance_id"], value);
  }
}

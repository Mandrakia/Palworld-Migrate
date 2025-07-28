import { JsonWrapper } from './JsonWrapper';
import { Organization } from './Organization';
import { Guild } from './Guild';
import { GroupMember } from './GroupMember';
export class Group extends JsonWrapper {
  constructor(node: any) {
    super(node);
  }

  get Id(): string {
    return this.getPath(["key"]);
  }

  set Id(value: string) {
    this.setPath(["key"], value);
  }

  get Members(): GroupMember[] {
    return this.getPath(["value","RawData","value","individual_character_handle_ids"])?.map((x: any) => new GroupMember(x)) ?? [];
  }

  get Name(): string {
    return this.getPath(["value","RawData","value","group_name"]);
  }

  set Name(value: string) {
    this.setPath(["value","RawData","value","group_name"], value);
  }
}

import { Organization } from './Organization';
import { Guild } from './Guild';
import { Group } from './Group';

export class GroupFactory {
  static fromNode(node: any): Group {
    const value = node?.value?.RawData?.value?.group_type;
    switch (String(value)) {
      case "EPalGroupType::Organization": return new Organization(node);
      case "EPalGroupType::Guild": return new Guild(node);
      default: return new Group(node);
    }
  }
}

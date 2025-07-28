import { Group } from './Group';
import { GroupFactory } from './GroupFactory';
export class Guild extends Group {
  constructor(node: any) {
    super(node);
  }

  get BaseIds(): string[] {
    return this.getPath(["value","RawData","value","base_ids"]);
    }

  get MapBaseIds(): string[] {
    return this.getPath(["value","RawData","value","map_object_instance_ids_base_camp_points"]);
    }

  get CampLevel(): number {
    return this.getPath(["value","RawData","value","base_camp_level"]);
  }

  set CampLevel(value: number) {
    this.setPath(["value","RawData","value","base_camp_level"], value);
  }

  get GuildName(): string {
    return this.getPath(["value","RawData","value","guild_name"]);
  }

  set GuildName(value: string) {
    this.setPath(["value","RawData","value","guild_name"], value);
  }
}

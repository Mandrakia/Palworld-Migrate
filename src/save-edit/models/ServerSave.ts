import { JsonWrapper } from './JsonWrapper';
import { Character } from './Character';
import { CharacterFactory } from './CharacterFactory';
import { ItemContainer } from './ItemContainer';
import { CharacterContainer } from './CharacterContainer';
export class ServerSave extends JsonWrapper {
  constructor(node: any) {
    super(node);
  }

  get Characters(): Character[] {
    return this.getPath(["properties","worldSaveData","value","CharacterSaveParameterMap","value"])?.map((x: any) => CharacterFactory.fromNode(x)) ?? [];
  }

  get ItemContainers(): ItemContainer[] {
    return this.getPath(["properties","worldSaveData","value","ItemContainerSaveData","value"])?.map((x: any) => new ItemContainer(x)) ?? [];
  }

 get Timestamp(): Date {
    return this.ticksToDate(this.getPath(["properties","Timestamp","value"]));
  }

  set Timestamp(value: Date) {
    this.setPath(["properties","Timestamp","value"], this.dateToTicks(value));
  }

  get CharacterContainers(): CharacterContainer[] {
    return this.getPath(["properties","worldSaveData","value","CharacterContainerSaveData","value"])?.map((x: any) => new CharacterContainer(x)) ?? [];
  }
}

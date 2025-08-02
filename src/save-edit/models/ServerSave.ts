import { JsonWrapper } from './JsonWrapper';
import { Character } from './Character';
import { CharacterFactory } from './CharacterFactory';
import { ItemContainer } from './ItemContainer';
import { CharacterContainer } from './CharacterContainer';
import { Group } from './Group';
import { GroupFactory } from './GroupFactory';
import { BaseCamp } from './BaseCamp';
import { DungeonSaveData } from './DungeonSaveData';
import { DungeonPointMarkerSaveData } from './DungeonPointMarkerSaveData';
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

  get Groups(): Group[] {
    return this.getPath(["properties","worldSaveData","value","GroupSaveDataMap","value"])?.map((x: any) => GroupFactory.fromNode(x)) ?? [];
  }

  get BaseCamps(): BaseCamp[] {
    return this.getPath(["properties","worldSaveData","value","BaseCampSaveData","value"])?.map((x: any) => new BaseCamp(x)) ?? [];
  }

  get DungeonSaveData(): DungeonSaveData[] {
    return this.getPath(["properties","worldSaveData","value","DungeonSaveData","value","values"])?.map((x: any) => new DungeonSaveData(x)) ?? [];
  }

  get DungeonPointMarkerSaveData(): DungeonPointMarkerSaveData[] {
    return this.getPath(["properties","worldSaveData","value","DungeonPointMarkerSaveData","value","values"])?.map((x: any) => new DungeonPointMarkerSaveData(x)) ?? [];
  }
}

import { JsonWrapper } from './JsonWrapper';
import { CharacterItemContainers } from './CharacterItemContainers';
export class CharacterSave extends JsonWrapper {
  constructor(node: any) {
    super(node);
  }

  get PlayerUid(): string {
    return this.getPath(["properties","SaveData","value","PlayerUId","value"]);
  }

  set PlayerUid(value: string) {
    this.setPath(["properties","SaveData","value","PlayerUId","value"], value);
  }

  get PlayerUid2(): string {
    return this.getPath(["properties","SaveData","value","IndividualId","value","PlayerUId","value"]);
  }

  set PlayerUid2(value: string) {
    this.setPath(["properties","SaveData","value","IndividualId","value","PlayerUId","value"], value);
  }

  get InstanceId(): string {
    return this.getPath(["properties","SaveData","value","IndividualId","value","InstanceId","value"]);
  }

  set InstanceId(value: string) {
    this.setPath(["properties","SaveData","value","IndividualId","value","InstanceId","value"], value);
  }

  get CharacterPalsContainerId(): string {
    return this.getPath(["properties","SaveData","value","OtomoCharacterContainerId","value","ID","value"]);
  }

  set CharacterPalsContainerId(value: string) {
    this.setPath(["properties","SaveData","value","OtomoCharacterContainerId","value","ID","value"], value);
  }

  get ItemContainers(): CharacterItemContainers {
    return new CharacterItemContainers(this.getPath(["properties","SaveData","value","InventoryInfo","value"]));
  }

  get TechnologyPoints(): number {
    return this.getPath(["properties","SaveData","value","TechnologyPoint","value"]);
  }

  set TechnologyPoints(value: number) {
    this.setPath(["properties","SaveData","value","TechnologyPoint","value"], value);
  }

  get AncientTechnologyPoints(): number {
    return this.getPath(["properties","SaveData","value","bossTechnologyPoint","value"]);
  }

  set AncientTechnologyPoints(value: number) {
    this.setPath(["properties","SaveData","value","bossTechnologyPoint","value"], value);
  }

  get PalStorageContainerId(): string {
    return this.getPath(["properties","SaveData","value","PalStorageContainerId","value","ID","value"]);
  }

  set PalStorageContainerId(value: string) {
    this.setPath(["properties","SaveData","value","PalStorageContainerId","value","ID","value"], value);
  }
}

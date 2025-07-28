import { JsonWrapper } from './JsonWrapper';
export class CharacterItemContainers extends JsonWrapper {
  constructor(node: any) {
    super(node);
  }

  get CommonContainerId(): string {
    return this.getPath(["CommonContainerId","value","ID","value"]);
  }

  set CommonContainerId(value: string) {
    this.setPath(["CommonContainerId","value","ID","value"], value);
  }

  get DropSlotContainerId(): string {
    return this.getPath(["DropSlotContainerId","value","ID","value"]);
  }

  set DropSlotContainerId(value: string) {
    this.setPath(["DropSlotContainerId","value","ID","value"], value);
  }

  get EssentialContainerId(): string {
    return this.getPath(["EssentialContainerId","value","ID","value"]);
  }

  set EssentialContainerId(value: string) {
    this.setPath(["EssentialContainerId","value","ID","value"], value);
  }

  get WeaponLoadOutContainerId(): string {
    return this.getPath(["WeaponLoadOutContainerId","value","ID","value"]);
  }

  set WeaponLoadOutContainerId(value: string) {
    this.setPath(["WeaponLoadOutContainerId","value","ID","value"], value);
  }

  get PlayerEquipArmorContainerId(): string {
    return this.getPath(["PlayerEquipArmorContainerId","value","ID","value"]);
  }

  set PlayerEquipArmorContainerId(value: string) {
    this.setPath(["PlayerEquipArmorContainerId","value","ID","value"], value);
  }

  get FoodEquipContainerId(): string {
    return this.getPath(["FoodEquipContainerId","value","ID","value"]);
  }

  set FoodEquipContainerId(value: string) {
    this.setPath(["FoodEquipContainerId","value","ID","value"], value);
  }
}

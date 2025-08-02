import { JsonWrapper } from './JsonWrapper';
export class DungeonSaveData extends JsonWrapper {
  constructor(node: any) {
    super(node);
  }

  get InstanceId(): string {
    return this.getPath(["InstanceId","value"]);
  }

  set InstanceId(value: string) {
    this.setPath(["InstanceId","value"], value);
  }

  get MarkerPointId(): string {
    return this.getPath(["MarkerPointId","value"]);
  }

  set MarkerPointId(value: string) {
    this.setPath(["MarkerPointId","value"], value);
  }

  get DungeonSpawnAreaId(): string {
    return this.getPath(["DungeonSpawnAreaId","value"]);
  }

  set DungeonSpawnAreaId(value: string) {
    this.setPath(["DungeonSpawnAreaId","value"], value);
  }

  get DungeonLevelName(): string {
    return this.getPath(["DungeonLevelName","value"]);
  }

  set DungeonLevelName(value: string) {
    this.setPath(["DungeonLevelName","value"], value);
  }

  get BossState(): string {
    return this.getPath(["BossState","value","value"]);
  }

  set BossState(value: string) {
    this.setPath(["BossState","value","value"], value);
  }

  get EnemySpawnerDataBossRowName(): string {
    return this.getPath(["EnemySpawnerDataBossRowName","value"]);
  }

  set EnemySpawnerDataBossRowName(value: string) {
    this.setPath(["EnemySpawnerDataBossRowName","value"], value);
  }

  get DisappearTimeAt(): number {
    return this.getPath(["DisappearTimeAt","value","Ticks","value"]);
  }

  set DisappearTimeAt(value: number) {
    this.setPath(["DisappearTimeAt","value","Ticks","value"], value);
  }

  get RespawnBossTimeAt(): number {
    return this.getPath(["RespawnBossTimeAt","value","ticks","value"]);
  }

  set RespawnBossTimeAt(value: number) {
    this.setPath(["RespawnBossTimeAt","value","ticks","value"], value);
  }
}

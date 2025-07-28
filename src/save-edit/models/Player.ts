import { Character } from './Character';
import { CharacterFactory } from './CharacterFactory';
export class Player extends Character {
  constructor(node: any) {
    super(node);
  }

  get FoodRegenEffectTime(): number {
    return this.getPath(["value","RawData","value","object","SaveParameter","value","FoodRegeneEffectInfo","value","EffectTime","value"]);
  }

  set FoodRegenEffectTime(value: number) {
    this.setPath(["value","RawData","value","object","SaveParameter","value","FoodRegeneEffectInfo","value","EffectTime","value"], value);
  }
}

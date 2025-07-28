import { Player } from './Player';
import { Pal } from './Pal';
import { Character } from './Character';

export class CharacterFactory {
  static fromNode(node: any): Character {
    const value = node?.value?.RawData?.value?.object?.SaveParameter?.value?.IsPlayer?.value;
    switch (String(value)) {
      case "true": return new Player(node);
      default: return new Pal(node);
    }
  }
}

import { RECIPES, recipesForStation, recipeById } from '../data/recipes';
import type { StationType } from '../config';
import { useGame } from '../store';

export class RecipeSystem {
  unlocked(): string[] {
    const lvl = useGame.getState().level;
    return RECIPES.filter((r) => r.unlockLevel <= lvl).map((r) => r.id);
  }
  isUnlocked(id: string): boolean {
    const r = recipeById(id);
    return !!r && r.unlockLevel <= useGame.getState().level;
  }
  defaultFor(station: StationType): string {
    const lvl = useGame.getState().level;
    const list = recipesForStation(station).filter((r) => r.unlockLevel <= lvl);
    return (list[0] || recipesForStation(station)[0]).id;
  }
  syncUnlocked() {
    useGame.getState().patch({ recipesUnlocked: this.unlocked() });
  }
}

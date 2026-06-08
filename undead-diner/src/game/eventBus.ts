// Tiny typed event bus: React UI emits commands, GameScene listens (and vice-versa).
type Handler = (payload?: any) => void;

class EventBus {
  private map: Record<string, Handler[]> = {};
  on(evt: string, fn: Handler) { (this.map[evt] ||= []).push(fn); return () => this.off(evt, fn); }
  off(evt: string, fn: Handler) { this.map[evt] = (this.map[evt] || []).filter((f) => f !== fn); }
  emit(evt: string, payload?: any) { (this.map[evt] || []).forEach((f) => f(payload)); }
}

export const bus = new EventBus();

// Command names sent from UI -> scene
export type Command =
  | { type: 'build'; item: string }
  | { type: 'mode'; mode: string }
  | { type: 'infectMode' }
  | { type: 'editMode' }
  | { type: 'expand' }
  | { type: 'franchise' }
  | { type: 'raidStart'; nodeId: string; zombies: number }
  | { type: 'buyFlesh' }
  | { type: 'buyToxin' }
  | { type: 'setRecipe'; stoveId: number; recipeId: string }
  | { type: 'feedZombie'; id: number }
  | { type: 'toggleAuto' }
  | { type: 'togglePause' }
  | { type: 'toggleSound' }
  | { type: 'save' }
  | { type: 'reset' }
  | { type: 'cancelMode' };

import { create } from 'zustand';

export type Panel = null | 'shop' | 'recipes' | 'zombies' | 'goals' | 'map' | 'help' | 'menu';

export interface ZombieInfo {
  id: number; name: string; level: number;
  speed: number; cook: number; serve: number; energy: number; maxEnergy: number;
  state: string;
}

export interface HudState {
  cafeName: string;
  rating: number;        // 0..5
  level: number;
  xp: number;
  xpToNext: number;
  money: number;
  toxin: number;
  flesh: number;
  zombieCount: number;
  zombies: ZombieInfo[];
  recipesUnlocked: string[];
  auto: boolean;
  paused: boolean;
  sound: boolean;
  mode: string;          // 'none' | 'build' | 'raidPick'
  panel: Panel;
  toast: string | null;
  expansion: number;
  prestige: number;
  // tap-driven UI state
  selectedZombieId: number | null;
  stovePopup: number | null;     // station id whose recipe popup is open
  stovePopupType: string | null; // station type ('stove'|'grill'|'oven')
  customerPopup: number | null;  // customer id whose action popup is open
  customerOrder: string | null;  // that customer's order recipe id
  buildItem: string | null;      // item chosen in the build tray
  patch: (p: Partial<HudState>) => void;
  setPanel: (p: Panel) => void;
  setToast: (t: string | null) => void;
}

export const useGame = create<HudState>((set) => ({
  cafeName: 'Undead Diner',
  rating: 3,
  level: 1,
  xp: 0,
  xpToNext: 100,
  money: 700,
  toxin: 20,
  flesh: 5,
  zombieCount: 2,
  zombies: [],
  recipesUnlocked: ['coffin_coffee'],
  auto: true,
  paused: false,
  sound: true,
  mode: 'none',
  panel: null,
  toast: null,
  expansion: 0,
  prestige: 0,
  selectedZombieId: null,
  stovePopup: null,
  stovePopupType: null,
  customerPopup: null,
  customerOrder: null,
  buildItem: null,
  patch: (p) => set(p),
  setPanel: (p) => set({ panel: p }),
  setToast: (t) => set({ toast: t })
}));

// convenience for non-React code (the Phaser scene)
export const gameStore = useGame;
let toastTimer: any = null;
export function toast(msg: string) {
  useGame.getState().setToast(msg);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => useGame.getState().setToast(null), 2600);
}

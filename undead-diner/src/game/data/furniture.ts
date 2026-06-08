export type FurnKind = 'table' | 'chair' | 'station' | 'counter' | 'decor';

export interface ShopItem {
  id: string;
  name: string;
  kind: FurnKind;
  texture: string;      // BootScene texture key
  cost: number;
  unlockLevel: number;
  station?: 'stove' | 'grill' | 'oven';
  appeal?: number;
  desc: string;
}

export const SHOP: ShopItem[] = [
  { id: 'table',   name: 'Diner Table',  kind: 'table',   texture: 'table',   cost: 120, unlockLevel: 1, desc: 'Seats one hungry human.' },
  { id: 'counter', name: 'Serve Counter', kind: 'counter', texture: 'counter', cost: 160, unlockLevel: 1, desc: 'Where cooked food waits.' },
  { id: 'stove',   name: 'Stove',        kind: 'station',  texture: 'stove',   cost: 300, unlockLevel: 1, station: 'stove', desc: 'Cooks drinks & grits.' },
  { id: 'grill',   name: 'Grill',        kind: 'station',  texture: 'grill',   cost: 460, unlockLevel: 2, station: 'grill', desc: 'Cooks fries & burgers.' },
  { id: 'oven',    name: 'Oven',         kind: 'station',  texture: 'oven',    cost: 760, unlockLevel: 4, station: 'oven',  desc: 'Bakes pizza & cake.' },
  { id: 'plant',   name: 'Spore Plant',  kind: 'decor',    texture: 'plant',   cost: 90,  unlockLevel: 1, appeal: 6, desc: 'Raises appeal.' },
  { id: 'lamp',    name: 'Gore Lamp',    kind: 'decor',    texture: 'lamp',    cost: 150, unlockLevel: 2, appeal: 11, desc: 'Raises appeal.' }
];

export const shopById = (id: string) => SHOP.find((s) => s.id === id);

export const RAID_NODES = [
  { id: 'alley', name: "Backalley Bites",  difficulty: 1, minLevel: 1 },
  { id: 'docks', name: 'Dockside Diner',   difficulty: 2, minLevel: 3 },
  { id: 'mall',  name: 'Mallrat Cafe',     difficulty: 3, minLevel: 5 },
  { id: 'mansion', name: 'Manor Bistro',   difficulty: 4, minLevel: 8 }
];

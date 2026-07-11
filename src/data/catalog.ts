// Bridges the ported furniture catalog to the engine's ItemCatalog interface.
// The engine stays data-agnostic; this is the one place furniture.json becomes
// FootprintItems.

import type { FootprintItem, ItemCatalog } from '../engine/contracts';
import { FURNITURE } from './content';

const items = new Map<string, FootprintItem>(
  FURNITURE.map((f) => [
    f.furnitureId,
    {
      itemId: f.furnitureId,
      kind: f.typeLabel,
      w: f.size?.x ?? 1,
      h: f.size?.y ?? 1,
    },
  ]),
);

export const itemCatalog: ItemCatalog = (itemId) => items.get(itemId) ?? null;

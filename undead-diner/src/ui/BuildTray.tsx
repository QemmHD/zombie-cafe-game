import React from 'react';
import { useGame } from '../game/store';
import { bus } from '../game/eventBus';
import { SHOP } from '../game/data/furniture';

const ICON: Record<string, string> = {
  table: '🪑', counter: '🍽️', stove: '🍳', grill: '🔥', oven: '🥧', plant: '🌿', lamp: '💡'
};

export default function BuildTray() {
  const level = useGame((s) => s.level);
  const money = useGame((s) => s.money);
  const buildItem = useGame((s) => s.buildItem);
  return (
    <div className="tray">
      <div className="tray-scroll">
        {SHOP.map((it) => {
          const locked = it.unlockLevel > level;
          const poor = money < it.cost;
          return (
            <button key={it.id} disabled={locked}
              className={'trayitem' + (buildItem === it.id ? ' on' : '') + (locked ? ' locked' : '')}
              onClick={() => bus.emit('command', { type: 'buildItem', item: it.id })}>
              <span className="ti-icon">{ICON[it.id] || '📦'}</span>
              <span className="ti-name">{it.name}</span>
              <span className={'ti-cost' + (poor ? ' poor' : '')}>{locked ? `🔒${it.unlockLevel}` : `🪙${it.cost}`}</span>
            </button>
          );
        })}
      </div>
      <button className="tray-done" onClick={() => bus.emit('command', { type: 'toggleBuild' })}>✓ Done</button>
    </div>
  );
}

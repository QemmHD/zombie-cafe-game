import React from 'react';
import { useGame } from '../game/store';
import { bus } from '../game/eventBus';

export default function SideButtons() {
  const panel = useGame((s) => s.panel);
  const setPanel = useGame((s) => s.setPanel);
  const items: [string, string, any][] = [
    ['🛒', 'Shop', 'shop'],
    ['📖', 'Recipes', 'recipes'],
    ['🧟', 'Staff', 'zombies'],
    ['🗺️', 'Map', 'map'],
    ['🎯', 'Goals', 'goals']
  ];
  return (
    <div className="leftcol">
      {items.map(([icon, label, key]) => (
        <button key={key} className={'sidebtn' + (panel === key ? ' on' : '')}
          onClick={() => (key === 'shop' ? bus.emit('command', { type: 'toggleBuild' }) : setPanel(panel === key ? null : key))}>
          <span>{icon}</span><small>{label}</small>
        </button>
      ))}
    </div>
  );
}

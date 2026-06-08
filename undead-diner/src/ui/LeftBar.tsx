import React from 'react';
import { useGame } from '../game/store';

export default function LeftBar() {
  const panel = useGame((s) => s.panel);
  const setPanel = useGame((s) => s.setPanel);
  const items: [string, string, any][] = [
    ['🛒', 'Shop', 'shop'],
    ['🗺️', 'Map', 'map'],
    ['📖', 'Recipes', 'recipes'],
    ['🧟', 'Staff', 'zombies'],
    ['🎯', 'Goals', 'goals']
  ];
  return (
    <div className="leftbar">
      {items.map(([icon, label, key]) => (
        <button key={key} className={'round-btn' + (panel === key ? ' on' : '')}
          onClick={() => setPanel(panel === key ? null : key)}>
          <span>{icon}</span><small>{label}</small>
        </button>
      ))}
    </div>
  );
}

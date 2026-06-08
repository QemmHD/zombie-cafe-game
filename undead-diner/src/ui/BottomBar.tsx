import React from 'react';
import { useGame } from '../game/store';
import { bus } from '../game/eventBus';

export default function BottomBar() {
  const s = useGame();
  const cmd = (c: any) => bus.emit('command', c);
  return (
    <div className="bottombar">
      <button className={'bigbtn' + (s.mode === 'build' ? ' on' : '')} onClick={() => cmd({ type: 'toggleBuild' })}>
        <span className="e">🛠️</span>{s.mode === 'build' ? 'Done' : 'Build'}
      </button>
      <button className={'bigbtn ' + (s.auto ? 'green' : '')} onClick={() => cmd({ type: 'toggleAuto' })}>
        <span className="e">🤖</span>Auto {s.auto ? 'On' : 'Off'}
      </button>
      <button className="bigbtn alt" onClick={() => s.setPanel('map')}>
        <span className="e">⚔️</span>Raid
      </button>
      <button className="bigbtn" onClick={() => s.setPanel('menu')}>
        <span className="e">☰</span>Menu
      </button>
    </div>
  );
}

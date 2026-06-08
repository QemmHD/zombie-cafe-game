import React from 'react';
import { useGame } from '../game/store';
import { bus } from '../game/eventBus';

export default function ActionBar() {
  const s = useGame();
  const cmd = (c: any) => bus.emit('command', c);
  const build = (item: string) => cmd({ type: 'build', item });

  const isBuild = (item: string) => s.mode === 'build:' + item;

  return (
    <div className="actionbar">
      <button className={'act' + (isBuild('table') ? ' on' : '')} onClick={() => build('table')}><span className="e">🪑</span>Table</button>
      <button className={'act' + (isBuild('counter') ? ' on' : '')} onClick={() => build('counter')}><span className="e">🍽️</span>Counter</button>
      <button className={'act' + (isBuild('stove') ? ' on' : '')} onClick={() => build('stove')}><span className="e">🍳</span>Stove</button>
      <button className={'act' + (isBuild('grill') ? ' on' : '')} onClick={() => build('grill')}><span className="e">🔥</span>Grill</button>
      <button className={'act' + (isBuild('oven') ? ' on' : '')} onClick={() => build('oven')}><span className="e">🥧</span>Oven</button>
      <button className={'act ' + (s.auto ? 'on' : '')} onClick={() => cmd({ type: 'toggleAuto' })}><span className="e">🤖</span>{s.auto ? 'Auto' : 'Manual'}</button>
      <button className={'act alt' + (s.mode === 'infect' ? ' on' : '')} onClick={() => cmd({ type: 'infectMode' })}><span className="e">🧪</span>Infect</button>
      <button className="act" onClick={() => s.setPanel('zombies')}><span className="e">🧟</span>Staff</button>
      <button className={'act' + (s.mode === 'edit' ? ' on' : '')} onClick={() => cmd({ type: 'editMode' })}><span className="e">✋</span>Edit</button>
      <button className="act" onClick={() => s.setPanel('shop')}><span className="e">🎨</span>Style</button>
      <button className="act" onClick={() => cmd({ type: 'expand' })}><span className="e">🧱</span>Expand</button>
      <button className="act alt" onClick={() => cmd({ type: 'franchise' })}><span className="e">🏛️</span>Franchise</button>
      <button className="act" onClick={() => s.setPanel('goals')}><span className="e">🎯</span>Goals</button>
      <button className="act alt" onClick={() => s.setPanel('map')}><span className="e">⚔️</span>Raid</button>
      <button className="act" onClick={() => cmd({ type: 'buyFlesh' })}><span className="e">🥩</span>Flesh</button>
      <button className="act" onClick={() => cmd({ type: 'togglePause' })}><span className="e">{s.paused ? '▶️' : '⏸️'}</span>{s.paused ? 'Resume' : 'Pause'}</button>
      <button className="act" onClick={() => cmd({ type: 'toggleSound' })}><span className="e">{s.sound ? '🔊' : '🔇'}</span>Sound</button>
      <button className="act" onClick={() => cmd({ type: 'save' })}><span className="e">💾</span>Save</button>
      <button className="act" onClick={() => s.setPanel('help')}><span className="e">❓</span>Help</button>
      <button className="act red" onClick={() => cmd({ type: 'reset' })}><span className="e">🗑️</span>Reset</button>
    </div>
  );
}

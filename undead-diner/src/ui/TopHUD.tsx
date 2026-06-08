import React from 'react';
import { useGame } from '../game/store';
import { bus } from '../game/eventBus';

function Stars({ value }: { value: number }) {
  const n = Math.round(value);
  return <div className="stars">{[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= n ? '' : 'off'}>★</span>)}</div>;
}

export default function TopHUD() {
  const s = useGame();
  return (
    <div className="hud">
      <div className="cafe-badge">
        <div className="cafe-name">{s.cafeName}</div>
        <Stars value={s.rating} />
      </div>
      <div className="lvl">
        <div className="lv-coin">{s.level}</div>
        <div className="xp-wrap">
          <div className="xp-bar"><div className="xp-fill" style={{ width: `${Math.min(100, (s.xp / s.xpToNext) * 100)}%` }} /></div>
        </div>
      </div>
      <div className="chips">
        <div className="chip"><span>🪙</span>{Math.floor(s.money)}</div>
        <div className="chip"><span>🧪</span>{s.toxin}<button className="add" onClick={() => bus.emit('command', { type: 'buyToxin' })}>+</button></div>
        <div className="chip"><span>🥩</span>{s.flesh}<button className="add" onClick={() => bus.emit('command', { type: 'buyFlesh' })}>+</button></div>
        <div className="chip"><span>🧟</span>{s.zombieCount}</div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useGame } from '../game/store';
import { bus } from '../game/eventBus';
import { RAID_NODES } from '../game/data/furniture';
import { RECIPES } from '../game/data/recipes';

export default function Panels() {
  const panel = useGame((s) => s.panel);
  const setPanel = useGame((s) => s.setPanel);
  if (!panel) return null;
  return (
    <div className="scrim" onClick={() => setPanel(null)}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        {panel === 'recipes' && <Recipes />}
        {panel === 'zombies' && <Staff />}
        {panel === 'goals' && <Goals />}
        {panel === 'map' && <MapRaid />}
        {panel === 'menu' && <Menu />}
        {panel === 'help' && <Help />}
        <button className="pill-btn gray close" onClick={() => setPanel(null)}>Close</button>
      </div>
    </div>
  );
}

function Recipes() {
  const level = useGame((s) => s.level);
  return (
    <>
      <h2>📖 Recipes</h2>
      <p className="muted">Tap a station in the diner to choose what it cooks.</p>
      {RECIPES.map((r) => {
        const locked = r.unlockLevel > level;
        return (
          <div className="row" key={r.id} style={{ opacity: locked ? 0.55 : 1 }}>
            <div style={{ fontSize: 22 }}>{r.emoji}</div>
            <div className="grow"><b>{r.name}</b><small>{r.station} · {r.servings}× · 🪙{r.price} · {r.xp}xp · {r.cookTime}s</small></div>
            {locked ? <span className="muted">🔒 Lv {r.unlockLevel}</span> : <span className="muted">✓</span>}
          </div>
        );
      })}
    </>
  );
}

function Staff() {
  const zombies = useGame((s) => s.zombies);
  return (
    <>
      <h2>🧟 Staff</h2>
      {zombies.length === 0 && <p className="muted">No zombies — infect a customer or raid a rival.</p>}
      {zombies.map((z) => (
        <div className="row" key={z.id}>
          <div className="grow">
            <b>{z.name} · Lv {z.level}</b>
            <small>spd {z.speed} · cook {z.cook} · serve {z.serve} · {z.state}</small>
            <div className="xp-bar" style={{ marginTop: 4 }}>
              <div className="xp-fill" style={{ width: `${(z.energy / z.maxEnergy) * 100}%`, background: z.energy / z.maxEnergy > 0.3 ? 'linear-gradient(90deg,#9be86a,#6cbf3f)' : 'linear-gradient(90deg,#ff9b7a,#e7553b)' }} />
            </div>
          </div>
          <button className="pill-btn" onClick={() => bus.emit('command', { type: 'feedZombie', id: z.id })}>🥩 Feed</button>
        </div>
      ))}
    </>
  );
}

function Goals() {
  const s = useGame();
  const goals = [
    { name: 'Reach level 3', done: s.level >= 3 },
    { name: 'Raise 4 zombies', done: s.zombieCount >= 4 },
    { name: 'Bank 2,000 money', done: s.money >= 2000 },
    { name: 'Keep a 4★ rating', done: s.rating >= 4 }
  ];
  return (
    <>
      <h2>🎯 Goals</h2>
      {goals.map((g, i) => <div className="row" key={i}><div className="grow"><b>{g.done ? '✅ ' : '⬜ '}{g.name}</b></div></div>)}
    </>
  );
}

function MapRaid() {
  const s = useGame();
  const [count, setCount] = useState(2);
  const [result, setResult] = useState<any>(null);
  const avail = s.zombies.filter((z) => z.energy > 5 && (z.state === 'idle' || z.state === 'rest')).length;
  useEffect(() => bus.on('raidResult', (r: any) => setResult(r)), []);
  return (
    <>
      <h2>⚔️ Raid Map</h2>
      <p className="muted">Send {Math.min(count, avail)} of {avail} rested zombies.</p>
      <div className="row">
        <div className="grow"><b>Squad size</b></div>
        <button className="pill-btn gray" onClick={() => setCount(Math.max(1, count - 1))}>−</button>
        <b style={{ width: 18, textAlign: 'center' }}>{count}</b>
        <button className="pill-btn gray" onClick={() => setCount(count + 1)}>+</button>
      </div>
      {RAID_NODES.map((n) => {
        const locked = s.level < n.minLevel;
        return (
          <div className="row" key={n.id}>
            <div className="grow"><b>{n.name}</b><small>Difficulty {'💀'.repeat(n.difficulty)}</small></div>
            {locked ? <span className="muted">🔒 Lv {n.minLevel}</span>
              : <button className="pill-btn gold" onClick={() => bus.emit('command', { type: 'raidStart', nodeId: n.id, zombies: count })}>Raid</button>}
          </div>
        );
      })}
      {result && (
        <div className="row" style={{ background: result.victory ? '#e7ffe0' : '#fff0e0' }}>
          <div className="grow"><b>{result.victory ? '🏆 Victory at ' : '💀 Repelled at '}{result.node}</b>
            <small>Sent {result.sent} · 🪙{result.money} · 🥩{result.flesh} · 🧪{result.toxin}{result.recipe ? ' · stole ' + result.recipe : ''}</small></div>
        </div>
      )}
    </>
  );
}

function Menu() {
  const s = useGame();
  const cmd = (c: any) => bus.emit('command', c);
  return (
    <>
      <h2>☰ Menu</h2>
      <div className="row"><div className="grow"><b>Pause</b></div><button className="pill-btn" onClick={() => cmd({ type: 'togglePause' })}>{s.paused ? '▶ Resume' : '⏸ Pause'}</button></div>
      <div className="row"><div className="grow"><b>Sound</b></div><button className="pill-btn" onClick={() => cmd({ type: 'toggleSound' })}>{s.sound ? '🔊 On' : '🔇 Off'}</button></div>
      <div className="row"><div className="grow"><b>Expand diner</b></div><button className="pill-btn gold" onClick={() => cmd({ type: 'expand' })}>🧱 Expand</button></div>
      <div className="row"><div className="grow"><b>Franchise (Lv 10)</b></div><button className="pill-btn" onClick={() => cmd({ type: 'franchise' })}>🏛️</button></div>
      <div className="row"><div className="grow"><b>Save game</b></div><button className="pill-btn" onClick={() => cmd({ type: 'save' })}>💾 Save</button></div>
      <div className="row"><div className="grow"><b>How to play</b></div><button className="pill-btn" onClick={() => s.setPanel('help')}>❓ Help</button></div>
      <div className="row"><div className="grow"><b>Reset</b></div><button className="pill-btn" onClick={() => cmd({ type: 'reset' })} style={{ background: 'linear-gradient(180deg,#ff9b7a,#e7553b)', borderColor: '#8a2a18', boxShadow: '0 3px 0 #6a1f12', color: '#fff' }}>🗑 Reset</button></div>
    </>
  );
}

function Help() {
  return (
    <>
      <h2>❓ How to play</h2>
      <p style={{ lineHeight: 1.5, fontSize: 14 }}>
        <b>Tap a zombie</b> to select it (gold ring). Then tap the <b>café</b> to command it:
        a <b>stove</b> to cook (pick a recipe), a <b>customer</b> to serve, a <b>dirty table</b> to clean,
        or the <b>floor</b> to walk. Tap the <b>door</b> to send it to rest.<br /><br />
        Tap a <b>customer</b> (no zombie selected) to <b>Infect</b> them into a new zombie.
        When Auto is OFF, tap the <b>coins</b> on a table to collect them. Turn <b>Auto</b> on to let
        zombies work by themselves. Use <b>Build</b> to place tables/stoves; <b>Raid</b> rivals for loot.
      </p>
    </>
  );
}

import React, { useEffect, useState } from 'react';
import { useGame } from '../game/store';
import { bus } from '../game/eventBus';
import { SHOP, RAID_NODES } from '../game/data/furniture';
import { RECIPES } from '../game/data/recipes';

export default function Panels() {
  const panel = useGame((s) => s.panel);
  const setPanel = useGame((s) => s.setPanel);
  if (!panel) return null;
  return (
    <div className="scrim" onClick={() => setPanel(null)}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        {panel === 'shop' && <Shop />}
        {panel === 'recipes' && <Recipes />}
        {panel === 'zombies' && <Staff />}
        {panel === 'goals' && <Goals />}
        {panel === 'map' && <MapRaid />}
        {panel === 'help' && <Help />}
        <button className="pill-btn gray close" onClick={() => setPanel(null)}>Close</button>
      </div>
    </div>
  );
}

function Shop() {
  const level = useGame((s) => s.level);
  const money = useGame((s) => s.money);
  const setPanel = useGame((s) => s.setPanel);
  return (
    <>
      <h2>🛒 Build Shop</h2>
      {SHOP.map((it) => {
        const locked = it.unlockLevel > level;
        const poor = money < it.cost;
        return (
          <div className="row" key={it.id}>
            <div className="grow"><b>{it.name}</b><small>{it.desc}</small></div>
            {locked
              ? <span className="muted">🔒 Lv {it.unlockLevel}</span>
              : <button className={'pill-btn' + (poor ? ' gray' : '')} onClick={() => { bus.emit('command', { type: 'build', item: it.id }); setPanel(null); }}>🪙 {it.cost}</button>}
          </div>
        );
      })}
      <p className="muted">Pick an item, then tap a floor tile to place it.</p>
    </>
  );
}

function Recipes() {
  const level = useGame((s) => s.level);
  return (
    <>
      <h2>📖 Recipes</h2>
      <p className="muted">Tap a station in the diner to switch what it cooks.</p>
      {RECIPES.map((r) => {
        const locked = r.unlockLevel > level;
        return (
          <div className="row" key={r.id} style={{ opacity: locked ? 0.55 : 1 }}>
            <div style={{ fontSize: 22 }}>{r.emoji}</div>
            <div className="grow"><b>{r.name}</b><small>{r.station} · {r.servings} servings · 🪙{r.price} · {r.xp}xp · {r.cookTime}s</small></div>
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
      <h2>🧟 Your Staff</h2>
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
    { name: 'Own 5 tables (build more!)', done: false },
    { name: 'Raise 4 zombies', done: s.zombieCount >= 4 },
    { name: 'Bank 2,000 money', done: s.money >= 2000 },
    { name: 'Keep a 4★ rating', done: s.rating >= 4 }
  ];
  return (
    <>
      <h2>🎯 Goals</h2>
      {goals.map((g, i) => (
        <div className="row" key={i}><div className="grow"><b>{g.done ? '✅ ' : '⬜ '}{g.name}</b></div></div>
      ))}
      <p className="muted">Hit milestones to grow your undead empire.</p>
    </>
  );
}

function MapRaid() {
  const s = useGame();
  const [count, setCount] = useState(2);
  const [result, setResult] = useState<any>(null);
  const avail = s.zombies.filter((z) => z.energy > 5 && (z.state === 'idle' || z.state === 'rest')).length;

  useEffect(() => {
    const off = bus.on('raidResult', (res: any) => setResult(res));
    return off;
  }, []);

  return (
    <>
      <h2>⚔️ Raid Map</h2>
      <p className="muted">Send {Math.min(count, avail)} of {avail} rested zombies. They lose energy.</p>
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
          <div className="grow">
            <b>{result.victory ? '🏆 Victory at ' : '💀 Repelled at '}{result.node}</b>
            <small>Sent {result.sent} · 🪙{result.money} · 🥩{result.flesh} · 🧪{result.toxin}{result.recipe ? ' · stole ' + result.recipe : ''}</small>
          </div>
        </div>
      )}
    </>
  );
}

function Help() {
  return (
    <>
      <h2>❓ How to play</h2>
      <p style={{ lineHeight: 1.5, fontSize: 14 }}>
        Run an undead diner! <b>Zombies</b> cook at stations, carry food to the <b>counter</b>, serve seated
        <b> customers</b>, and clean dirty tables — automatically (toggle <b>Auto</b> off to micromanage).<br /><br />
        Tap a <b>station</b> to change its recipe. Build <b>Tables / Counters / Stoves / Grills / Ovens</b> from the
        bottom bar, then tap a floor tile to place. <b>🧪 Infect</b> a customer to gain a zombie. <b>⚔️ Raid</b> rivals for
        loot. Keep customers fed and tables clean or your <b>★ rating</b> drops. <b>🧱 Expand</b> for more room and
        <b> 🏛️ Franchise</b> at level 10 for a fresh start with prestige.
      </p>
    </>
  );
}

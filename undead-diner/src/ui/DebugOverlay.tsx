import React from 'react';
import { useGame } from '../game/store';

/** Live readout for the selected zombie: state, command, target, animation key.
 *  Shows the state machine driving the visible gameplay. */
export default function DebugOverlay() {
  const d = useGame((s) => s.debug);
  if (!d) return null;
  return (
    <div className="dbg">
      <div className="dbg-h">🧟 {d.name} <span>(debug)</span></div>
      <div><b>state</b> {d.state}</div>
      <div><b>command</b> {d.cmd}</div>
      <div><b>target</b> {d.target}</div>
      <div><b>anim</b> {d.anim}</div>
      <div><b>energy</b> {d.energy}{d.carry ? '  · carrying ' + d.carry : ''}</div>
    </div>
  );
}

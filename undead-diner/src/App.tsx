import React, { useEffect, useRef } from 'react';
import { createGame } from './game/PhaserGame';
import { useGame } from './game/store';
import TopHUD from './ui/TopHUD';
import LeftBar from './ui/LeftBar';
import ActionBar from './ui/ActionBar';
import Panels from './ui/Panels';

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);
  const toastMsg = useGame((s) => s.toast);
  const mode = useGame((s) => s.mode);

  useEffect(() => {
    if (hostRef.current && !gameRef.current) {
      gameRef.current = createGame(hostRef.current);
    }
    return () => { /* keep game alive across HMR */ };
  }, []);

  const hint =
    mode.startsWith('build:') ? `Building ${mode.split(':')[1]} — tap a floor tile` :
    mode === 'infect' ? 'Infect mode — tap a seated customer' :
    mode === 'edit' ? 'Edit mode — tap furniture to move it' : null;

  return (
    <>
      <div id="game-root" ref={hostRef} />
      <div className="ui-layer">
        <TopHUD />
        <LeftBar />
        <ActionBar />
        <Panels />
        {hint && <div className="mode-hint">{hint}</div>}
        {toastMsg && <div className="toast">{toastMsg}</div>}
      </div>
    </>
  );
}

import React, { useEffect, useRef } from 'react';
import { createGame } from './game/PhaserGame';
import { useGame } from './game/store';
import TopHUD from './ui/TopHUD';
import SideButtons from './ui/SideButtons';
import BottomBar from './ui/BottomBar';
import BuildTray from './ui/BuildTray';
import { RecipePopup, CustomerPopup } from './ui/Popups';
import Panels from './ui/Panels';

export default function App() {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<any>(null);
  const toast = useGame((s) => s.toast);
  const mode = useGame((s) => s.mode);
  const selected = useGame((s) => s.selectedZombieId);

  useEffect(() => {
    if (hostRef.current && !gameRef.current) gameRef.current = createGame(hostRef.current);
  }, []);

  const hint = mode === 'build'
    ? 'BUILD MODE — pick an item, tap a tile to place (tap a piece to sell)'
    : selected
      ? 'Tap a stove to cook, a customer to serve, a dirty table to clean, or the floor to move'
      : 'Tap a zombie to select it';

  return (
    <>
      <div id="game-root" ref={hostRef} />
      <div className="ui-layer">
        <TopHUD />
        {mode !== 'build' && <SideButtons />}
        <div className="mode-hint">{hint}</div>
        <BottomBar />
        {mode === 'build' && <BuildTray />}
        <RecipePopup />
        <CustomerPopup />
        <Panels />
        {toast && <div className="toast">{toast}</div>}
      </div>
    </>
  );
}

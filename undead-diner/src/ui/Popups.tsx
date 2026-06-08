import React from 'react';
import { useGame } from '../game/store';
import { bus } from '../game/eventBus';
import { recipesForStation, recipeById } from '../game/data/recipes';
import { CFG } from '../game/config';

export function RecipePopup() {
  const stationId = useGame((s) => s.stovePopup);
  const type = useGame((s) => s.stovePopupType);
  const level = useGame((s) => s.level);
  const money = useGame((s) => s.money);
  if (!stationId || !type) return null;
  const list = recipesForStation(type as any);
  return (
    <div className="worldpop" onClick={() => useGame.getState().patch({ stovePopup: null })}>
      <div className="wp-card" onClick={(e) => e.stopPropagation()}>
        <h3>Cook on {type}</h3>
        {list.map((r) => {
          const locked = r.unlockLevel > level;
          const poor = money < r.cost;
          return (
            <button key={r.id} className={'wp-row' + (locked ? ' locked' : '')} disabled={locked}
              onClick={() => bus.emit('command', { type: 'chooseRecipe', stationId, recipeId: r.id })}>
              <span className="wp-emoji">{r.emoji}</span>
              <span className="wp-info"><b>{r.name}</b><small>🪙{r.cost} → {r.servings}× · sells 🪙{r.price} · {r.cookTime}s</small></span>
              {locked ? <span className="wp-lock">🔒{r.unlockLevel}</span> : <span className={'wp-go' + (poor ? ' poor' : '')}>Cook</span>}
            </button>
          );
        })}
        <small className="wp-tip">Select a zombie first to send it now; otherwise Auto cooks it.</small>
      </div>
    </div>
  );
}

export function CustomerPopup() {
  const id = useGame((s) => s.customerPopup);
  const order = useGame((s) => s.customerOrder);
  if (!id) return null;
  const rec = order ? recipeById(order) : null;
  return (
    <div className="worldpop" onClick={() => useGame.getState().patch({ customerPopup: null })}>
      <div className="wp-card" onClick={(e) => e.stopPropagation()}>
        <h3>Customer</h3>
        <div className="wp-row">
          <span className="wp-emoji">{rec ? rec.emoji : '🍴'}</span>
          <span className="wp-info"><b>Wants {rec ? rec.name : 'food'}</b><small>Serve them, or turn them!</small></span>
        </div>
        <button className="wp-infect" onClick={() => bus.emit('command', { type: 'infect', id })}>
          🧪 Infect ({CFG.infectCost} toxin)
        </button>
        <button className="wp-close" onClick={() => useGame.getState().patch({ customerPopup: null })}>Close</button>
      </div>
    </div>
  );
}

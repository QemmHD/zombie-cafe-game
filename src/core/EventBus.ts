import Phaser from 'phaser';

// Lightweight global event bus — the web analogue of the Unity project's
// Core/EventBus.cs. Systems publish/subscribe instead of holding hard refs.
export type GameEvent =
  | 'coins-changed'
  | 'toxin-changed'
  | 'zombie-added'
  | 'dish-collected'
  | 'customer-served'
  | 'customer-infected'
  | 'cafe-level-up'
  | 'notify'
  | 'offline-earnings';

class Bus extends Phaser.Events.EventEmitter {
  publish(event: GameEvent, ...args: unknown[]): void {
    this.emit(event, ...args);
  }
  subscribe(event: GameEvent, fn: (...args: any[]) => void, ctx?: unknown): () => void {
    this.on(event, fn, ctx);
    return () => this.off(event, fn, ctx);
  }
}

export const EventBus = new Bus();

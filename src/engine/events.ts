// Tiny typed event emitter (spec 01 §3.3) — dependency-free so the engine
// never imports Phaser's EventEmitter. Handlers run synchronously in
// subscription order; a handler throwing does not stop the others.

export class Emitter<Events extends Record<string, unknown>> {
  private handlers = new Map<keyof Events, Array<(payload: never) => void>>();

  on<K extends keyof Events>(event: K, fn: (payload: Events[K]) => void): () => void {
    const list = this.handlers.get(event) ?? [];
    list.push(fn as (payload: never) => void);
    this.handlers.set(event, list);
    return () => this.off(event, fn);
  }

  off<K extends keyof Events>(event: K, fn: (payload: Events[K]) => void): void {
    const list = this.handlers.get(event);
    if (!list) return;
    const i = list.indexOf(fn as (payload: never) => void);
    if (i >= 0) list.splice(i, 1);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const list = this.handlers.get(event);
    if (!list) return;
    for (const fn of [...list]) {
      try {
        (fn as (p: Events[K]) => void)(payload);
      } catch (err) {
        // Engine ships no logger; surface loudly in dev without killing the frame.
        console.error('[engine] event handler threw', event, err);
      }
    }
  }
}

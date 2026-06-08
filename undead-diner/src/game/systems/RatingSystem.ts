import { useGame } from '../store';
import { CFG } from '../config';

export class RatingSystem {
  get value() { return useGame.getState().rating; }
  set(v: number) { useGame.getState().patch({ rating: Math.max(CFG.ratingMin, Math.min(CFG.ratingMax, v)) }); }
  drop(n: number) { this.set(this.value - n); }
  gain(n: number) { this.set(this.value + n); }
  stars(): number { return Math.round(this.value); }
}

// Tiny animation helper (no dependency) used for camera flights and cut-height changes.

export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class Tweens {
  constructor() {
    this.list = [];
  }

  /**
   * Animate from → to (arrays of numbers). onUpdate(values, t) is called every frame.
   * A tween with the same `key` replaces the previous one.
   */
  add({ key, from, to, duration = 1, ease = easeInOut, onUpdate, onComplete }) {
    if (key) this.list = this.list.filter((t) => t.key !== key);
    const tw = { key, from: [...from], to: [...to], duration: Math.max(0.001, duration), t: 0, start: null, ease, onUpdate, onComplete };
    this.list.push(tw);
    return tw;
  }

  cancel(key) {
    this.list = this.list.filter((t) => t.key !== key);
  }

  get active() {
    return this.list.length > 0;
  }

  /** Advances by wall-clock time so animations keep their duration even at low frame rates. */
  update(now = performance.now() / 1000) {
    if (!this.list.length) return false;
    const done = [];
    for (const tw of this.list) {
      if (tw.start === null) tw.start = now;
      tw.t = Math.min(1, (now - tw.start) / tw.duration);
      const k = tw.ease(tw.t);
      const v = tw.from.map((f, i) => f + (tw.to[i] - f) * k);
      tw.onUpdate?.(v, tw.t);
      if (tw.t >= 1) done.push(tw);
    }
    if (done.length) {
      this.list = this.list.filter((t) => !done.includes(t));
      for (const tw of done) tw.onComplete?.();
    }
    return true;
  }
}

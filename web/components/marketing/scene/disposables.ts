/** Anything three.js lets us free: geometries, materials, textures, render targets. */
export interface Disposable {
  dispose(): void;
}

/**
 * Collects every GPU-backed object the scene creates so teardown is one call
 * and nothing can be forgotten. Wrap each constructor: `bin.track(new X())`.
 */
export class DisposeBin {
  private items: Disposable[] = [];

  track<T extends Disposable>(item: T): T {
    this.items.push(item);
    return item;
  }

  disposeAll(): void {
    for (const item of this.items.splice(0)) item.dispose();
  }
}

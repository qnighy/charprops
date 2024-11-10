export type AnyDisposable = Disposable | AsyncDisposable | ClassicDisposable;
export type ClassicDisposable = {
  dispose(): void | Promise<void>;
};

export type ResourceHandler<T> = T extends AnyDisposable ? {
  createResource: () => (Promise<T> | T);
  disposeResource?: ((resource: T) => (Promise<void> | void)) | undefined;
} : {
  createResource: () => (Promise<T> | T);
  disposeResource: (resource: T) => (Promise<void> | void);
};

export type PoolOptions<T> = {
  handler: ResourceHandler<T>;
  minCount: number;
  maxCount: number;
  scalingDurationMillis?: number;
}

export type ReleaseOptions = {
  broken?: boolean;
};

export class Pool<T> {
  #handler: ResourceHandler<T>;
  #minCount: number;
  #maxCount: number;
  #scalingDurationMillis: number;

  #freeResources: T[];
  #busyResources: Set<Borrow<T>>;
  #wakers: (() => void)[];
  #createCount: number;
  #resourcePlanner: ResourcePlanner;
  /**
   * Once dispose is initiated, resources should not be pushed back to #freeResources.
   * Also, it tries as best not to respond to any take requests, but this is not necessarily guaranteed.
   */
  #disposingOrDisposed: boolean;
  constructor(options: PoolOptions<T>) {
    const { handler, minCount, maxCount } = options;
    this.#handler = handler;
    this.#minCount = minCount;
    this.#maxCount = maxCount;
    this.#scalingDurationMillis = options.scalingDurationMillis ?? 60000;

    this.#freeResources = [];
    this.#busyResources = new Set();
    this.#wakers = [];
    this.#createCount = 0;
    this.#resourcePlanner = new ResourcePlanner();
    this.#disposingOrDisposed = false;
  }

  async take(): Promise<Borrow<T>> {
    const tookImmediate = this.tryTake();
    if (tookImmediate) {
      return tookImmediate;
    }
    while (true) {
      if (this.#resourceCreatable()) {
        return await this.#createAndTakeResource();
      }
      const took = await this.#waitAndTryTake();
      if (took) {
        return took;
      }
    }
  }

  tryTake(): Borrow<T> | undefined {
    this.#ensureActive();
    const freeResource = this.#freeResources.pop();
    if (freeResource) {
      const borrow = this.#wrapBorrow(freeResource);
      this.#busyResources.add(borrow);
      return borrow;
    }
  }

  #waitAndTryTake(): Promise<Borrow<T> | undefined> {
    return new Promise((resolve) => {
      this.#wakers.push(() => {
        // Ensure tryTake runs in the same microtask as the waker
        resolve(this.tryTake());
      });
    });
  }

  async #release(borrow: Borrow<T>, options: ReleaseOptions = {}): Promise<void> {
    const { broken = false } = options;
    if (!this.#busyResources.delete(borrow)) {
      throw new Error("This resource is not busy or not managed by this pool");
    }
    if (broken || this.#disposingOrDisposed || this.#resourceEnough()) {
      await this.#disposeResource(borrow.resource);
    } else {
      this.#freeResources.push(borrow.resource);
      this.#notifyOfFreeResources();
    }
  }

  #notifyOfFreeResources() {
    while (this.#freeResources.length > 0 && this.#wakers.length > 0) {
      const waker = this.#wakers.pop();
      if (waker) {
        waker();
      } else {
        break;
      }
    }
  }

  #resourceEnough(): boolean {
    return this.#freeResources.length + this.#busyResources.size >= this.#currentScale();
  }

  #resourceCreatable(): boolean {
    return this.#freeResources.length + this.#busyResources.size + this.#createCount < this.#maxCount;
  }

  async #createAndTakeResource(): Promise<Borrow<T>> {
    this.#ensureActive();
    this.#createCount++;
    try {
      const resource = await this.#handler.createResource();
      const borrow = this.#wrapBorrow(resource);
      this.#busyResources.add(borrow);
      this.#recordCurrentScale();
      return borrow;
    } finally {
      this.#createCount--;
    }
  }

  #recordCurrentScale(): void {
    const currentScale = this.#freeResources.length + this.#busyResources.size;
    if (currentScale > this.#minCount) {
      this.#resourcePlanner.addPlan(new Date(Date.now() + this.#scalingDurationMillis), currentScale);
    }
  }

  #currentScale(): number {
    this.#resourcePlanner.updateTime(new Date());
    return this.#resourcePlanner.currentCount ?? this.#minCount;
  }

  #ensureActive(): void {
    if (this.#disposingOrDisposed) {
      throw new Error("Cannot take a resource from a pool that is being disposed or has been disposed");
    }
  }

  #wrapBorrow(resource: T): Borrow<T> {
    const borrow = new Borrow(resource, async (borrow) => {
      await this.#release(borrow);
    });
    this.#busyResources.add(borrow);
    return borrow;
  }

  async #disposeResource(resource: T): Promise<void> {
    if (this.#handler.disposeResource) {
      await this.#handler.disposeResource(resource);
    } else if (Symbol.dispose && typeof (resource as Disposable)[Symbol.dispose] === "function") {
      (resource as Disposable)[Symbol.dispose]();
    } else if (Symbol.asyncDispose && typeof (resource as AsyncDisposable)[Symbol.asyncDispose] === "function") {
      await (resource as AsyncDisposable)[Symbol.asyncDispose]();
    } else if (typeof (resource as ClassicDisposable).dispose === "function") {
      await (resource as ClassicDisposable).dispose();
    } else {
      throw new Error("Unsure how to dispose of this resource");
    }
  }

  async dispose(): Promise<void> {
    if (this.#disposingOrDisposed) {
      throw new Error("Tried to dispose a pool twice");
    }
    this.#disposingOrDisposed = true;
    while (this.#freeResources.length > 0) {
      const resource = this.#freeResources.pop()!;
      await this.#disposeResource(resource);
    }
  }

  declare [Symbol.asyncDispose]: () => Promise<void>;
  static {
    if (Symbol.asyncDispose) {
      Pool.prototype[Symbol.asyncDispose] = Pool.prototype.dispose;
    }
  }
}

export class Borrow<T> {
  broken = false;
  #inner: T;
  #release: (borrow: Borrow<T>) => Promise<void>;
  #disposed = false;
  constructor(inner: T, release: (borrow: Borrow<T>) => Promise<void>) {
    this.#inner = inner;
    this.#release = release;
  }

  get resource(): T {
    return this.#inner;
  }

  async dispose(): Promise<void> {
    if (this.#disposed) {
      throw new Error("This borrow has been disposed");
    }
    this.#disposed = true;
    await this.#release(this);
  }
  declare [Symbol.asyncDispose]: () => Promise<void>;
  static {
    if (Symbol.asyncDispose) {
      Borrow.prototype[Symbol.asyncDispose] = Borrow.prototype.dispose;
    }
  }
}

type ResourcePlan = {
  until: Date;
  count: number;
};

export class ResourcePlanner {
  /**
   * Should be in ascending order of `until` and, at the same time, in descending order of `count`.
   * Also, all counts should be greater than `baseCount`.
   */
  #plans: ResourcePlan[];

  constructor() {
    this.#plans = [];
  }

  /**
   * Returns the count that should be used at the moment.
   * If there is no plan, returns `undefined`.
   */
  get currentCount(): number | undefined {
    return this.#plans[0]?.count;
  }

  /**
   * Records that the count should be greater than or equal to `count` until `until`.
   * @param until
   * @param count
   */
  addPlan(until: Date, count: number): void {
    // In most cases, the position is at the end of the array.
    let rangeEnd = this.#plans.length;
    for (; rangeEnd > 0; rangeEnd--) {
      if (this.#plans[rangeEnd - 1].until <= until) {
        break;
      }
    }
    let rangeStart = rangeEnd;
    for (; rangeStart > 0; rangeStart--) {
      if (this.#plans[rangeStart - 1].count > count) {
        break;
      }
    }
    this.#plans.splice(rangeStart, rangeEnd - rangeStart, { until, count });
  }

  /**
   * Removes all plans that have already expired.
   */
  updateTime(now: Date): void {
    while (this.#plans.length > 0 && this.#plans[0].until <= now) {
      this.#plans.shift();
    }
  }
}

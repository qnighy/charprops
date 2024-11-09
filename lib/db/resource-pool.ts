export type ResourceHandler<T> = {
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
  #busyResources: Set<T>;
  #wakers: (() => void)[];
  #createCount: number;
  #resourcePlanner: ResourcePlanner;
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
  }

  async take(): Promise<T> {
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

  tryTake(): T | undefined {
    const freeResource = this.#freeResources.pop();
    if (freeResource) {
      this.#busyResources.add(freeResource);
      return freeResource;
    }
  }

  #waitAndTryTake(): Promise<T | undefined> {
    return new Promise((resolve) => {
      this.#wakers.push(() => {
        // Ensure tryTake runs in the same microtask as the waker
        resolve(this.tryTake());
      });
    });
  }

  async release(worker: T, options: ReleaseOptions = {}): Promise<void> {
    const { broken = false } = options;
    if (!this.#busyResources.delete(worker)) {
      throw new Error("This resource is not busy or not managed by this pool");
    }
    if (broken || this.#resourceEnough()) {
      await this.#handler.disposeResource(worker);
    } else {
      this.#freeResources.push(worker);
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

  async #createAndTakeResource(): Promise<T> {
    this.#createCount++;
    try {
      const resource = await this.#handler.createResource();
      this.#busyResources.add(resource);
      this.#recordCurrentScale();
      return resource;
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

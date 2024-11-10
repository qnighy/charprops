export class CustomDisposable<T> implements Disposable {
  #resource: T;
  #dispose: (resource: T) => void;
  constructor(resource: T, dispose: (resource: T) => void) {
    this.#resource = resource;
    this.#dispose = dispose;
  }

  [Symbol.dispose](): void {
    this.#dispose(this.#resource);
  }

  get resource(): T {
    return this.#resource;
  }
}

export class CustomAsyncDisposable<T> implements AsyncDisposable {
  #resource: T;
  #dispose: (resource: T) => Promise<void>;
  constructor(resource: T, dispose: (resource: T) => Promise<void>) {
    this.#resource = resource;
    this.#dispose = dispose;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    return await this.#dispose(this.#resource);
  }

  get resource(): T {
    return this.#resource;
  }
}

export class Take<T extends Disposable | null | undefined> implements Disposable {
  #available = true;
  #resource: T | undefined;
  constructor(resource: T) {
    this.#resource = resource;
  }

  [Symbol.dispose](): void {
    if (this.#resource) {
      this.#resource[Symbol.dispose]();
      this.#resource = undefined;
    }
  }

  get borrow(): T {
    if (!this.#available) {
      throw new Error("Resource already taken or disposed");
    }
    return this.#resource!;
  }

  take(): T {
    if (!this.#available) {
      throw new Error("Resource already taken or disposed");
    }
    const resource = this.#resource!;
    this.#resource = undefined;
    return resource;
  }

  get available(): boolean {
    return this.#available;
  }
}

export class AsyncTake<T extends AsyncDisposable | null | undefined> implements AsyncDisposable {
  #available = true;
  #resource: T | undefined;
  constructor(resource: T) {
    this.#resource = resource;
  }

  async [Symbol.asyncDispose](): Promise<void> {
    if (this.#resource) {
      await this.#resource[Symbol.asyncDispose]();
      this.#resource = undefined;
    }
  }

  get borrow(): T {
    if (!this.#available) {
      throw new Error("Resource already taken or disposed");
    }
    return this.#resource!;
  }

  take(): T {
    if (!this.#available) {
      throw new Error("Resource already taken or disposed");
    }
    const resource = this.#resource!;
    this.#resource = undefined;
    return resource;
  }

  get available(): boolean {
    return this.#available;
  }
}

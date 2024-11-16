// @deno-types="npm:wa-sqlite"
import * as VFS from 'wa-sqlite/src/VFS.js';

function log(..._args: unknown[]) {
  // console.debug(...arguments);
}

type FileEntry = {
  handle: ChunkedVirtualFile;
  url: URL;
};

export class AsyncDenoChunkedReadonlyVFS extends VFS.Base {
  name = 'deno-chunked-readonly-async';

  #mapIdToFile: Map<number, FileEntry> = new Map();
  #fileCache = new FileCache();

  static #resolveName(name: string): URL {
    const cwdURL = new URL(Deno.cwd() + "/", 'file://localhost/');
    return new URL(name, cwdURL);
  }

  override xOpen(name: string | null, fileId: number, flags: number, pOutFlags: DataView): number {
    return this.handleAsync(async () => {
      if (name === null) name = `null_${fileId}`;
      log(`xOpen ${name} ${fileId} 0x${flags.toString(16)}`);
      if (this.#mapIdToFile.has(fileId)) {
        return VFS.SQLITE_IOERR;
      }

      try {
        // Filenames can be URLs, possibly with query parameters.
        const url = AsyncDenoChunkedReadonlyVFS.#resolveName(name);
        const handle = await ChunkedVirtualFile.open(url.pathname, this.#fileCache);
        this.#mapIdToFile.set(fileId, {
          handle,
          url,
        });

        // Always reports as read-only
        pOutFlags.setInt32(0, VFS.SQLITE_OPEN_READONLY, true);
        return VFS.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_CANTOPEN;
      }
    });
  }

  override xClose(fileId: number): number {
    try {
      const file = this.#mapIdToFile.get(fileId);
      if (file) {
        log(`xClose ${file.url}`);

        this.#mapIdToFile.delete(fileId);
      }
      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  // @ts-expect-error superclass type definition is incorrect
  override xRead(fileId: number, pData: Uint8Array, iOffset: number): number {
    return this.handleAsync(async () => {
      const file = this.#mapIdToFile.get(fileId);
      if (!file) {
        return VFS.SQLITE_IOERR;
      }
      log(`xRead ${file.url} ${pData.byteLength} ${iOffset}`);

      try {
        const numRead = await file.handle.readAt(pData, iOffset);
        if (numRead < pData.byteLength) {
          pData.fill(0, numRead);
          return VFS.SQLITE_IOERR_SHORT_READ;
        }

        return VFS.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    });
  }

  // @ts-expect-error superclass type definition is incorrect
  override xWrite(fileId: number, pData: Uint8Array, iOffset: number): number {
    const file = this.#mapIdToFile.get(fileId);
    if (!file) {
      return VFS.SQLITE_IOERR;
    }
    log(`xWrite ${file.url} ${pData.byteLength} ${iOffset}`);

    try {
      throw new Error("Write not supported in this VFS");

      // return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  override xTruncate(fileId: number, iSize: number): number {
    const file = this.#mapIdToFile.get(fileId);
    if (!file) {
      return VFS.SQLITE_IOERR;
    }
    log(`xTruncate ${file.url} ${iSize}`);

    try {
      throw new Error("Write not supported in this VFS");

      // return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  override xSync(fileId: number, flags: number): number {
    const file = this.#mapIdToFile.get(fileId);
    if (!file) {
      return VFS.SQLITE_IOERR;
    }
    log(`xSync ${file.url} ${flags}`);

    try {
      // Nothing to synchronize in this VFS

      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  override xFileSize(fileId: number, pSize64: DataView): number {
    const file = this.#mapIdToFile.get(fileId);
    if (!file) {
      return VFS.SQLITE_IOERR;
    }
    log(`xFileSize ${file.url}`);

    try {
      const size = file.handle.size;

      pSize64.setBigInt64(0, BigInt(size), true);
      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  override xLock(fileId: number, flags: number): number {
    const file = this.#mapIdToFile.get(fileId);
    if (!file) {
      return VFS.SQLITE_IOERR;
    }
    log(`xLock ${file.url} ${fileId} ${flags}`);

    try {
      // Nothing to lock in this VFS

      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  override xUnlock(fileId: number, flags: number): number {
    const file = this.#mapIdToFile.get(fileId);
    if (!file) {
      return VFS.SQLITE_IOERR;
    }
    log(`xUnlock ${file.url} ${fileId} ${flags}`);

    try {
      // Nothing to unlock in this VFS

      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  override xCheckReservedLock(fileId: number, pResOut: DataView): number {
    const file = this.#mapIdToFile.get(fileId);
    if (!file) {
      return VFS.SQLITE_IOERR;
    }
    log(`xCheckReservedLock ${file.url}`);

    try {
      // No one locks anything in this VFS
      const isReserved = false;

      pResOut.setInt32(0, isReserved ? 1 : 0, true);
      return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }

  override xSectorSize(_fileId: number): number {
    log('xSectorSize');
    return 512;
  }

  override xDeviceCharacteristics(_fileId: number): number {
    log('xDeviceCharacteristics');
    // Everything is safe as it is immutable
    return VFS.SQLITE_IOCAP_ATOMIC |
           VFS.SQLITE_IOCAP_SAFE_APPEND |
           VFS.SQLITE_IOCAP_SEQUENTIAL |
           VFS.SQLITE_IOCAP_UNDELETABLE_WHEN_OPEN |
           VFS.SQLITE_IOCAP_POWERSAFE_OVERWRITE |
           VFS.SQLITE_IOCAP_IMMUTABLE |
           VFS.SQLITE_IOCAP_BATCH_ATOMIC;
  }

  override xAccess(name: string, flags: number, pResOut: DataView): number {
    return this.handleAsync(async () => {
      const url = AsyncDenoChunkedReadonlyVFS.#resolveName(name);
      log(`xAccess ${url} ${flags}`);

      try {
        let result;
        switch (flags) {
          case VFS.SQLITE_ACCESS_EXISTS:
          case VFS.SQLITE_ACCESS_READ:
            result = await ChunkedVirtualFile.exists(url.pathname, this.#fileCache);
            break;
          case VFS.SQLITE_ACCESS_READWRITE:
            // Readonly
            result = false;
            break;
        }


        pResOut.setInt32(0, result ? 1 : 0, true);
        return VFS.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    });
  }

  override xDelete(name: string, syncDir: number): number {
    const url = AsyncDenoChunkedReadonlyVFS.#resolveName(name);
    log(`xDelete ${url} ${syncDir}`);

    try {
      throw new Error("Write not supported in this VFS");

      // return VFS.SQLITE_OK;
    } catch (e) {
      console.error(e);
      return VFS.SQLITE_IOERR;
    }
  }
}

class ChunkedVirtualFile {
  #path: string;
  #size!: number;
  #chunkSize!: number;
  #cache: FileCache;

  constructor(path: string, cache: FileCache) {
    this.#path = path;
    this.#cache = cache;
  }

  static async exists(path: string, cache: FileCache): Promise<boolean> {
    try {
      await cache.read(path + ".master.json");
      return true;
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        return false;
      } else {
        throw e;
      }
    }
  }

  static async open(path: string, cache: FileCache): Promise<ChunkedVirtualFile> {
    const file = new ChunkedVirtualFile(path, cache);
    await file._open();
    return file;
  }

  async _open() {
    const { size, chunkSize } = JSON.parse(new TextDecoder().decode(await this.#cache.read(this.#path + ".master.json")));
    if (typeof size !== 'number' || typeof chunkSize !== 'number') {
      throw new Error("Invalid master file");
    }

    this.#size = size;
    this.#chunkSize = chunkSize;
  }

  get size(): number {
    return this.#size;
  }

  async readAt(dest: Uint8Array, offset: number): Promise<number> {
    let readPos = 0;

    while (readPos < dest.length) {
      const currentOffset = offset + readPos;
      if (currentOffset >= this.#size) {
        return readPos;
      }

      const chunkId = Math.floor(currentOffset / this.#chunkSize);
      const offsetInChunk = currentOffset % this.#chunkSize;
      const chunkSize = Math.min(this.#chunkSize, this.#size - this.#chunkSize * chunkId);
      const chunk = await this.#cache.read(this.#path + `.${chunkId}.bin`);
      if (chunk.length !== chunkSize) {
        throw new Error(`Invalid chunk size: ${chunk.length} (expected ${chunkSize})`);
      }
      const readSize = Math.min(dest.length - readPos, chunk.length - offsetInChunk);
      dest.set(chunk.subarray(offsetInChunk, offsetInChunk + readSize), readPos);
      readPos += readSize;
    }
    return readPos;
  }
}

class FileCache {
  #cache = new Map<string, Uint8Array>();
  #cacheSize = 256;

  async read(path: string): Promise<Uint8Array> {
    const cached = this.#cache.get(path);
    if (cached) {
      // Delete and re-add to move the entry to the end of the cache (i.e. LRU)
      this.#cache.delete(path);
      this.#cache.set(path, cached);
      return cached;
    }

    const content = await Deno.readFile(path);
    this.#cache.set(path, content);
    if (this.#cache.size > this.#cacheSize) {
      // Loop over the keys to find the first one to delete
      // because the first key is the least recently used one.
      for (const key of this.#cache.keys()) {
        this.#cache.delete(key);
        break;
      }
    }
    return content;
  }
}

export type GenerateChunkedAsyncOptions = {
  chunkSize?: number;
};
export async function generateChunkedAsync(path: string, options: GenerateChunkedAsyncOptions = {}): Promise<void> {
  const { chunkSize = 65536 } = options;

  const f = await Deno.open(path, { read: true });
  try {
    const stat = await f.stat();
    const numChunks = Math.ceil(stat.size / chunkSize);
    const buf = new Uint8Array(chunkSize);

    for (let i = 0; i < numChunks; i++) {
      const currentChunkSize = Math.min(chunkSize, stat.size - chunkSize * i);
      const chunk = buf.subarray(0, currentChunkSize);
      let readPos = 0;
      while (readPos < currentChunkSize) {
        const numRead = await f.read(chunk.subarray(readPos));
        if (numRead === null) {
          break;
        }
        readPos += numRead;
      }
      if (readPos < chunk.length) {
        throw new Error("Short read");
      }
      await Deno.writeFile(`${path}.${i}.bin`, chunk);
    }
    await Deno.writeFile(`${path}.master.json`, new TextEncoder().encode(JSON.stringify({
      size: stat.size,
      chunkSize,
    })));
  } finally {
    f.close();
  }
}

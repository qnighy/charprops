// @deno-types="npm:wa-sqlite"
import * as VFS from 'wa-sqlite/src/VFS.js';

function log(..._args: unknown[]) {
  // console.debug(...arguments);
}

type FileEntry = {
  handle: Deno.FsFile;
  url: URL;
  flags: number;
  lockState: number;
};

export class AsyncDenoVFS extends VFS.Base {
  name = 'deno-async';

  #mapIdToFile: Map<number, FileEntry> = new Map();

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
        const url = AsyncDenoVFS.#resolveName(name);
        const handle = await Deno.open(url.pathname, AsyncDenoVFS.#openOptions(flags));
        this.#mapIdToFile.set(fileId, {
          handle,
          url,
          flags,
          lockState: VFS.SQLITE_LOCK_NONE,
        });

        pOutFlags.setInt32(0, flags & VFS.SQLITE_OPEN_READONLY, true);
        return VFS.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_CANTOPEN;
      }
    });
  }

  static #openOptions(flags: number): Deno.OpenOptions {
    return {
      read: true,
      write: Boolean(flags & VFS.SQLITE_OPEN_READWRITE),
      append: false,
      truncate: false,
      create: Boolean(flags & VFS.SQLITE_OPEN_CREATE),
      createNew: false,
      mode: 0o666,
    };
  }

  override xClose(fileId: number): number {
    return this.handleAsync(async () => {
      try {
        const file = this.#mapIdToFile.get(fileId);
        if (file) {
          log(`xClose ${file.url}`);

          this.#mapIdToFile.delete(fileId);
          file.handle.close();
          if (file.flags & VFS.SQLITE_OPEN_DELETEONCLOSE) {
            await Deno.remove(file.url);
          }
        }
        return VFS.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    });
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
        await file.handle.seek(iOffset, Deno.SeekMode.Start);
        let readPos = 0;
        while (readPos < pData.byteLength) {
          const numRead = await file.handle.read(pData.subarray(readPos));
          if (numRead === null) {
            pData.fill(0, readPos);
            return VFS.SQLITE_IOERR_SHORT_READ;
          }
          readPos += numRead;
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
    return this.handleAsync(async () => {
      const file = this.#mapIdToFile.get(fileId);
      if (!file) {
        return VFS.SQLITE_IOERR;
      }
      log(`xWrite ${file.url} ${pData.byteLength} ${iOffset}`);

      try {
        await file.handle.seek(iOffset, Deno.SeekMode.Start);
        let writePos = 0;
        while (writePos < pData.byteLength) {
          const numWritten = await file.handle.write(pData.subarray(writePos));
          writePos += numWritten;
        }

        return VFS.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    });
  }

  override xTruncate(fileId: number, iSize: number): number {
    return this.handleAsync(async () => {
      const file = this.#mapIdToFile.get(fileId);
      if (!file) {
        return VFS.SQLITE_IOERR;
      }
      log(`xTruncate ${file.url} ${iSize}`);

      try {
        await file.handle.truncate(iSize);
        return VFS.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    });
  }

  override xSync(fileId: number, flags: number): number {
    return this.handleAsync(async () => {
      const file = this.#mapIdToFile.get(fileId);
      if (!file) {
        return VFS.SQLITE_IOERR;
      }
      log(`xSync ${file.url} ${flags}`);

      try {
        await file.handle.sync();
        return VFS.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    });
  }

  override xFileSize(fileId: number, pSize64: DataView): number {
    return this.handleAsync(async () => {
      const file = this.#mapIdToFile.get(fileId);
      if (!file) {
        return VFS.SQLITE_IOERR;
      }
      log(`xFileSize ${file.url}`);

      try {
        const { size } = await file.handle.stat();

        pSize64.setBigInt64(0, BigInt(size), true);
        return VFS.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    });
  }

  override xLock(fileId: number, flags: number): number {
    return this.handleAsync(async () => {
      const file = this.#mapIdToFile.get(fileId);
      if (!file) {
        return VFS.SQLITE_IOERR;
      }
      log(`xLock ${file.url} ${fileId} ${flags}`);

      try {
        if (file.lockState < flags) {
          await AsyncDenoVFS.#lock(file.handle, flags >= VFS.SQLITE_LOCK_RESERVED);
          file.lockState = flags;
        }

        return VFS.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    });
  }

  override xUnlock(fileId: number, flags: number): number {
    return this.handleAsync(async () => {
      const file = this.#mapIdToFile.get(fileId);
      if (!file) {
        return VFS.SQLITE_IOERR;
      }
      log(`xUnlock ${file.url} ${fileId} ${flags}`);

      try {
        if (file.lockState > flags) {
          if (flags === VFS.SQLITE_LOCK_NONE) {
            await AsyncDenoVFS.#unlock(file.handle);
          } else {
            await AsyncDenoVFS.#lock(file.handle, false);
          }
          file.lockState = flags;
        }
        return VFS.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    });
  }

  override xCheckReservedLock(fileId: number, pResOut: DataView): number {
    return this.handleAsync(async () => {
      const file = this.#mapIdToFile.get(fileId);
      if (!file) {
        return VFS.SQLITE_IOERR;
      }
      log(`xCheckReservedLock ${file.url}`);

      try {
        const isReserved = await AsyncDenoVFS.#checkExclusiveLock(file.url);
        pResOut.setInt32(0, isReserved ? 1 : 0, true);
        return VFS.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    });
  }

  static #checkExclusiveLock(url: URL): Promise<boolean> {
    return Promise.race([
      (async () => {
        const f = await Deno.open(url);
        await AsyncDenoVFS.#lock(f, false);
        f.close();
        return false;
      })(),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 10)),
    ]);
  }

  static #lockSupported: boolean | undefined = undefined;

  static async #lock(f: Deno.FsFile, exclusive: boolean): Promise<void> {
    if (AsyncDenoVFS.#lockSupported === false) {
      return;
    } else if (AsyncDenoVFS.#lockSupported === true) {
      return await f.lock(exclusive);
    }
    try {
      await f.lock(exclusive);
    } catch (e) {
      if (e instanceof Deno.errors.NotSupported) {
        // Probably a Deno Deploy environment, where file is readonly.
        // No lock is needed in this case.
        AsyncDenoVFS.#lockSupported = false;
      } else {
        throw e;
      }
    }
  }

  static async #unlock(f: Deno.FsFile): Promise<void> {
    if (AsyncDenoVFS.#lockSupported === false) {
      return;
    }
    return await f.unlock();
  }

  override xSectorSize(_fileId: number): number {
    log('xSectorSize');
    return 512;
  }

  override xDeviceCharacteristics(_fileId: number): number {
    log('xDeviceCharacteristics');
    // Unsure what applies here in Deno...
    return VFS.SQLITE_IOCAP_SAFE_APPEND |
           VFS.SQLITE_IOCAP_SEQUENTIAL;
  }

  override xAccess(name: string, flags: number, pResOut: DataView): number {
    return this.handleAsync(async () => {
      const url = AsyncDenoVFS.#resolveName(name);
      log(`xAccess ${url} ${flags}`);

      try {
        let result;
        switch (flags) {
          case VFS.SQLITE_ACCESS_EXISTS:
            try {
              await Deno.stat(url);
              result = true;
            } catch (e) {
              if (e instanceof Deno.errors.NotFound) {
                result = false;
              } else {
                throw e;
              }
            }
            break;
          case VFS.SQLITE_ACCESS_READ:
            try {
              await Deno.open(url, { read: true });
              result = true;
            } catch (e) {
              if (e instanceof Deno.errors.NotFound || e instanceof Deno.errors.PermissionDenied) {
                result = false;
              } else {
                throw e;
              }
            }
            break;
          case VFS.SQLITE_ACCESS_READWRITE:
            try {
              await Deno.open(url, { read: true, write: true });
              result = true;
            } catch (e) {
              if (e instanceof Deno.errors.NotFound || e instanceof Deno.errors.PermissionDenied) {
                result = false;
              } else {
                throw e;
              }
            }
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
    return this.handleAsync(async () => {
      const url = AsyncDenoVFS.#resolveName(name);
      log(`xDelete ${url} ${syncDir}`);

      try {
        await Deno.remove(url);
        return VFS.SQLITE_OK;
      } catch (e) {
        console.error(e);
        return VFS.SQLITE_IOERR;
      }
    });
  }
}

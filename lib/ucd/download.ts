import * as path from "$std/path/mod.ts";
import { decompress } from "@fakoua/zip-ts";
import { UNICODE_VERSION } from "./version.ts";

const moduleDir = import.meta.dirname;
if (moduleDir == null) {
  throw new Error(`Not a local module: ${import.meta.url}`);
}

const UCDDownloadPath = path.join(moduleDir, "..", "..", "ucd", UNICODE_VERSION);

export async function downloadUCD(): Promise<string> {
  const ucdZipSource = `https://www.unicode.org/Public/${UNICODE_VERSION}/ucd/UCD.zip`;
  const ucdZipDest = path.join(UCDDownloadPath, "UCD.zip");
  const downloadedMarkFile = path.join(UCDDownloadPath, "UCD.zip.downloaded");
  const extractedMarkFile = path.join(UCDDownloadPath, "UCD.zip.extracted");

  const alreadyExtracted = await fileExists(extractedMarkFile);
  if (alreadyExtracted) {
    return UCDDownloadPath;
  }

  const alreadyDownloaded = await fileExists(downloadedMarkFile);
  if (!alreadyDownloaded) {
    await Deno.mkdir(UCDDownloadPath, { recursive: true });

    const zipFile = await Deno.open(ucdZipDest, { create: true, write: true, truncate: true });
    let closed = false;
    try {
      const response = await fetch(ucdZipSource);
      if (!response.ok) {
        throw new Error(`Failed to download UCD: ${response.status} ${response.statusText}`);
      }

      if (response.body == null) {
        throw new Error("No response body");
      }

      await response.body.pipeTo(zipFile.writable);
      closed = true;
    } finally {
      if (!closed) zipFile.close();
    }
    touch(downloadedMarkFile);
  }

  const success = await decompress(ucdZipDest, UCDDownloadPath, { overwrite: true });
  if (success === false) {
    throw new Error("Failed to decompress UCD.zip");
  }

  touch(extractedMarkFile);

  return UCDDownloadPath;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) {
      return false;
    }
    throw e;
  }
}
async function touch(path: string): Promise<void> {
  await Deno.writeTextFile(path, "");
}

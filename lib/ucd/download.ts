import * as path from "@std/path";
import { expandGlob } from "@std/fs";
import { decompress } from "@fakoua/zip-ts";
import { UNICODE_VERSION } from "./version.ts";
import { AsyncTake, CustomAsyncDisposable, Take } from "../raii.ts";

const moduleDir = import.meta.dirname;
if (moduleDir == null) {
  throw new Error(`Not a local module: ${import.meta.url}`);
}

const UCDDownloadPath = path.join(moduleDir, "..", "..", "ucd", UNICODE_VERSION);

export type UCDZipFilename = "UCD.zip";
export type UCDFilename =
  | "ArabicShaping.txt"
  | "BidiBrackets.txt"
  | "BidiCharacterTest.txt"
  | "BidiMirroring.txt"
  | "BidiTest.txt"
  | "Blocks.txt"
  | "CJKRadicals.txt"
  | "CaseFolding.txt"
  | "CompositionExclusions.txt"
  | "DerivedAge.txt"
  | "DerivedCoreProperties.txt"
  | "DerivedNormalizationProps.txt"
  | "DoNotEmit.txt"
  | "EastAsianWidth.txt"
  | "EmojiSources.txt"
  | "EquivalentUnifiedIdeograph.txt"
  | "HangulSyllableType.txt"
  | "Index.txt"
  | "IndicPositionalCategory.txt"
  | "IndicSyllabicCategory.txt"
  | "Jamo.txt"
  | "LineBreak.txt"
  | "NameAliases.txt"
  | "NamedSequences.txt"
  | "NamedSequencesProv.txt"
  | "NamesList.html"
  | "NamesList.txt"
  | "NormalizationCorrections.txt"
  | "NormalizationTest.txt"
  | "NushuSources.txt"
  | "PropList.txt"
  | "PropertyAliases.txt"
  | "PropertyValueAliases.txt"
  | "ReadMe.txt"
  | "ScriptExtensions.txt"
  | "Scripts.txt"
  | "SpecialCasing.txt"
  | "StandardizedVariants.txt"
  | "TangutSources.txt"
  | "USourceData.txt"
  | "USourceGlyphs.pdf"
  | "USourceRSChart.pdf"
  | "UnicodeData.txt"
  | "Unikemet.txt"
  | "VerticalOrientation.txt"
  | "auxiliary/GraphemeBreakProperty.txt"
  | "auxiliary/GraphemeBreakTest.html"
  | "auxiliary/GraphemeBreakTest.txt"
  | "auxiliary/LineBreakTest.html"
  | "auxiliary/LineBreakTest.txt"
  | "auxiliary/SentenceBreakProperty.txt"
  | "auxiliary/SentenceBreakTest.html"
  | "auxiliary/SentenceBreakTest.txt"
  | "auxiliary/WordBreakProperty.txt"
  | "auxiliary/WordBreakTest.html"
  | "auxiliary/WordBreakTest.txt"
  | "emoji/ReadMe.txt"
  | "emoji/emoji-data.txt"
  | "emoji/emoji-variation-sequences.txt"
  | "extracted/DerivedBidiClass.txt"
  | "extracted/DerivedBinaryProperties.txt"
  | "extracted/DerivedCombiningClass.txt"
  | "extracted/DerivedDecompositionType.txt"
  | "extracted/DerivedEastAsianWidth.txt"
  | "extracted/DerivedGeneralCategory.txt"
  | "extracted/DerivedJoiningGroup.txt"
  | "extracted/DerivedJoiningType.txt"
  | "extracted/DerivedLineBreak.txt"
  | "extracted/DerivedName.txt"
  | "extracted/DerivedNumericType.txt"
  | "extracted/DerivedNumericValues.txt";

export type UnihanZipFilename = "Unihan.zip";
export type UnihanFilename =
  | "Unihan_DictionaryIndices.txt"
  | "Unihan_DictionaryLikeData.txt"
  | "Unihan_IRGSources.txt"
  | "Unihan_NumericValues.txt"
  | "Unihan_OtherMappings.txt"
  | "Unihan_RadicalStrokeCounts.txt"
  | "Unihan_Readings.txt"
  | "Unihan_Variants.txt";

export async function downloadUCD(filename: UCDZipFilename | UCDFilename | UnihanZipFilename | UnihanFilename): Promise<string> {
  if (filename.startsWith("Unihan_")) {
    await downloadUnihanAll();
    return path.join(UCDDownloadPath, filename.replace("/", path.SEPARATOR));
  }

  const ucdSource = `https://www.unicode.org/Public/${UNICODE_VERSION}/ucd/${filename}`;
  const ucdDist = path.join(UCDDownloadPath, filename.replace("/", path.SEPARATOR));
  await using ucdDistTmp = new AsyncTake(tmpPath());
  await Deno.mkdir(path.dirname(ucdDist), { recursive: true });

  const alreadyDownloaded = await fileExists(ucdDist);
  if (alreadyDownloaded) {
    return ucdDist;
  }
  {
    using distFile = new Take(await Deno.open(ucdDistTmp.borrow.path, { create: true, write: true, truncate: true }));

    const response = await fetch(ucdSource);
    await using body = new AsyncTake(new CustomAsyncDisposable(response.body, async (body) => await body?.cancel()));
    if (!response.ok) {
      throw new Error(`Failed to download UCD: ${response.status} ${response.statusText}`);
    }

    if (body.borrow.resource == null) {
      throw new Error("No response body");
    }

    await body.take().resource!.pipeTo(distFile.take().writable);
  }
  await Deno.rename(ucdDistTmp.take().path, ucdDist);

  return ucdDist;
}

async function downloadUnihanAll(): Promise<void> {
  const unihanZipPath = await downloadUCD("Unihan.zip");

  await using unihanExtractTmp = tmpPath();
  await Deno.mkdir(unihanExtractTmp.path, { recursive: true });

  const success = await decompress(unihanZipPath, unihanExtractTmp.path);
  if (success === false) {
    throw new Error("Failed to decompress Unihan.zip");
  }

  for await (const entry of expandGlob("**/*", { root: unihanExtractTmp.path })) {
    if (entry.isDirectory) {
      continue;
    }
    const relpath = path.relative(unihanExtractTmp.path, entry.path);
    const dest = path.join(UCDDownloadPath, "Unihan_" + relpath);
    await Deno.mkdir(path.dirname(dest), { recursive: true });
    await Deno.rename(entry.path, dest);
  }
}

class TmpPath implements AsyncDisposable {
  #path: string;
  constructor(path: string) {
    this.#path = path;
  }

  get path(): string {
    return this.#path;
  }

  async [Symbol.asyncDispose]() {
    await Deno.remove(this.#path, { recursive: true });
  }
}

function tmpPath(): TmpPath {
  let randomName = "";
  for (let i = 0; i < 16; i++) {
    randomName += ((Math.random() * 36) | 0).toString(36);
  }
  return new TmpPath(path.join(UCDDownloadPath, "tmp_" + randomName));
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

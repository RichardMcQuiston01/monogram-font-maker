import { readFile, readdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  generateMonogramFont,
  generateMonogramFontFromZip,
  type LetterSvgMap,
  type MonogramFontOptions,
} from './index.js';
import { matchLetterSvgFilename } from './core/zip.js';

export * from './index.js';

/**
 * Reads a directory of individual monogram SVGs (`A.svg`, `b.svg`, ...) into
 * a {@link LetterSvgMap}, for callers who provide one file per letter
 * instead of a single ZIP.
 */
export async function loadLettersFromDirectory(
  directoryPath: string
): Promise<LetterSvgMap> {
  const entries = await readdir(directoryPath);
  const letters: Record<string, string> = {};

  for (const entryName of entries) {
    const letter = matchLetterSvgFilename(entryName);
    if (letter === null) {
      continue;
    }
    letters[letter] = await readFile(join(directoryPath, entryName), 'utf8');
  }

  if (Object.keys(letters).length === 0) {
    throw new Error(
      `No single-letter SVG files (e.g. "A.svg") found in "${directoryPath}".`
    );
  }

  return letters;
}

/**
 * Reads an explicit list of individual monogram SVG file paths into a
 * {@link LetterSvgMap}; each file's letter is taken from its own basename.
 */
export async function loadLettersFromFiles(
  filePaths: readonly string[]
): Promise<LetterSvgMap> {
  const letters: Record<string, string> = {};

  for (const filePath of filePaths) {
    const letter = matchLetterSvgFilename(basename(filePath));
    if (letter === null) {
      throw new Error(
        `"${filePath}" isn't named like a single monogram letter (expected e.g. "A.svg").`
      );
    }
    letters[letter] = await readFile(filePath, 'utf8');
  }

  return letters;
}

/** Builds a monogram font from an in-memory letter map and writes it to disk. */
export async function writeMonogramFont(
  letters: LetterSvgMap,
  options: MonogramFontOptions,
  outputFilePath: string
): Promise<void> {
  const fontBytes = generateMonogramFont(letters, options);
  await writeFile(outputFilePath, Buffer.from(fontBytes));
}

/** Builds a monogram font from a ZIP file on disk and writes it to disk. */
export async function writeMonogramFontFromZipFile(
  zipFilePath: string,
  options: MonogramFontOptions,
  outputFilePath: string
): Promise<void> {
  const zipBytes = await readFile(zipFilePath);
  const fontBytes = await generateMonogramFontFromZip(zipBytes, options);
  await writeFile(outputFilePath, Buffer.from(fontBytes));
}

import type { Dirent } from 'node:fs';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import {
  generateMonogramFont,
  generateMonogramFontFromZip,
  type FilenameMatchOptions,
  type LetterSvgMap,
  type MonogramFontOptions,
} from './index.js';
import {
  compileFilenamePattern,
  DEFAULT_FILENAME_PATTERN,
} from './core/filenamePattern.js';
import { collectLetters, type LetterSource } from './core/letterCollection.js';

export * from './index.js';

/** Reads a regular file as UTF-8, refusing anything bigger than `maxBytes`. */
async function readTextFile(
  filePath: string,
  maxBytes: number
): Promise<string> {
  const fileStats = await stat(filePath);
  if (!fileStats.isFile()) {
    throw new Error(`"${filePath}" is not a file.`);
  }
  if (fileStats.size > maxBytes) {
    throw new Error(
      `"${filePath}" is ${fileStats.size} bytes, more than the limit of ${maxBytes}.`
    );
  }
  const bytes = await readFile(filePath);
  if (bytes.byteLength > maxBytes) {
    throw new Error(
      `"${filePath}" grew to ${bytes.byteLength} bytes while reading, more than the limit of ${maxBytes}.`
    );
  }
  return bytes.toString('utf8');
}

async function isRegularFile(
  entry: Dirent,
  entryPath: string
): Promise<boolean> {
  if (entry.isFile()) {
    return true;
  }
  if (!entry.isSymbolicLink()) {
    return false;
  }
  try {
    return (await stat(entryPath)).isFile();
  } catch {
    // A dangling link points at nothing, so there's no file to load.
    return false;
  }
}

/**
 * Reads a directory of individual monogram SVGs (`A.svg`, `b.svg`, ...) into
 * a {@link LetterSvgMap}, for callers who provide one file per letter
 * instead of a single ZIP. Subdirectories and non-matching names are
 * ignored. Pass `options.filenamePattern` if the files don't use the default
 * `A.svg` naming.
 */
export async function loadLettersFromDirectory(
  directoryPath: string,
  options: FilenameMatchOptions = {}
): Promise<LetterSvgMap> {
  const pattern = options.filenamePattern ?? DEFAULT_FILENAME_PATTERN;
  const compiledPattern = compileFilenamePattern(pattern);

  const entries = await readdir(directoryPath, { withFileTypes: true });
  const sources: LetterSource[] = [];
  for (const entry of entries) {
    const entryPath = join(directoryPath, entry.name);
    if (!(await isRegularFile(entry, entryPath))) {
      continue;
    }
    sources.push({
      baseName: entry.name,
      label: entry.name,
      readText: (maxBytes: number) => readTextFile(entryPath, maxBytes),
    });
  }

  return collectLetters(sources, {
    pattern,
    compiledPattern,
    inputDescription: `"${directoryPath}"`,
    onUnmatched: 'skip',
  });
}

/**
 * Reads an explicit list of individual monogram SVG file paths into a
 * {@link LetterSvgMap}; each file's letter is taken from its own basename.
 * A path that doesn't match, or isn't a file, is an error. Pass
 * `options.filenamePattern` if the files don't use the default `A.svg`
 * naming.
 */
export async function loadLettersFromFiles(
  filePaths: readonly string[],
  options: FilenameMatchOptions = {}
): Promise<LetterSvgMap> {
  const pattern = options.filenamePattern ?? DEFAULT_FILENAME_PATTERN;
  const compiledPattern = compileFilenamePattern(pattern);

  const sources: LetterSource[] = filePaths.map((filePath) => ({
    baseName: basename(filePath),
    label: filePath,
    readText: (maxBytes: number) => readTextFile(filePath, maxBytes),
  }));

  return collectLetters(sources, {
    pattern,
    compiledPattern,
    inputDescription: 'The file list',
    onUnmatched: 'error',
  });
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

/**
 * Builds a monogram font from a ZIP file on disk and writes it to disk. Pass
 * `filenameOptions.filenamePattern` if the archive doesn't use the default
 * `A.svg` naming.
 */
export async function writeMonogramFontFromZipFile(
  zipFilePath: string,
  options: MonogramFontOptions,
  outputFilePath: string,
  filenameOptions?: FilenameMatchOptions
): Promise<void> {
  const zipBytes = await readFile(zipFilePath);
  const fontBytes = await generateMonogramFontFromZip(
    zipBytes,
    options,
    filenameOptions
  );
  await writeFile(outputFilePath, Buffer.from(fontBytes));
}

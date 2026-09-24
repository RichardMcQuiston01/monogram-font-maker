import { readFile, readdir, writeFile } from 'node:fs/promises';
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
  matchFilenamePattern,
  DEFAULT_FILENAME_PATTERN,
} from './core/filenamePattern.js';

export * from './index.js';

/**
 * Reads a directory of individual monogram SVGs (`A.svg`, `b.svg`, ...) into
 * a {@link LetterSvgMap}, for callers who provide one file per letter
 * instead of a single ZIP. Pass `options.filenamePattern` if the files don't
 * use the default `A.svg` naming.
 */
export async function loadLettersFromDirectory(
  directoryPath: string,
  options: FilenameMatchOptions = {}
): Promise<LetterSvgMap> {
  const pattern = options.filenamePattern ?? DEFAULT_FILENAME_PATTERN;
  const compiledPattern = compileFilenamePattern(pattern);

  const entries = await readdir(directoryPath);
  const letters: Record<string, string> = {};

  for (const entryName of entries) {
    const letter = matchFilenamePattern(entryName, compiledPattern);
    if (letter === null) {
      continue;
    }
    if (letter in letters) {
      throw new Error(
        `Duplicate monogram SVG for letter "${letter}" in "${directoryPath}" (also matched "${entryName}").`
      );
    }
    letters[letter] = await readFile(join(directoryPath, entryName), 'utf8');
  }

  if (Object.keys(letters).length === 0) {
    throw new Error(
      `No filenames matching the pattern "${pattern}" found in "${directoryPath}".`
    );
  }

  return letters;
}

/**
 * Reads an explicit list of individual monogram SVG file paths into a
 * {@link LetterSvgMap}; each file's letter is taken from its own basename.
 * Pass `options.filenamePattern` if the files don't use the default `A.svg`
 * naming.
 */
export async function loadLettersFromFiles(
  filePaths: readonly string[],
  options: FilenameMatchOptions = {}
): Promise<LetterSvgMap> {
  const pattern = options.filenamePattern ?? DEFAULT_FILENAME_PATTERN;
  const compiledPattern = compileFilenamePattern(pattern);

  const letters: Record<string, string> = {};

  for (const filePath of filePaths) {
    const letter = matchFilenamePattern(basename(filePath), compiledPattern);
    if (letter === null) {
      throw new Error(
        `"${filePath}" doesn't match the filename pattern "${pattern}".`
      );
    }
    if (letter in letters) {
      throw new Error(
        `Duplicate monogram SVG for letter "${letter}" (also matched "${filePath}").`
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

import JSZip from 'jszip';
import type { LetterSvgMap } from './fontBuilder.js';
import {
  compileFilenamePattern,
  matchFilenamePattern,
  DEFAULT_FILENAME_PATTERN,
  type FilenamePattern,
} from './filenamePattern.js';

/** Any byte representation JSZip can load, in either the browser or Node. */
export type ZipInput = string | number[] | Uint8Array | ArrayBuffer | Blob;

export interface FilenameMatchOptions {
  /**
   * Template describing where the letter sits in each filename. Defaults to
   * `{@link DEFAULT_FILENAME_PATTERN}` (`"{letter}.svg"`, i.e. `A.svg`).
   * See {@link FilenamePattern} for the template syntax.
   */
  filenamePattern?: FilenamePattern;
}

const DEFAULT_FILENAME_REGEXP = compileFilenamePattern(
  DEFAULT_FILENAME_PATTERN
);

/**
 * Extracts the letter from a filename (e.g. `"A.svg"` -> `"A"` under the
 * default `{letter}.svg` pattern), or returns `null` if it doesn't match.
 */
export function matchLetterSvgFilename(
  filename: string,
  pattern: FilenamePattern = DEFAULT_FILENAME_PATTERN
): string | null {
  const compiled =
    pattern === DEFAULT_FILENAME_PATTERN
      ? DEFAULT_FILENAME_REGEXP
      : compileFilenamePattern(pattern);
  return matchFilenamePattern(filename, compiled);
}

/**
 * Reads a single ZIP archive of monogram SVGs — one file per letter, named
 * to match `filenamePattern` (`A.svg`, `b.svg`, etc. by default) — into a
 * {@link LetterSvgMap}. Entries that don't match are ignored, so a README or
 * license file alongside the artwork doesn't break the import.
 */
export async function extractLettersFromZip(
  zipData: ZipInput,
  options: FilenameMatchOptions = {}
): Promise<LetterSvgMap> {
  const pattern = options.filenamePattern ?? DEFAULT_FILENAME_PATTERN;
  const compiledPattern =
    pattern === DEFAULT_FILENAME_PATTERN
      ? DEFAULT_FILENAME_REGEXP
      : compileFilenamePattern(pattern);

  const archive = await JSZip.loadAsync(zipData);

  const letters: Record<string, string> = {};
  for (const entry of Object.values(archive.files)) {
    if (entry.dir) {
      continue;
    }
    const baseName = entry.name.split('/').pop() ?? entry.name;
    const letter = matchFilenamePattern(baseName, compiledPattern);
    if (letter === null) {
      continue;
    }

    if (letter in letters) {
      throw new Error(
        `Duplicate monogram SVG for letter "${letter}" in ZIP (also matched "${baseName}").`
      );
    }
    letters[letter] = await entry.async('string');
  }

  if (Object.keys(letters).length === 0) {
    throw new Error(
      `ZIP file contained no filenames matching the pattern "${pattern}".`
    );
  }

  return letters;
}

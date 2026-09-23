import JSZip from 'jszip';
import type { LetterSvgMap } from './fontBuilder.js';

/** Any byte representation JSZip can load, in either the browser or Node. */
export type ZipInput = string | number[] | Uint8Array | ArrayBuffer | Blob;

const LETTER_FILENAME_PATTERN = /^(.)\.svg$/i;

/**
 * Extracts the letter from a `<letter>.svg` filename (e.g. `"A.svg"` ->
 * `"A"`), or returns `null` if `filename` doesn't match that shape.
 */
export function matchLetterSvgFilename(filename: string): string | null {
  return filename.match(LETTER_FILENAME_PATTERN)?.[1] ?? null;
}

/**
 * Reads a single ZIP archive of monogram SVGs — one file per letter, named
 * `A.svg`, `b.svg`, etc. — into a {@link LetterSvgMap}. Entries whose base
 * name isn't exactly one character plus a `.svg` extension are ignored, so
 * a README or license file alongside the artwork doesn't break the import.
 */
export async function extractLettersFromZip(
  zipData: ZipInput
): Promise<LetterSvgMap> {
  const archive = await JSZip.loadAsync(zipData);

  const letters: Record<string, string> = {};
  for (const entry of Object.values(archive.files)) {
    if (entry.dir) {
      continue;
    }
    const baseName = entry.name.split('/').pop() ?? entry.name;
    const letter = matchLetterSvgFilename(baseName);
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
      'ZIP file contained no single-letter SVG files (expected names like "A.svg").'
    );
  }

  return letters;
}

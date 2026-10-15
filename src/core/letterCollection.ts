import type { LetterSvgMap } from './fontBuilder.js';
import {
  matchFilenamePattern,
  type CompiledFilenamePattern,
  type FilenamePattern,
} from './filenamePattern.js';
import {
  MAX_INPUT_ENTRIES,
  MAX_SVG_BYTES,
  MAX_TOTAL_SVG_BYTES,
} from './inputLimits.js';

/** One candidate file offered to {@link collectLetters}. */
export interface LetterSource {
  /** Base filename (no folders) matched against the filename pattern. */
  baseName: string;
  /** Where the entry came from, for error messages (a path, usually). */
  label: string;
  /**
   * Reads and decodes the entry. Must reject, without decoding the whole
   * entry, if it holds more than `maxBytes` bytes.
   */
  readText: (maxBytes: number) => Promise<string>;
}

export interface CollectLettersOptions {
  pattern: FilenamePattern;
  compiledPattern: CompiledFilenamePattern;
  /** Names the input in error messages, e.g. `ZIP file` or `"./letters"`. */
  inputDescription: string;
  /**
   * What to do with an entry whose name doesn't match: `skip` ignores it
   * (archives and folders with unrelated files), `error` rejects the input
   * (an explicit file list).
   */
  onUnmatched: 'skip' | 'error';
}

/** Takes the final name out of a path that uses `/` or `\` separators. */
export function baseNameOf(entryName: string): string {
  const segments = entryName.split(/[/\\]/);
  return segments[segments.length - 1] ?? entryName;
}

/**
 * Shared letter collection for every loader (ZIP, directory, file list):
 * matches names, rejects duplicates, enforces the entry and byte caps, and
 * errors when nothing matched, so the loaders can't drift apart.
 */
export async function collectLetters(
  sources: readonly LetterSource[],
  options: CollectLettersOptions
): Promise<LetterSvgMap> {
  const { pattern, compiledPattern, inputDescription, onUnmatched } = options;

  if (sources.length > MAX_INPUT_ENTRIES) {
    throw new Error(
      `${inputDescription} contains ${sources.length} entries, more than the limit of ${MAX_INPUT_ENTRIES}.`
    );
  }

  const letters: Record<string, string> = {};
  const sourceLabels: Record<string, string> = {};
  let remainingBytes = MAX_TOTAL_SVG_BYTES;

  for (const source of sources) {
    const letter = matchFilenamePattern(source.baseName, compiledPattern);
    if (letter === null) {
      if (onUnmatched === 'error') {
        throw new Error(
          `"${source.label}" doesn't match the filename pattern "${pattern}".`
        );
      }
      continue;
    }

    if (letter in letters) {
      throw new Error(
        `Duplicate monogram SVG for letter "${letter}" in ${inputDescription} (matched "${sourceLabels[letter]}" and "${source.label}").`
      );
    }

    const text = await source.readText(Math.min(MAX_SVG_BYTES, remainingBytes));
    remainingBytes -= new TextEncoder().encode(text).byteLength;
    letters[letter] = text;
    sourceLabels[letter] = source.label;
  }

  if (Object.keys(letters).length === 0) {
    throw new Error(
      `${inputDescription} contained no filenames matching the pattern "${pattern}".`
    );
  }

  return letters;
}

/**
 * A filename template describing where a glyph's character sits in the
 * filename. Two placeholder tokens are recognized:
 *
 * - `{letter}` — captures exactly one character, of any kind
 * - `{number}` — captures exactly one digit (`0`-`9`)
 *
 * `*` matches a run of any characters (e.g. an arbitrary prefix). Everything
 * else in the template is matched literally, case-insensitively. Exactly one
 * `{letter}`/`{number}` placeholder must appear in the template.
 *
 * @example '{letter}.svg'              // the default: "A.svg" -> "A"
 * @example '*_monogram_{letter}.svg'   // "butterfly_monogram_A.svg" -> "A"
 * @example '*_{number}.svg'            // "monogram_0.svg" -> "0"
 */
export type FilenamePattern = string;

export const DEFAULT_FILENAME_PATTERN: FilenamePattern = '{letter}.svg';

const TOKEN_PATTERN = /\{letter\}|\{number\}|\*/g;
const REGEXP_SPECIAL_CHARACTERS = /[.*+?^${}()|[\]\\]/g;

function escapeLiteral(text: string): string {
  return text.replace(REGEXP_SPECIAL_CHARACTERS, '\\$&');
}

/**
 * Compiles a {@link FilenamePattern} template into a `RegExp` with exactly
 * one capture group, for the character the matched filename represents.
 * Throws if the template doesn't contain exactly one `{letter}`/`{number}`
 * placeholder.
 */
export function compileFilenamePattern(pattern: FilenamePattern): RegExp {
  let source = '';
  let placeholderCount = 0;
  let previousEnd = 0;

  for (const match of pattern.matchAll(TOKEN_PATTERN)) {
    const token = match[0];
    const index = match.index;
    source += escapeLiteral(pattern.slice(previousEnd, index));

    if (token === '*') {
      source += '.*?';
    } else {
      placeholderCount += 1;
      source += token === '{number}' ? '([0-9])' : '(.)';
    }

    previousEnd = index + token.length;
  }
  source += escapeLiteral(pattern.slice(previousEnd));

  if (placeholderCount !== 1) {
    throw new Error(
      `Filename pattern must contain exactly one {letter} or {number} placeholder, found ${placeholderCount} in "${pattern}".`
    );
  }

  return new RegExp(`^${source}$`, 'i');
}

/**
 * Matches `filename` (a basename, not a path) against a pattern already
 * compiled by {@link compileFilenamePattern}, returning the captured
 * character or `null` if `filename` doesn't match.
 */
export function matchFilenamePattern(
  filename: string,
  compiledPattern: RegExp
): string | null {
  return filename.match(compiledPattern)?.[1] ?? null;
}

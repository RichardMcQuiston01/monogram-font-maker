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

type PatternElement =
  | { kind: 'literal'; codePoint: string }
  | { kind: 'letter' }
  | { kind: 'number' }
  | { kind: 'wildcard' };

/** A {@link FilenamePattern} validated and ready for {@link matchFilenamePattern}. */
export interface CompiledFilenamePattern {
  readonly pattern: FilenamePattern;
  readonly elements: readonly PatternElement[];
}

function toCodePoints(text: string): string[] {
  return Array.from(text);
}

/**
 * Compiles a {@link FilenamePattern} template for use with
 * {@link matchFilenamePattern}. Throws if the template doesn't contain
 * exactly one `{letter}`/`{number}` placeholder.
 */
export function compileFilenamePattern(
  pattern: FilenamePattern
): CompiledFilenamePattern {
  const elements: PatternElement[] = [];
  let placeholderCount = 0;
  let previousEnd = 0;

  const pushLiteral = (text: string): void => {
    for (const codePoint of toCodePoints(text)) {
      elements.push({ kind: 'literal', codePoint });
    }
  };

  for (const match of pattern.matchAll(TOKEN_PATTERN)) {
    const token = match[0];
    const index = match.index;
    pushLiteral(pattern.slice(previousEnd, index));

    if (token === '*') {
      elements.push({ kind: 'wildcard' });
    } else {
      placeholderCount += 1;
      elements.push({ kind: token === '{number}' ? 'number' : 'letter' });
    }

    previousEnd = index + token.length;
  }
  pushLiteral(pattern.slice(previousEnd));

  if (placeholderCount !== 1) {
    throw new Error(
      `Filename pattern must contain exactly one {letter} or {number} placeholder, found ${placeholderCount} in "${pattern}".`
    );
  }

  return { pattern, elements };
}

/**
 * Filenames longer than this are rejected without being matched against the
 * pattern. Real monogram filenames are nowhere near this long, and a ZIP
 * entry name is attacker-controlled input (up to 64 KiB per the ZIP spec).
 */
const MAX_FILENAME_LENGTH = 512;

function foldCase(codePoint: string): string {
  return codePoint.toLowerCase();
}

function isAsciiDigit(codePoint: string): boolean {
  return codePoint >= '0' && codePoint <= '9';
}

/**
 * Matches `filename` (a basename, not a path) against a pattern already
 * compiled by {@link compileFilenamePattern}, returning the captured
 * character or `null` if `filename` doesn't match.
 *
 * Uses the classic linear wildcard scan (remember the most recent `*` and
 * retry from there), so matching is O(filename x pattern) no matter how many
 * `*` a template contains; a regex built from several `*` would backtrack
 * exponentially-to-polynomially on a near-miss name.
 */
export function matchFilenamePattern(
  filename: string,
  compiledPattern: CompiledFilenamePattern
): string | null {
  if (filename.length > MAX_FILENAME_LENGTH) {
    return null;
  }

  const { elements } = compiledPattern;
  const text = toCodePoints(filename);
  let textIndex = 0;
  let elementIndex = 0;
  let wildcardElementIndex = -1;
  let wildcardTextIndex = 0;
  let captured: string | null = null;

  while (textIndex < text.length) {
    const element = elements[elementIndex] as PatternElement | undefined;
    const character = text[textIndex];

    if (element?.kind === 'wildcard') {
      wildcardElementIndex = elementIndex;
      wildcardTextIndex = textIndex;
      elementIndex += 1;
      continue;
    }

    let isMatch = false;
    if (element?.kind === 'literal') {
      isMatch = foldCase(element.codePoint) === foldCase(character);
    } else if (element?.kind === 'letter') {
      isMatch = true;
    } else if (element?.kind === 'number') {
      isMatch = isAsciiDigit(character);
    }

    if (isMatch) {
      if (element?.kind === 'letter' || element?.kind === 'number') {
        captured = character;
      }
      textIndex += 1;
      elementIndex += 1;
    } else if (wildcardElementIndex >= 0) {
      wildcardTextIndex += 1;
      textIndex = wildcardTextIndex;
      elementIndex = wildcardElementIndex + 1;
    } else {
      return null;
    }
  }

  while (elements[elementIndex]?.kind === 'wildcard') {
    elementIndex += 1;
  }
  return elementIndex === elements.length ? captured : null;
}

/** OpenType allows `unitsPerEm` from 16 to 16384. */
export const MIN_UNITS_PER_EM = 16;
export const MAX_UNITS_PER_EM = 16384;

/** Largest magnitude of any font-unit value written as a signed 16-bit field. */
export const MAX_FONT_UNIT_MAGNITUDE = 32767;

/** Largest advance width, stored as an unsigned 16-bit field. */
export const MAX_ADVANCE_WIDTH = 65535;

export interface FontMetricsInput {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  sideBearing?: number;
}

function assertFiniteWithin(name: string, value: number, limit: number): void {
  if (!Number.isFinite(value) || Math.abs(value) > limit) {
    throw new Error(
      `${name} must be a finite number between -${limit} and ${limit}, received ${value}.`
    );
  }
}

/**
 * Rejects metrics that opentype.js would otherwise write into 16-bit font
 * table fields where they wrap around or turn into NaN, producing a font
 * that parses with different numbers than the caller asked for.
 */
export function assertValidFontMetrics(metrics: FontMetricsInput): void {
  const { unitsPerEm, ascender, descender, sideBearing } = metrics;

  if (
    !Number.isInteger(unitsPerEm) ||
    unitsPerEm < MIN_UNITS_PER_EM ||
    unitsPerEm > MAX_UNITS_PER_EM
  ) {
    throw new Error(
      `unitsPerEm must be an integer between ${MIN_UNITS_PER_EM} and ${MAX_UNITS_PER_EM}, received ${unitsPerEm}.`
    );
  }
  assertFiniteWithin('ascender', ascender, MAX_FONT_UNIT_MAGNITUDE);
  assertFiniteWithin('descender', descender, MAX_FONT_UNIT_MAGNITUDE);
  if (descender > 0) {
    throw new Error(
      `descender must be negative or zero, received ${descender}.`
    );
  }
  if (ascender <= descender) {
    throw new Error(
      `ascender (${ascender}) must be greater than descender (${descender}) so the em box has a positive height.`
    );
  }
  if (sideBearing !== undefined) {
    assertFiniteWithin('sideBearing', sideBearing, MAX_FONT_UNIT_MAGNITUDE);
  }
}

/** Letters that can't name a glyph: control, surrogate, unassigned, line/paragraph separators. */
const UNPRINTABLE_LETTER = /[\p{Cc}\p{Cs}\p{Cn}\p{Zl}\p{Zp}]/u;

export function assertPrintableLetter(letter: string): void {
  if ([...letter].length !== 1 || UNPRINTABLE_LETTER.test(letter)) {
    const shown = JSON.stringify(letter);
    throw new Error(
      `Glyph letter must be exactly one character, and a printable one, received ${shown}.`
    );
  }
}

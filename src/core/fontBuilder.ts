import { Font, Glyph, Path } from 'opentype.js';
import { buildGlyphFromSvg } from './glyphBuilder.js';

/** Maps each letter (e.g. `"A"`, `"a"`) to its monogram SVG markup. */
export type LetterSvgMap = Readonly<Record<string, string>>;

export interface MonogramFontOptions {
  /** Font family name shown by the OS and design software's font picker. */
  familyName: string;
  /** Defaults to `"Regular"`. */
  styleName?: string;
  /** Font design grid resolution. Defaults to `1000`, the OpenType norm. */
  unitsPerEm?: number;
  /** Defaults to 80% of `unitsPerEm`. */
  ascender?: number;
  /** Must be negative or zero. Defaults to `ascender - unitsPerEm`. */
  descender?: number;
  /** Horizontal padding reserved around each glyph, in font units. */
  sideBearing?: number;
}

const DEFAULT_UNITS_PER_EM = 1000;
const DEFAULT_ASCENDER_RATIO = 0.8;

/**
 * Assembles a complete, installable OpenType font from a set of monogram
 * letter SVGs — one glyph per entry, each scaled to a shared baseline so the
 * finished font can be typed like any other, instead of every letter being
 * imported into a design as a separate image.
 */
export function buildMonogramFont(
  letters: LetterSvgMap,
  options: MonogramFontOptions
): Font {
  const letterEntries = Object.entries(letters);
  if (letterEntries.length === 0) {
    throw new Error(
      'At least one letter SVG must be provided to build a font.'
    );
  }

  const unitsPerEm = options.unitsPerEm ?? DEFAULT_UNITS_PER_EM;
  const ascender =
    options.ascender ?? Math.round(unitsPerEm * DEFAULT_ASCENDER_RATIO);
  const descender = options.descender ?? ascender - unitsPerEm;
  if (descender > 0) {
    throw new Error(
      `descender must be negative or zero, received ${descender}.`
    );
  }

  const notdefGlyph = new Glyph({
    name: '.notdef',
    advanceWidth: Math.round(unitsPerEm / 2),
    path: new Path(),
  });

  const glyphs: Glyph[] = [notdefGlyph];
  for (const [letter, svgMarkup] of letterEntries) {
    glyphs.push(
      buildGlyphFromSvg({
        letter,
        svgMarkup,
        unitsPerEm,
        ascender,
        descender,
        sideBearing: options.sideBearing,
      })
    );
  }

  return new Font({
    familyName: options.familyName,
    styleName: options.styleName ?? 'Regular',
    unitsPerEm,
    ascender,
    descender,
    glyphs,
  });
}

/** Serializes a font built by {@link buildMonogramFont} to OTF/TTF bytes. */
export function fontToArrayBuffer(font: Font): ArrayBuffer {
  return font.toArrayBuffer();
}

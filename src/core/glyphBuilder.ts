import { Glyph, Path } from 'opentype.js';
import { appendSvgPathData, type PointTransform } from './svgPath.js';
import { parseSvgDocument } from './svgDocument.js';

export interface GlyphBuildOptions {
  /** The single character this glyph represents, e.g. `"A"`. */
  letter: string;
  /** Raw SVG markup for the monogram artwork of `letter`. */
  svgMarkup: string;
  unitsPerEm: number;
  ascender: number;
  descender: number;
  /**
   * Horizontal whitespace reserved on each side of the glyph, in font
   * units. Defaults to 5% of `unitsPerEm`.
   */
  sideBearing?: number;
}

/**
 * Converts a single letter's monogram SVG into an opentype.js {@link Glyph},
 * scaled uniformly (aspect ratio preserved) to fill the font's vertical
 * metrics and centered within its advance width.
 */
export function buildGlyphFromSvg(options: GlyphBuildOptions): Glyph {
  const codePoint = options.letter.codePointAt(0);
  if (codePoint === undefined || [...options.letter].length !== 1) {
    throw new Error(
      `Glyph letter must be exactly one character, received "${options.letter}".`
    );
  }

  const { pathData, viewBox } = parseSvgDocument(options.svgMarkup);
  if (viewBox.width <= 0 || viewBox.height <= 0) {
    throw new Error(
      `SVG for letter "${options.letter}" has a non-positive viewBox size.`
    );
  }

  const glyphHeight = options.ascender - options.descender;
  const scale = glyphHeight / viewBox.height;
  const sideBearing = options.sideBearing ?? options.unitsPerEm * 0.05;
  const scaledWidth = viewBox.width * scale;
  const advanceWidth = scaledWidth + sideBearing * 2;

  const transform: PointTransform = (x, y) => ({
    x: (x - viewBox.minX) * scale + sideBearing,
    y: options.descender + (viewBox.height - (y - viewBox.minY)) * scale,
  });

  const path = new Path();
  for (const d of pathData) {
    appendSvgPathData(path, d, transform);
  }

  return new Glyph({
    name: options.letter,
    unicode: codePoint,
    advanceWidth,
    path,
  });
}

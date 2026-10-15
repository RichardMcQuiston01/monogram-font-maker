import { Glyph, Path } from 'opentype.js';
import { appendSvgPathData, type PointTransform } from './svgPath.js';
import { parseSvgDocument, type ParsedSvgDocument } from './svgDocument.js';
import { normalizeEvenOddWinding } from './windingRule.js';
import {
  MAX_ADVANCE_WIDTH,
  MAX_FONT_UNIT_MAGNITUDE,
  assertPrintableLetter,
  assertValidFontMetrics,
} from './fontMetrics.js';

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
  assertPrintableLetter(options.letter);
  const codePoint = options.letter.codePointAt(0) as number;
  const letterLabel = JSON.stringify(options.letter);

  assertValidFontMetrics(options);

  let parsedSvg: ParsedSvgDocument;
  try {
    parsedSvg = parseSvgDocument(options.svgMarkup);
  } catch (error) {
    throw new Error(
      `SVG for letter ${letterLabel} is invalid: ${errorMessage(error)}`,
      { cause: error }
    );
  }
  const { paths, viewBox } = parsedSvg;
  if (
    !Number.isFinite(viewBox.width) ||
    !Number.isFinite(viewBox.height) ||
    viewBox.width <= 0 ||
    viewBox.height <= 0
  ) {
    throw new Error(
      `SVG for letter ${letterLabel} has a non-positive viewBox size, or one that is not finite (${viewBox.width} x ${viewBox.height}).`
    );
  }

  const glyphHeight = options.ascender - options.descender;
  const scale = glyphHeight / viewBox.height;
  const sideBearing = options.sideBearing ?? options.unitsPerEm * 0.05;
  const scaledWidth = viewBox.width * scale;
  const advanceWidth = scaledWidth + sideBearing * 2;
  if (
    !Number.isFinite(advanceWidth) ||
    advanceWidth <= 0 ||
    advanceWidth > MAX_ADVANCE_WIDTH
  ) {
    throw new Error(
      `Glyph ${letterLabel} would have an advance width of ${advanceWidth} font units; it must be between 0 and ${MAX_ADVANCE_WIDTH}. Check the SVG viewBox ${viewBox.width} x ${viewBox.height} and the sideBearing.`
    );
  }

  const transform: PointTransform = (x, y) => {
    const point = {
      x: (x - viewBox.minX) * scale + sideBearing,
      y: options.descender + (viewBox.height - (y - viewBox.minY)) * scale,
    };
    if (
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y) ||
      Math.abs(point.x) > MAX_FONT_UNIT_MAGNITUDE ||
      Math.abs(point.y) > MAX_FONT_UNIT_MAGNITUDE
    ) {
      throw new Error(
        `SVG for letter ${letterLabel} has a point (${x}, ${y}) that lands outside the font's coordinate range (${point.x}, ${point.y}). Check that the path coordinates fit the viewBox.`
      );
    }
    return point;
  };

  const path = new Path();
  for (const { d, fillRule } of paths) {
    const elementPath = new Path();
    try {
      appendSvgPathData(elementPath, d, transform);
      const commands =
        fillRule === 'evenodd'
          ? normalizeEvenOddWinding(elementPath.commands)
          : elementPath.commands;
      path.commands.push(...commands);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith('SVG for letter')
      ) {
        throw error;
      }
      throw new Error(
        `SVG for letter ${letterLabel} has an unusable path: ${errorMessage(error)}`,
        { cause: error }
      );
    }
  }

  return new Glyph({
    name: options.letter,
    unicode: codePoint,
    advanceWidth,
    path,
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

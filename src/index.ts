export {
  buildMonogramFont,
  fontToArrayBuffer,
  type LetterSvgMap,
  type MonogramFontOptions,
} from './core/fontBuilder.js';
export {
  buildGlyphFromSvg,
  type GlyphBuildOptions,
} from './core/glyphBuilder.js';
export {
  parseSvgDocument,
  type ParsedSvgDocument,
  type SvgViewBox,
} from './core/svgDocument.js';
export { extractLettersFromZip, type ZipInput } from './core/zip.js';

import type { Font } from 'opentype.js';
import {
  buildMonogramFont,
  fontToArrayBuffer,
  type LetterSvgMap,
  type MonogramFontOptions,
} from './core/fontBuilder.js';
import { extractLettersFromZip, type ZipInput } from './core/zip.js';

/**
 * Builds a monogram font and serializes it straight to OTF/TTF bytes — the
 * one call most callers need. Works in the browser or Node, since it only
 * touches in-memory SVG strings.
 */
export function generateMonogramFont(
  letters: LetterSvgMap,
  options: MonogramFontOptions
): ArrayBuffer {
  const font: Font = buildMonogramFont(letters, options);
  return fontToArrayBuffer(font);
}

/**
 * Convenience wrapper for the common case of a single ZIP upload: extracts
 * one SVG per letter from the archive, then builds and serializes the font.
 */
export async function generateMonogramFontFromZip(
  zipData: ZipInput,
  options: MonogramFontOptions
): Promise<ArrayBuffer> {
  const letters = await extractLettersFromZip(zipData);
  return generateMonogramFont(letters, options);
}

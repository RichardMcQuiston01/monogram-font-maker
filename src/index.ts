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
export {
  extractLettersFromZip,
  type FilenameMatchOptions,
  type ZipInput,
} from './core/zip.js';
export {
  compileFilenamePattern,
  matchFilenamePattern,
  DEFAULT_FILENAME_PATTERN,
  type FilenamePattern,
} from './core/filenamePattern.js';

import type { Font } from 'opentype.js';
import {
  buildMonogramFont,
  fontToArrayBuffer,
  type LetterSvgMap,
  type MonogramFontOptions,
} from './core/fontBuilder.js';
import {
  extractLettersFromZip,
  type FilenameMatchOptions,
  type ZipInput,
} from './core/zip.js';

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
 * Pass `filenameOptions.filenamePattern` if the archive doesn't use the
 * default `A.svg` naming (see {@link FilenamePattern}).
 */
export async function generateMonogramFontFromZip(
  zipData: ZipInput,
  options: MonogramFontOptions,
  filenameOptions?: FilenameMatchOptions
): Promise<ArrayBuffer> {
  const letters = await extractLettersFromZip(zipData, filenameOptions);
  return generateMonogramFont(letters, options);
}

/** Most archive/directory entries inspected while looking for letter SVGs. */
export const MAX_INPUT_ENTRIES = 1000;

/** Most decoded bytes accepted for a single letter SVG. */
export const MAX_SVG_BYTES = 5 * 1024 * 1024;

/** Most decoded bytes accepted across all letter SVGs in one input. */
export const MAX_TOTAL_SVG_BYTES = 50 * 1024 * 1024;

/** Longest SVG string `parseSvgDocument` will scan. */
export const MAX_SVG_LENGTH = MAX_SVG_BYTES;

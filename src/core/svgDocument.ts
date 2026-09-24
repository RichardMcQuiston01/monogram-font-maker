/** The viewBox (or width/height) a monogram SVG's coordinates are drawn in. */
export interface SvgViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

export interface ParsedSvgDocument {
  /** The `d` attribute of every top-level `<path>` element, in document order. */
  pathData: string[];
  viewBox: SvgViewBox;
}

const SVG_OPEN_TAG_PATTERN = /<svg\b[^>]*>/i;
const VIEW_BOX_ATTRIBUTE_PATTERN = /\bviewBox\s*=\s*"([^"]+)"/i;
const WIDTH_ATTRIBUTE_PATTERN = /\bwidth\s*=\s*"([\d.]+)/i;
const HEIGHT_ATTRIBUTE_PATTERN = /\bheight\s*=\s*"([\d.]+)/i;
const PATH_D_ATTRIBUTE_PATTERN = /<path\b[^>]*\bd\s*=\s*"([^"]*)"/gi;

/**
 * Extracts the outline data and coordinate space of a monogram SVG.
 *
 * This is a deliberately small, dependency-free reader: it supports the
 * shape monogram/laser artwork is exported in — a single `<svg>` root
 * carrying a `viewBox` (or `width`/`height`) and one or more `<path
 * d="...">` elements — rather than the full SVG specification. Groups,
 * transforms, and non-`<path>` shapes (`<circle>`, `<rect>`, text, etc.) are
 * not resolved; flatten artwork to paths before use.
 */
export function parseSvgDocument(svgMarkup: string): ParsedSvgDocument {
  const svgOpenTagMatch = svgMarkup.match(SVG_OPEN_TAG_PATTERN);
  if (!svgOpenTagMatch) {
    throw new Error('Not a valid SVG document: missing an <svg> root element.');
  }
  const svgOpenTag = svgOpenTagMatch[0];

  const viewBox = readViewBox(svgOpenTag);

  const pathData: string[] = [];
  for (const match of svgMarkup.matchAll(PATH_D_ATTRIBUTE_PATTERN)) {
    const d = match[1].trim();
    if (d.length > 0) {
      pathData.push(d);
    }
  }
  if (pathData.length === 0) {
    throw new Error(
      'SVG document contains no <path d="..."> elements with outline data.'
    );
  }

  return { pathData, viewBox };
}

function readViewBox(svgOpenTag: string): SvgViewBox {
  const viewBoxMatch = svgOpenTag.match(VIEW_BOX_ATTRIBUTE_PATTERN);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1]
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const [minX, minY, width, height] = parts;
    if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) {
      throw new Error(`Malformed SVG viewBox: "${viewBoxMatch[1]}".`);
    }
    return { minX, minY, width, height };
  }

  const widthMatch = svgOpenTag.match(WIDTH_ATTRIBUTE_PATTERN);
  const heightMatch = svgOpenTag.match(HEIGHT_ATTRIBUTE_PATTERN);
  if (!widthMatch || !heightMatch) {
    throw new Error(
      'SVG document must declare a viewBox, or both width and height, so glyph coordinates can be scaled.'
    );
  }
  return {
    minX: 0,
    minY: 0,
    width: Number(widthMatch[1]),
    height: Number(heightMatch[1]),
  };
}

import { MAX_SVG_LENGTH } from './inputLimits.js';

/** The viewBox (or width/height) a monogram SVG's coordinates are drawn in. */
export interface SvgViewBox {
  minX: number;
  minY: number;
  width: number;
  height: number;
}

/** SVG `fill-rule`: how overlapping or nested contours decide what's filled. */
export type SvgFillRule = 'nonzero' | 'evenodd';

export interface SvgPathElement {
  /** The `d` attribute. */
  d: string;
  /** The effective `fill-rule`, inherited from ancestors (default nonzero). */
  fillRule: SvgFillRule;
}

export interface ParsedSvgDocument {
  /** The `d` attribute of every painted `<path>` element, in document order. */
  pathData: string[];
  /** Same paths as `pathData`, with the fill rule each is painted under. */
  paths: SvgPathElement[];
  viewBox: SvgViewBox;
}

/** Elements whose children are templates or metadata, never painted directly. */
const NON_RENDERED_ELEMENTS: ReadonlySet<string> = new Set([
  'defs',
  'clipPath',
  'mask',
  'symbol',
  'marker',
  'pattern',
  'metadata',
  'title',
  'desc',
  'style',
  'script',
  'foreignObject',
]);

const NUMBER_SOURCE = '[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?';
const NUMBER_PATTERN = new RegExp(`^${NUMBER_SOURCE}$`);
const LENGTH_PATTERN = new RegExp(`^(${NUMBER_SOURCE})([a-zA-Z%]*)$`);

/** Pixels per absolute CSS unit, the only length units a scaler can resolve. */
const PIXELS_PER_UNIT: Readonly<Record<string, number>> = {
  '': 1,
  px: 1,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  pt: 96 / 72,
  pc: 16,
};

interface XmlElement {
  name: string;
  attributes: Map<string, string>;
}

const XML_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body) => {
    if (body.startsWith('#x')) {
      return safeFromCodePoint(parseInt(body.slice(2), 16), whole);
    }
    if (body.startsWith('#')) {
      return safeFromCodePoint(parseInt(body.slice(1), 10), whole);
    }
    return XML_ENTITIES[body] ?? whole;
  });
}

function safeFromCodePoint(codePoint: number, fallback: string): string {
  return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : fallback;
}

/** Drops an XML namespace prefix: `svg:path` -> `path`. */
function localName(qualifiedName: string): string {
  const colon = qualifiedName.indexOf(':');
  return colon === -1 ? qualifiedName : qualifiedName.slice(colon + 1);
}

type XmlEvent =
  | { type: 'open'; element: XmlElement; selfClosing: boolean }
  | { type: 'close'; name: string };

/**
 * A minimal, non-validating XML tokenizer: yields element open/close events
 * and skips comments, CDATA, processing instructions, and the DOCTYPE (whose
 * entities are never expanded). Reads attributes in single or double quotes.
 * Character data is ignored, since monogram artwork carries all geometry in
 * attributes.
 */
function* tokenizeXml(markup: string): Generator<XmlEvent> {
  let position = 0;

  const skipPast = (terminator: string, what: string): void => {
    const end = markup.indexOf(terminator, position);
    if (end === -1) {
      throw new Error(`Malformed SVG: unterminated ${what}.`);
    }
    position = end + terminator.length;
  };

  while (position < markup.length) {
    const tagStart = markup.indexOf('<', position);
    if (tagStart === -1) {
      return;
    }
    position = tagStart;

    if (markup.startsWith('<!--', position)) {
      position += 4;
      skipPast('-->', 'comment');
    } else if (markup.startsWith('<![CDATA[', position)) {
      position += 9;
      skipPast(']]>', 'CDATA section');
    } else if (markup.startsWith('<?', position)) {
      position += 2;
      skipPast('?>', 'processing instruction');
    } else if (markup.startsWith('<!', position)) {
      position += 2;
      skipDeclaration();
    } else if (markup.startsWith('</', position)) {
      position += 2;
      const end = markup.indexOf('>', position);
      if (end === -1) {
        throw new Error('Malformed SVG: unterminated closing tag.');
      }
      yield {
        type: 'close',
        name: localName(markup.slice(position, end).trim()),
      };
      position = end + 1;
    } else {
      position += 1;
      yield readOpenTag();
    }
  }

  /** Skips a `<!DOCTYPE ...>`, including a bracketed internal subset. */
  function skipDeclaration(): void {
    let bracketDepth = 0;
    while (position < markup.length) {
      const character = markup[position];
      position += 1;
      if (character === '[') {
        bracketDepth += 1;
      } else if (character === ']') {
        bracketDepth -= 1;
      } else if (character === '>' && bracketDepth <= 0) {
        return;
      }
    }
    throw new Error('Malformed SVG: unterminated declaration.');
  }

  function readOpenTag(): XmlEvent {
    const nameMatch = /^[^\s/>]+/.exec(markup.slice(position, position + 256));
    if (!nameMatch) {
      throw new Error('Malformed SVG: element is missing a name.');
    }
    position += nameMatch[0].length;
    const attributes = new Map<string, string>();

    for (;;) {
      while (position < markup.length && /\s/.test(markup[position])) {
        position += 1;
      }
      if (position >= markup.length) {
        throw new Error('Malformed SVG: unterminated element tag.');
      }
      if (markup[position] === '>') {
        position += 1;
        return openEvent(nameMatch[0], attributes, false);
      }
      if (markup.startsWith('/>', position)) {
        position += 2;
        return openEvent(nameMatch[0], attributes, true);
      }

      const attributeName = /^[^\s=/>]+/.exec(
        markup.slice(position, position + 256)
      );
      if (!attributeName) {
        throw new Error(
          `Malformed SVG: unexpected character "${markup[position]}" in <${nameMatch[0]}>.`
        );
      }
      position += attributeName[0].length;
      while (position < markup.length && /\s/.test(markup[position])) {
        position += 1;
      }
      if (markup[position] !== '=') {
        throw new Error(
          `Malformed SVG: attribute "${attributeName[0]}" has no value.`
        );
      }
      position += 1;
      while (position < markup.length && /\s/.test(markup[position])) {
        position += 1;
      }
      const quote = markup[position];
      if (quote !== '"' && quote !== "'") {
        throw new Error(
          `Malformed SVG: attribute "${attributeName[0]}" value must be quoted.`
        );
      }
      const valueEnd = markup.indexOf(quote, position + 1);
      if (valueEnd === -1) {
        throw new Error(
          `Malformed SVG: attribute "${attributeName[0]}" has an unterminated value.`
        );
      }
      attributes.set(
        attributeName[0],
        decodeEntities(markup.slice(position + 1, valueEnd))
      );
      position = valueEnd + 1;
    }
  }

  function openEvent(
    qualifiedName: string,
    attributes: Map<string, string>,
    selfClosing: boolean
  ): XmlEvent {
    return {
      type: 'open',
      element: { name: localName(qualifiedName), attributes },
      selfClosing,
    };
  }
}

/** Reads `fill-rule` from a presentation attribute or inline `style`. */
function readFillRule(element: XmlElement): SvgFillRule | null {
  const fromStyle = /(?:^|;)\s*fill-rule\s*:\s*([a-z]+)/i.exec(
    element.attributes.get('style') ?? ''
  );
  const value = (fromStyle?.[1] ?? element.attributes.get('fill-rule'))
    ?.trim()
    .toLowerCase();
  return value === 'evenodd' || value === 'nonzero' ? value : null;
}

interface OpenElementState {
  name: string;
  fillRule: SvgFillRule;
  /** True inside `<defs>`, `<clipPath>`, comments' siblings, etc. */
  notRendered: boolean;
  hasTransform: boolean;
}

/**
 * Extracts the outline data and coordinate space of a monogram SVG.
 *
 * This is a deliberately small, dependency-free reader for the shape
 * monogram/laser artwork is exported in: a single `<svg>` root carrying a
 * `viewBox` (or `width`/`height`) and one or more painted `<path d="...">`
 * elements. Paths inside `<defs>`, `<clipPath>`, `<mask>`, and other
 * non-rendered containers are ignored. Transforms and non-`<path>` shapes
 * (`<circle>`, `<rect>`, text, etc.) are not resolved; a `transform` on a
 * painted path or any ancestor is rejected so the font can't silently
 * disagree with the artwork. Flatten artwork to paths before use.
 */
export function parseSvgDocument(svgMarkup: string): ParsedSvgDocument {
  if (svgMarkup.length > MAX_SVG_LENGTH) {
    throw new Error(
      `SVG document is ${svgMarkup.length} characters, more than the limit of ${MAX_SVG_LENGTH}.`
    );
  }

  const openElements: OpenElementState[] = [];
  const paths: SvgPathElement[] = [];
  let viewBox: SvgViewBox | null = null;
  let sawRoot = false;

  for (const event of tokenizeXml(svgMarkup)) {
    if (event.type === 'close') {
      const matchIndex = openElements
        .map((e) => e.name)
        .lastIndexOf(event.name);
      if (matchIndex === -1) {
        throw new Error(
          `Malformed SVG: unexpected closing tag </${event.name}>.`
        );
      }
      openElements.length = matchIndex;
      continue;
    }

    const { element } = event;
    const parent = openElements[openElements.length - 1];

    if (!sawRoot) {
      if (element.name !== 'svg') {
        throw new Error(
          'Not a valid SVG document: missing an <svg> root element.'
        );
      }
      sawRoot = true;
      viewBox = readViewBox(element.attributes);
    }

    const state: OpenElementState = {
      name: element.name,
      fillRule: readFillRule(element) ?? parent?.fillRule ?? 'nonzero',
      notRendered:
        (parent?.notRendered ?? false) ||
        NON_RENDERED_ELEMENTS.has(element.name),
      hasTransform:
        (parent?.hasTransform ?? false) ||
        (element.attributes.get('transform')?.trim() ?? '') !== '',
    };

    if (element.name === 'path' && !state.notRendered) {
      const d = element.attributes.get('d')?.trim() ?? '';
      if (d.length > 0) {
        if (state.hasTransform) {
          throw new Error(
            'A <path> sits under a transform attribute, which is not supported yet. Apply the transform to the path data (e.g. "Expand" or "Apply Transformations" in your editor) and re-export.'
          );
        }
        paths.push({ d, fillRule: state.fillRule });
      }
    }

    if (!event.selfClosing) {
      openElements.push(state);
    }
  }

  if (!sawRoot || viewBox === null) {
    throw new Error('Not a valid SVG document: missing an <svg> root element.');
  }
  if (paths.length === 0) {
    throw new Error(
      'SVG document contains no <path d="..."> elements with outline data.'
    );
  }

  return { pathData: paths.map((p) => p.d), paths, viewBox };
}

function readViewBox(rootAttributes: ReadonlyMap<string, string>): SvgViewBox {
  const viewBoxText = rootAttributes.get('viewBox');
  if (viewBoxText !== undefined) {
    const parts = viewBoxText.trim().split(/[\s,]+/);
    if (
      parts.length !== 4 ||
      !parts.every((part) => NUMBER_PATTERN.test(part))
    ) {
      throw new Error(`Malformed SVG viewBox: "${viewBoxText}".`);
    }
    const [minX, minY, width, height] = parts.map(Number);
    if (![minX, minY, width, height].every(Number.isFinite)) {
      throw new Error(
        `SVG viewBox must be finite numbers, received "${viewBoxText}".`
      );
    }
    return { minX, minY, width, height };
  }

  const widthText = rootAttributes.get('width');
  const heightText = rootAttributes.get('height');
  if (widthText === undefined || heightText === undefined) {
    throw new Error(
      'SVG document must declare a viewBox, or both width and height, so glyph coordinates can be scaled.'
    );
  }
  return {
    minX: 0,
    minY: 0,
    width: parseLength('width', widthText),
    height: parseLength('height', heightText),
  };
}

/** Parses a root `width`/`height` into pixels, rejecting relative units. */
function parseLength(attributeName: string, text: string): number {
  const match = LENGTH_PATTERN.exec(text.trim());
  const pixelsPerUnit = match
    ? PIXELS_PER_UNIT[match[2].toLowerCase()]
    : undefined;
  if (!match || pixelsPerUnit === undefined) {
    throw new Error(
      `SVG ${attributeName}="${text}" can't be resolved to a size. Use a viewBox, or a plain number or absolute unit (px, pt, pc, mm, cm, in).`
    );
  }
  const value = Number(match[1]) * pixelsPerUnit;
  if (!Number.isFinite(value)) {
    throw new Error(`SVG ${attributeName}="${text}" is not a finite size.`);
  }
  return value;
}

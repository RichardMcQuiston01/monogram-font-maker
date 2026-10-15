import { describe, expect, it } from 'vitest';
import { buildGlyphFromSvg } from '../src/core/glyphBuilder.js';

const RECTANGLE_SVG =
  '<svg viewBox="0 0 50 100"><path d="M0,0 L50,0 L50,100 L0,100 Z"/></svg>';

describe('buildGlyphFromSvg', () => {
  it('scales the SVG to fill the vertical metrics and centers it horizontally', () => {
    const glyph = buildGlyphFromSvg({
      letter: 'I',
      svgMarkup: RECTANGLE_SVG,
      unitsPerEm: 1000,
      ascender: 800,
      descender: -200,
    });

    expect(glyph.name).toBe('I');
    expect(glyph.unicode).toBe('I'.codePointAt(0));
    // scale = (800 - -200) / 100 = 10; sideBearing = 1000 * 0.05 = 50
    // advanceWidth = 50 * 10 + 50 * 2 = 600
    expect(glyph.advanceWidth).toBe(600);
    expect(glyph.path.commands).toEqual([
      { type: 'M', x: 50, y: 800 },
      { type: 'L', x: 550, y: 800 },
      { type: 'L', x: 550, y: -200 },
      { type: 'L', x: 50, y: -200 },
      { type: 'Z' },
    ]);
  });

  it('honors an explicit sideBearing', () => {
    const glyph = buildGlyphFromSvg({
      letter: 'I',
      svgMarkup: RECTANGLE_SVG,
      unitsPerEm: 1000,
      ascender: 800,
      descender: -200,
      sideBearing: 0,
    });

    expect(glyph.advanceWidth).toBe(500);
    expect((glyph.path.commands[0] as { x: number }).x).toBe(0);
  });

  it('rejects a letter that is not exactly one character', () => {
    expect(() =>
      buildGlyphFromSvg({
        letter: 'AB',
        svgMarkup: RECTANGLE_SVG,
        unitsPerEm: 1000,
        ascender: 800,
        descender: -200,
      })
    ).toThrow(/exactly one character/i);

    expect(() =>
      buildGlyphFromSvg({
        letter: '',
        svgMarkup: RECTANGLE_SVG,
        unitsPerEm: 1000,
        ascender: 800,
        descender: -200,
      })
    ).toThrow(/exactly one character/i);
  });

  it('rejects an SVG with a non-positive viewBox size', () => {
    expect(() =>
      buildGlyphFromSvg({
        letter: 'I',
        svgMarkup: '<svg viewBox="0 0 0 100"><path d="M0,0 Z"/></svg>',
        unitsPerEm: 1000,
        ascender: 800,
        descender: -200,
      })
    ).toThrow(/non-positive viewBox/i);
  });

  it('turns an evenodd hole into a nonzero hole', () => {
    const glyph = buildGlyphFromSvg({
      letter: 'O',
      svgMarkup:
        '<svg viewBox="0 0 10 10" fill-rule="evenodd"><path d="M0,0 H10 V10 H0 Z M2,2 H8 V8 H2 Z"/></svg>',
      unitsPerEm: 1000,
      ascender: 800,
      descender: -200,
    });

    // viewBox 10 -> 1000 units: scale 100, sideBearing 50, y offset -200
    expect(windingNumberAt(glyph.path.commands, 500, 300)).toBe(0); // hole
    expect(Math.abs(windingNumberAt(glyph.path.commands, 100, 300))).toBe(1); // ring
  });

  it('keeps same-direction nonzero contours filled', () => {
    const glyph = buildGlyphFromSvg({
      letter: 'O',
      svgMarkup:
        '<svg viewBox="0 0 10 10"><path d="M0,0 H10 V10 H0 Z M2,2 H8 V8 H2 Z"/></svg>',
      unitsPerEm: 1000,
      ascender: 800,
      descender: -200,
    });

    expect(Math.abs(windingNumberAt(glyph.path.commands, 500, 300))).toBe(2);
  });

  it('rejects evenodd contours that cross each other', () => {
    expect(() =>
      buildGlyphFromSvg({
        letter: 'X',
        svgMarkup:
          '<svg viewBox="0 0 10 10" fill-rule="evenodd"><path d="M0,0 H6 V6 H0 Z M3,3 H9 V9 H3 Z"/></svg>',
        unitsPerEm: 1000,
        ascender: 800,
        descender: -200,
      })
    ).toThrow(/cross each other/i);
  });

  it('rejects metrics and letters that would corrupt the font', () => {
    const base = {
      letter: 'A',
      svgMarkup: RECTANGLE_SVG,
      unitsPerEm: 1000,
      ascender: 800,
      descender: -200,
    };

    expect(() => buildGlyphFromSvg({ ...base, unitsPerEm: -1000 })).toThrow(
      /unitsPerEm/
    );
    expect(() => buildGlyphFromSvg({ ...base, unitsPerEm: 1e9 })).toThrow(
      /unitsPerEm/
    );
    expect(() =>
      buildGlyphFromSvg({ ...base, ascender: -10, descender: -10 })
    ).toThrow(/greater than descender/);
    expect(() => buildGlyphFromSvg({ ...base, letter: '\n' })).toThrow(
      /printable/
    );
    expect(() => buildGlyphFromSvg({ ...base, sideBearing: Infinity })).toThrow(
      /sideBearing/
    );
    expect(() =>
      buildGlyphFromSvg({
        ...base,
        svgMarkup:
          '<svg viewBox="0 0 0.001 0.001"><path d="M0,0 L100000,100000 Z"/></svg>',
      })
    ).toThrow(/letter "A".*outside the font's coordinate range/);
    expect(() =>
      buildGlyphFromSvg({
        ...base,
        svgMarkup: '<svg viewBox="0 0 1e30 10"><path d="M0,0 L1,1 Z"/></svg>',
      })
    ).toThrow(/advance width/);
  });
});

/** Nonzero winding number of a line-only path around a point. */
function windingNumberAt(
  commands: ReadonlyArray<{ type: string; x?: number; y?: number }>,
  pointX: number,
  pointY: number
): number {
  let winding = 0;
  let start = { x: 0, y: 0 };
  let current = { x: 0, y: 0 };
  const edge = (to: { x: number; y: number }): void => {
    const from = current;
    if (from.y <= pointY && to.y > pointY) {
      if (
        (to.x - from.x) * (pointY - from.y) -
          (pointX - from.x) * (to.y - from.y) >
        0
      )
        winding += 1;
    } else if (from.y > pointY && to.y <= pointY) {
      if (
        (to.x - from.x) * (pointY - from.y) -
          (pointX - from.x) * (to.y - from.y) <
        0
      )
        winding -= 1;
    }
    current = to;
  };
  for (const command of commands) {
    if (command.type === 'M') {
      current = start = { x: command.x as number, y: command.y as number };
    } else if (command.type === 'L') {
      edge({ x: command.x as number, y: command.y as number });
    } else if (command.type === 'Z') {
      edge(start);
    }
  }
  return winding;
}

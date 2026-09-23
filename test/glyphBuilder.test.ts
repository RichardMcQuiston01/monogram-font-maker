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
});

import { describe, expect, it } from 'vitest';
import { parseSvgDocument } from '../src/core/svgDocument.js';

describe('parseSvgDocument', () => {
  it('reads the viewBox and path data of a simple monogram SVG', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200">
      <path d="M0,0 L100,0 L100,200 Z" />
    </svg>`;

    const result = parseSvgDocument(svg);

    expect(result.viewBox).toEqual({
      minX: 0,
      minY: 0,
      width: 100,
      height: 200,
    });
    expect(result.pathData).toEqual(['M0,0 L100,0 L100,200 Z']);
  });

  it('accepts a comma-separated viewBox with an origin offset', () => {
    const svg = '<svg viewBox="10,20,30,40"><path d="M0,0 Z"/></svg>';

    expect(parseSvgDocument(svg).viewBox).toEqual({
      minX: 10,
      minY: 20,
      width: 30,
      height: 40,
    });
  });

  it('falls back to width/height when there is no viewBox', () => {
    const svg = '<svg width="64px" height="64px"><path d="M0,0 Z"/></svg>';

    expect(parseSvgDocument(svg).viewBox).toEqual({
      minX: 0,
      minY: 0,
      width: 64,
      height: 64,
    });
  });

  it('collects every top-level path, in document order', () => {
    const svg = `<svg viewBox="0 0 10 10">
      <path d="M0,0 L1,1"/>
      <path d="M2,2 L3,3"/>
    </svg>`;

    expect(parseSvgDocument(svg).pathData).toEqual(['M0,0 L1,1', 'M2,2 L3,3']);
  });

  it('throws when there is no <svg> root element', () => {
    expect(() => parseSvgDocument('<path d="M0,0 Z"/>')).toThrow(
      /missing an <svg> root element/i
    );
  });

  it('throws when neither a viewBox nor width/height is present', () => {
    expect(() => parseSvgDocument('<svg><path d="M0,0 Z"/></svg>')).toThrow(
      /viewBox/i
    );
  });

  it('throws when there are no path elements', () => {
    expect(() => parseSvgDocument('<svg viewBox="0 0 10 10"></svg>')).toThrow(
      /no <path/i
    );
  });
});

describe('parseSvgDocument robustness', () => {
  it('reads single-quoted attributes', () => {
    const parsed = parseSvgDocument(
      "<svg viewBox='0 0 10 20'><path d='M0,0 L10,10 Z'/></svg>"
    );

    expect(parsed.viewBox).toEqual({ minX: 0, minY: 0, width: 10, height: 20 });
    expect(parsed.pathData).toEqual(['M0,0 L10,10 Z']);
  });

  it('does not mistake stroke-width / data-width / line-height for the size', () => {
    const parsed = parseSvgDocument(
      '<svg stroke-width="2" data-width="3" line-height="4" width="100" height="80"><path d="M0,0 L1,1"/></svg>'
    );

    expect(parsed.viewBox).toEqual({
      minX: 0,
      minY: 0,
      width: 100,
      height: 80,
    });
  });

  it('converts absolute units and rejects relative ones', () => {
    const inches = parseSvgDocument(
      '<svg width="1in" height="2in"><path d="M0,0 L1,1"/></svg>'
    );
    expect(inches.viewBox).toMatchObject({ width: 96, height: 192 });

    for (const width of ['100%', '10em', '1e3x']) {
      expect(() =>
        parseSvgDocument(
          `<svg width="${width}" height="10"><path d="M0,0 L1,1"/></svg>`
        )
      ).toThrow(/can't be resolved/i);
    }
    const exponent = parseSvgDocument(
      '<svg width="1e3" height="10"><path d="M0,0 L1,1"/></svg>'
    );
    expect(exponent.viewBox.width).toBe(1000);
  });

  it('rejects non-finite viewBox numbers', () => {
    for (const viewBox of ['0 0 Infinity 10', '0 0 1e999 10', '0 0 abc 10']) {
      expect(() =>
        parseSvgDocument(
          `<svg viewBox="${viewBox}"><path d="M0,0 L1,1"/></svg>`
        )
      ).toThrow(/viewBox/i);
    }
  });

  it('ignores paths in comments, defs, clipPath, and other non-rendered containers', () => {
    const parsed = parseSvgDocument(
      `<svg viewBox="0 0 10 10">
        <!-- <path d="M9,9 L9,9"/> -->
        <defs><path d="M8,8 L8,8"/></defs>
        <clipPath id="c"><path d="M7,7 L7,7"/></clipPath>
        <g><path d="M1,1 L2,2"/></g>
      </svg>`
    );

    expect(parsed.pathData).toEqual(['M1,1 L2,2']);
  });

  it('rejects a transform on a painted path or any ancestor', () => {
    expect(() =>
      parseSvgDocument(
        '<svg viewBox="0 0 10 10"><g transform="translate(100 0)"><path d="M0,0 L1,1"/></g></svg>'
      )
    ).toThrow(/transform/i);
    expect(() =>
      parseSvgDocument(
        '<svg viewBox="0 0 10 10"><path transform="scale(2)" d="M0,0 L1,1"/></svg>'
      )
    ).toThrow(/transform/i);
  });

  it('accepts a transform that only touches unpainted markup', () => {
    const parsed = parseSvgDocument(
      '<svg viewBox="0 0 10 10"><defs><g transform="scale(2)"><path d="M5,5 L6,6"/></g></defs><path d="M0,0 L1,1"/></svg>'
    );

    expect(parsed.pathData).toEqual(['M0,0 L1,1']);
  });

  it('reports the effective fill-rule, inherited from the root and groups', () => {
    const parsed = parseSvgDocument(
      `<svg viewBox="0 0 10 10" fill-rule="evenodd">
        <path d="M0,0 L1,1"/>
        <g fill-rule="nonzero"><path d="M2,2 L3,3"/></g>
        <path style="fill:red; fill-rule: nonzero" d="M4,4 L5,5"/>
      </svg>`
    );

    expect(parsed.paths.map((path) => path.fillRule)).toEqual([
      'evenodd',
      'nonzero',
      'nonzero',
    ]);
  });

  it('rejects SVG over the length limit', () => {
    const huge = `<svg viewBox="0 0 1 1">${' '.repeat(6 * 1024 * 1024)}<path d="M0,0 L1,1"/></svg>`;

    expect(() => parseSvgDocument(huge)).toThrow(/more than the limit/i);
  });
});

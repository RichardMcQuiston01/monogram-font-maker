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

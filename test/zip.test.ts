import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import {
  extractLettersFromZip,
  matchLetterSvgFilename,
} from '../src/core/zip.js';

const SVG_A = '<svg viewBox="0 0 10 10"><path d="M0,0 L10,10 Z"/></svg>';
const SVG_B = '<svg viewBox="0 0 10 10"><path d="M0,0 L5,5 Z"/></svg>';

describe('matchLetterSvgFilename', () => {
  it('extracts the letter from a "<letter>.svg" filename', () => {
    expect(matchLetterSvgFilename('A.svg')).toBe('A');
    expect(matchLetterSvgFilename('b.SVG')).toBe('b');
  });

  it('returns null for anything else', () => {
    expect(matchLetterSvgFilename('README.md')).toBeNull();
    expect(matchLetterSvgFilename('AB.svg')).toBeNull();
  });
});

describe('extractLettersFromZip', () => {
  it('extracts one entry per single-letter SVG, at any folder depth, and ignores everything else', async () => {
    const zip = new JSZip();
    zip.file('A.svg', SVG_A);
    zip.file('b.svg', SVG_B);
    zip.file('README.md', 'not a monogram');
    zip.folder('extras')?.file('C.svg', SVG_A);
    const zipBytes = await zip.generateAsync({ type: 'uint8array' });

    const letters = await extractLettersFromZip(zipBytes);

    expect(letters).toEqual({ A: SVG_A, b: SVG_B, C: SVG_A });
  });

  it('throws on a duplicate letter', async () => {
    const zip = new JSZip();
    zip.file('A.svg', SVG_A);
    zip.file('A.SVG', SVG_B);
    const zipBytes = await zip.generateAsync({ type: 'uint8array' });

    await expect(extractLettersFromZip(zipBytes)).rejects.toThrow(/duplicate/i);
  });

  it('throws when the archive has no matching SVG files', async () => {
    const zip = new JSZip();
    zip.file('README.md', 'nothing here');
    const zipBytes = await zip.generateAsync({ type: 'uint8array' });

    await expect(extractLettersFromZip(zipBytes)).rejects.toThrow(
      /no single-letter SVG files/i
    );
  });
});

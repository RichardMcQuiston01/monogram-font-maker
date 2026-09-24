import { describe, expect, it } from 'vitest';
import { parse as parseFont } from 'opentype.js';
import {
  buildMonogramFont,
  fontToArrayBuffer,
} from '../src/core/fontBuilder.js';
import { generateMonogramFont } from '../src/index.js';

const LETTER_SVGS = {
  A: '<svg viewBox="0 0 60 100"><path d="M0,0 L60,0 L60,100 L0,100 Z"/></svg>',
  B: '<svg viewBox="0 0 40 100"><path d="M0,0 L40,0 L40,100 L0,100 Z"/></svg>',
};

describe('buildMonogramFont', () => {
  it('produces a font with one glyph per letter plus .notdef', () => {
    const font = buildMonogramFont(LETTER_SVGS, {
      familyName: 'Test Monogram',
    });

    expect(font.glyphs.length).toBe(3);
  });

  it('throws when no letters are provided', () => {
    expect(() => buildMonogramFont({}, { familyName: 'Empty' })).toThrow(
      /at least one letter/i
    );
  });

  it('rejects a positive descender', () => {
    expect(() =>
      buildMonogramFont(LETTER_SVGS, { familyName: 'Bad', descender: 50 })
    ).toThrow(/descender must be negative/i);
  });
});

describe('generateMonogramFont (round trip)', () => {
  it('produces bytes that opentype.js can parse back into the same glyphs', () => {
    const fontBytes = generateMonogramFont(LETTER_SVGS, {
      familyName: 'Test Monogram',
      styleName: 'Regular',
    });

    expect(fontBytes.byteLength).toBeGreaterThan(0);

    const parsed = parseFont(fontBytes);
    expect(parsed.glyphs.length).toBe(3);
    expect(parsed.charToGlyph('A').name).toBe('A');
    expect(parsed.charToGlyph('B').name).toBe('B');
  });

  it('matches building the font manually and serializing it', () => {
    const font = buildMonogramFont(LETTER_SVGS, {
      familyName: 'Test Monogram',
    });
    const bytes = fontToArrayBuffer(font);

    expect(bytes).toEqual(
      generateMonogramFont(LETTER_SVGS, { familyName: 'Test Monogram' })
    );
  });
});

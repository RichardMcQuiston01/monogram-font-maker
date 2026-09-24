import { describe, expect, it } from 'vitest';
import {
  compileFilenamePattern,
  matchFilenamePattern,
} from '../src/core/filenamePattern.js';

describe('compileFilenamePattern / matchFilenamePattern', () => {
  it('matches the default "{letter}.svg" pattern, case-insensitively on the extension', () => {
    const pattern = compileFilenamePattern('{letter}.svg');

    expect(matchFilenamePattern('A.svg', pattern)).toBe('A');
    expect(matchFilenamePattern('a.SVG', pattern)).toBe('a');
    expect(matchFilenamePattern('AB.svg', pattern)).toBeNull();
    expect(matchFilenamePattern('A.png', pattern)).toBeNull();
  });

  it('matches a leading wildcard plus a literal segment around {letter}', () => {
    const pattern = compileFilenamePattern('*_monogram_{letter}.svg');

    expect(matchFilenamePattern('butterfly_monogram_A.svg', pattern)).toBe('A');
    expect(matchFilenamePattern('x_monogram_A.svg', pattern)).toBe('A');
    // two characters where exactly one is expected before ".svg"
    expect(
      matchFilenamePattern('butterfly_monogram_AB.svg', pattern)
    ).toBeNull();
    // missing the required "_monogram_" segment
    expect(matchFilenamePattern('butterfly_A.svg', pattern)).toBeNull();
  });

  it('restricts {number} to a single digit', () => {
    const pattern = compileFilenamePattern('*_{number}.svg');

    expect(matchFilenamePattern('monogram_0.svg', pattern)).toBe('0');
    expect(matchFilenamePattern('monogram_9.svg', pattern)).toBe('9');
    expect(matchFilenamePattern('monogram_A.svg', pattern)).toBeNull();
    expect(matchFilenamePattern('monogram_10.svg', pattern)).toBeNull();
  });

  it('escapes regex-special characters in the literal parts of the pattern', () => {
    const pattern = compileFilenamePattern('letter (uppercase) {letter}.svg');

    expect(matchFilenamePattern('letter (uppercase) A.svg', pattern)).toBe('A');
    expect(matchFilenamePattern('letter Xuppercase) A.svg', pattern)).toBe(
      null
    );
  });

  it('rejects a pattern with no placeholder', () => {
    expect(() => compileFilenamePattern('monogram.svg')).toThrow(
      /exactly one \{letter\} or \{number\} placeholder, found 0/i
    );
  });

  it('rejects a pattern with more than one placeholder', () => {
    expect(() => compileFilenamePattern('{letter}_{number}.svg')).toThrow(
      /exactly one \{letter\} or \{number\} placeholder, found 2/i
    );
  });
});

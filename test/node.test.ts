import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  loadLettersFromDirectory,
  loadLettersFromFiles,
  writeMonogramFont,
} from '../src/node.js';

const SVG_A = '<svg viewBox="0 0 10 10"><path d="M0,0 L10,10 Z"/></svg>';
const SVG_B = '<svg viewBox="0 0 10 10"><path d="M0,0 L5,5 Z"/></svg>';

describe('Node filesystem helpers', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'monogram-font-maker-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('loadLettersFromDirectory reads every "<letter>.svg" file and ignores the rest', async () => {
    await writeFile(join(dir, 'A.svg'), SVG_A);
    await writeFile(join(dir, 'b.svg'), SVG_B);
    await writeFile(join(dir, 'README.md'), 'not a monogram');

    const letters = await loadLettersFromDirectory(dir);

    expect(letters).toEqual({ A: SVG_A, b: SVG_B });
  });

  it('loadLettersFromDirectory throws when nothing matches', async () => {
    await writeFile(join(dir, 'README.md'), 'not a monogram');

    await expect(loadLettersFromDirectory(dir)).rejects.toThrow(
      /no filenames matching the pattern/i
    );
  });

  it('loadLettersFromDirectory accepts a custom filenamePattern', async () => {
    await writeFile(join(dir, 'butterfly_monogram_A.svg'), SVG_A);
    await writeFile(join(dir, 'butterfly_monogram_b.svg'), SVG_B);
    await writeFile(join(dir, 'A.svg'), SVG_A); // wrong shape, ignored

    const letters = await loadLettersFromDirectory(dir, {
      filenamePattern: '*_monogram_{letter}.svg',
    });

    expect(letters).toEqual({ A: SVG_A, b: SVG_B });
  });

  it('loadLettersFromFiles reads an explicit list of file paths', async () => {
    const pathA = join(dir, 'A.svg');
    const pathB = join(dir, 'b.svg');
    await writeFile(pathA, SVG_A);
    await writeFile(pathB, SVG_B);

    const letters = await loadLettersFromFiles([pathA, pathB]);

    expect(letters).toEqual({ A: SVG_A, b: SVG_B });
  });

  it('loadLettersFromFiles rejects a path that is not named like a letter', async () => {
    const badPath = join(dir, 'not-a-letter.svg');
    await writeFile(badPath, SVG_A);

    await expect(loadLettersFromFiles([badPath])).rejects.toThrow(
      /doesn't match the filename pattern/i
    );
  });

  it('loadLettersFromFiles accepts a {number} filenamePattern', async () => {
    const path0 = join(dir, 'monogram_0.svg');
    await writeFile(path0, SVG_A);

    const letters = await loadLettersFromFiles([path0], {
      filenamePattern: '*_{number}.svg',
    });

    expect(letters).toEqual({ '0': SVG_A });
  });

  it('writeMonogramFont writes a non-empty OpenType font file to disk', async () => {
    const outputPath = join(dir, 'Monogram.otf');

    await writeMonogramFont(
      { A: SVG_A, b: SVG_B },
      { familyName: 'Test' },
      outputPath
    );

    const bytes = await readFile(outputPath);
    expect(bytes.byteLength).toBeGreaterThan(0);
  });
});

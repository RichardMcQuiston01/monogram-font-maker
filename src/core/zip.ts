import JSZip from 'jszip';
import type { LetterSvgMap } from './fontBuilder.js';
import {
  baseNameOf,
  collectLetters,
  type LetterSource,
} from './letterCollection.js';
import {
  compileFilenamePattern,
  matchFilenamePattern,
  DEFAULT_FILENAME_PATTERN,
  type FilenamePattern,
} from './filenamePattern.js';

/** Any byte representation JSZip can load, in either the browser or Node. */
export type ZipInput = string | number[] | Uint8Array | ArrayBuffer | Blob;

export interface FilenameMatchOptions {
  /**
   * Template describing where the letter sits in each filename. Defaults to
   * `{@link DEFAULT_FILENAME_PATTERN}` (`"{letter}.svg"`, i.e. `A.svg`).
   * See {@link FilenamePattern} for the template syntax.
   */
  filenamePattern?: FilenamePattern;
}

const DEFAULT_FILENAME_REGEXP = compileFilenamePattern(
  DEFAULT_FILENAME_PATTERN
);

/**
 * Extracts the letter from a filename (e.g. `"A.svg"` -> `"A"` under the
 * default `{letter}.svg` pattern), or returns `null` if it doesn't match.
 */
export function matchLetterSvgFilename(
  filename: string,
  pattern: FilenamePattern = DEFAULT_FILENAME_PATTERN
): string | null {
  const compiled =
    pattern === DEFAULT_FILENAME_PATTERN
      ? DEFAULT_FILENAME_REGEXP
      : compileFilenamePattern(pattern);
  return matchFilenamePattern(filename, compiled);
}

/** Shape of the JSZip internals holding an entry's header-declared sizes. */
interface JsZipEntryInternals {
  _data?: { uncompressedSize?: number };
}

/** JSZip's streaming reader, which its bundled typings leave out. */
interface JsZipChunkStream {
  on(event: 'data', handler: (chunk: Uint8Array) => void): JsZipChunkStream;
  on(event: 'error', handler: (error: Error) => void): JsZipChunkStream;
  on(event: 'end', handler: () => void): JsZipChunkStream;
  pause(): JsZipChunkStream;
  resume(): JsZipChunkStream;
}

type JsZipStreamingEntry = JSZip.JSZipObject & {
  internalStream(type: 'uint8array'): JsZipChunkStream;
};

/**
 * Decodes one entry as UTF-8 text, failing as soon as it exceeds `maxBytes`:
 * first from the size declared in the ZIP header (before any inflation), then
 * by counting bytes as they stream out, since a header can understate the
 * real size.
 */
function readEntryText(
  entry: JSZip.JSZipObject,
  maxBytes: number
): Promise<string> {
  const declaredSize = (entry as unknown as JsZipEntryInternals)._data
    ?.uncompressedSize;
  if (typeof declaredSize === 'number' && declaredSize > maxBytes) {
    return Promise.reject(
      new Error(
        `ZIP entry "${entry.name}" declares ${declaredSize} uncompressed bytes, more than the limit of ${maxBytes}.`
      )
    );
  }

  return new Promise<string>((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    const stream = (entry as JsZipStreamingEntry).internalStream('uint8array');
    stream
      .on('data', (chunk: Uint8Array) => {
        totalBytes += chunk.byteLength;
        if (totalBytes > maxBytes) {
          stream.pause();
          reject(
            new Error(
              `ZIP entry "${entry.name}" expands to more than the limit of ${maxBytes} bytes.`
            )
          );
          return;
        }
        chunks.push(chunk);
      })
      .on('error', (error: Error) => {
        reject(
          new Error(
            `Failed to read ZIP entry "${entry.name}": ${error.message}`
          )
        );
      })
      .on('end', () => {
        resolve(
          new TextDecoder('utf-8').decode(concatChunks(chunks, totalBytes))
        );
      })
      .resume();
  });
}

function concatChunks(chunks: Uint8Array[], totalBytes: number): Uint8Array {
  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}

/**
 * Reads a single ZIP archive of monogram SVGs — one file per letter, named
 * to match `filenamePattern` (`A.svg`, `b.svg`, etc. by default) — into a
 * {@link LetterSvgMap}. Entries that don't match are ignored, so a README or
 * license file alongside the artwork doesn't break the import. Archives with
 * too many entries, or SVGs that expand past the size limits, are rejected.
 */
export async function extractLettersFromZip(
  zipData: ZipInput,
  options: FilenameMatchOptions = {}
): Promise<LetterSvgMap> {
  const pattern = options.filenamePattern ?? DEFAULT_FILENAME_PATTERN;
  const compiledPattern =
    pattern === DEFAULT_FILENAME_PATTERN
      ? DEFAULT_FILENAME_REGEXP
      : compileFilenamePattern(pattern);

  const archive = await JSZip.loadAsync(zipData);

  const sources: LetterSource[] = Object.values(archive.files)
    .filter((entry) => !entry.dir)
    .map((entry) => ({
      baseName: baseNameOf(entry.name),
      label: baseNameOf(entry.name),
      readText: (maxBytes: number) => readEntryText(entry, maxBytes),
    }));

  return collectLetters(sources, {
    pattern,
    compiledPattern,
    inputDescription: 'ZIP file',
    onUnmatched: 'skip',
  });
}

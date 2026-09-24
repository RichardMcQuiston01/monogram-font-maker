/**
 * Minimal ambient types for opentype.js v2, covering only the font-writing
 * surface this package uses. opentype.js ships no first-party .d.ts, and the
 * community @types/opentype.js package targets the older v1 API.
 */
declare module 'opentype.js' {
  export type PathCommand =
    | { type: 'M'; x: number; y: number }
    | { type: 'L'; x: number; y: number }
    | {
        type: 'C';
        x1: number;
        y1: number;
        x2: number;
        y2: number;
        x: number;
        y: number;
      }
    | { type: 'Q'; x1: number; y1: number; x: number; y: number }
    | { type: 'Z' };

  export class Path {
    constructor();
    readonly commands: PathCommand[];
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    curveTo(
      x1: number,
      y1: number,
      x2: number,
      y2: number,
      x: number,
      y: number
    ): void;
    quadTo(x1: number, y1: number, x: number, y: number): void;
    close(): void;
  }

  export interface GlyphOptions {
    name: string;
    unicode?: number;
    unicodes?: number[];
    advanceWidth: number;
    path: Path;
  }

  export class Glyph {
    constructor(options: GlyphOptions);
    readonly name: string | null;
    readonly unicode: number | undefined;
    readonly advanceWidth: number;
    readonly path: Path;
  }

  export interface FontOptions {
    familyName: string;
    styleName: string;
    unitsPerEm: number;
    ascender: number;
    descender: number;
    glyphs: Glyph[];
  }

  export class Font {
    constructor(options: FontOptions);
    toArrayBuffer(): ArrayBuffer;
    readonly glyphs: { length: number };
    charToGlyph(character: string): Glyph;
  }

  export function parse(buffer: ArrayBuffer): Font;
}

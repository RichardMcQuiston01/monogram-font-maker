# Monogram Font Maker

- NPM Package: @richardmcquiston01/monogram-font-maker
- Author: Richard McQuiston
- Website: https://richardmcquiston.com/

## Overview

Framework agnostic TypeScript based NPM package for generating a Font from one or more sets of monogrammed letters. User specifies a single ZIP containing monogram SVG files, or individual SVG files for letters (A-Z). From the files, generate an installable OTF/TTF font where each letter is one of the monogram designs.

The point is to remove the manual, per-letter image import step from laser-template design workflows: build the font once, then just type a letter in your design software (LightBurn, Illustrator, CorelDRAW, Inkscape, ...) the same way you would with any other font. The generated font is also plain OpenType bytes, so it drops straight into browser-based tools — e.g. loading it with the [`FontFace`](https://developer.mozilla.org/en-US/docs/Web/API/FontFace) API in `maker-toolkit` or `maker-template-pro` — without a server round trip.

### Input format

Monogram letters must be supplied as SVG (`<svg viewBox="..."><path d="..."/></svg>`), one `<path>`-based design per letter. SVG was chosen over raster formats (PNG/JPG) because it already carries the clean vector outlines a font glyph needs — no lossy auto-tracing step, and no fidelity loss for laser-ready artwork. Each SVG needs a `viewBox` (or `width`/`height`) so its artwork can be scaled into the font's grid; groups, transforms, and non-`<path>` shapes (`<circle>`, `<rect>`, text, etc.) aren't resolved yet, so flatten artwork to paths before use.

### Filenames

Every SVG is matched to a letter purely by its filename, wherever it comes from (a ZIP, a directory, or an explicit file list): the **base name** (the filename on its own, ignoring any folder path) must be exactly one character followed by `.svg` — `A.svg`, `b.svg`, `1.svg`, and so on.

- The `.svg` extension is matched case-insensitively (`.svg`, `.SVG`, `.Svg` all work).
- The letter itself is **case-sensitive**: `A.svg` and `a.svg` produce two different glyphs (`A` and `a`), not one glyph used for both cases.
- Anything that doesn't match this `<one character>.svg` shape — a `README.md`, a `.gitignore`, a folder of source files, a multi-character filename — is silently skipped rather than causing an error.
- If two different files resolve to the same letter (e.g. two `A.svg` files in different folders of the same ZIP), that's treated as a mistake worth surfacing: it throws rather than silently picking one. Rename one of them.

#### Custom filename patterns

If your artwork isn't named `<letter>.svg`, pass a `filenamePattern` option to `extractLettersFromZip`, `generateMonogramFontFromZip`, `loadLettersFromDirectory`, `loadLettersFromFiles`, or `writeMonogramFontFromZipFile` describing where the letter sits in the filename instead. A pattern is a small template with two placeholder tokens and one wildcard:

| Token      | Matches                               |
| ---------- | ------------------------------------- |
| `{letter}` | exactly one character, of any kind    |
| `{number}` | exactly one digit (`0`-`9`)           |
| `*`        | any run of characters (e.g. a prefix) |

Everything else in the template is matched literally (case-insensitively), and the template must contain **exactly one** `{letter}` or `{number}` token — that's the character captured for the glyph.

```ts
// "butterfly_monogram_A.svg" -> letter "A"
const letters = await extractLettersFromZip(zipBytes, {
  filenamePattern: '*_monogram_{letter}.svg',
});

// "monogram_0.svg" .. "monogram_9.svg" -> digit glyphs "0".."9"
const digits = await extractLettersFromZip(zipBytes, {
  filenamePattern: '*_{number}.svg',
});
```

`{number}` isn't strictly necessary — `{letter}` also matches a digit — but it rejects filenames where that position isn't a digit, which catches a typo (`monogram_A.svg` sneaking into what should be an all-digits set) instead of silently turning it into a glyph named `"A"`.

### ZIP archive structure

`extractLettersFromZip` and `generateMonogramFontFromZip` accept a single ZIP archive containing one SVG per letter. There's no required folder layout — every entry in the archive is matched by its own filename (see above), not by its path, so files can sit at the archive root or be nested inside subfolders to any depth. Both of these are valid:

```
my-monogram.zip
├── A.svg
├── b.svg
└── C.svg
```

```
my-monogram.zip
└── MyFontKit/
    ├── letters/
    │   ├── A.svg
    │   └── b.svg
    └── README.txt        ← ignored, doesn't match "<letter>.svg"
```

An archive with no filename matching the `<letter>.svg` pattern anywhere in it throws, rather than silently producing an empty font.

**Note for the Node-only `loadLettersFromDirectory` helper:** unlike the ZIP reader, it does _not_ recurse into subfolders — it only looks at files directly inside the directory you give it. Keep every letter's SVG flat in one folder when using it:

```
monogram-svgs/
├── A.svg
├── b.svg
└── C.svg
```

`loadLettersFromFiles` skips directory scanning entirely and takes an explicit list of paths; each path's own basename must still match the `<letter>.svg` pattern.

### Output format

Fonts are generated as installable OTF/TTF — the format design software already knows how to install and use, and one that also loads fine as a web font.

## Getting Started

### Prerequisites

- Node.js >= 18 (for the Node-only helpers under the `./node` subpath; the core API also runs in any modern browser)
- Monogram artwork as SVGs, one per letter, named `A.svg`, `b.svg`, etc. — see [Filenames](#filenames) and [ZIP archive structure](#zip-archive-structure) above for the exact rules

### Installation

```sh
npm install @richardmcquiston01/monogram-font-maker
```

### Usage

The package has two entry points:

- `@richardmcquiston01/monogram-font-maker` — the core API. Works in the browser or Node; only touches in-memory strings/bytes.
- `@richardmcquiston01/monogram-font-maker/node` — adds filesystem convenience helpers (reading a directory of SVGs, writing the generated font to disk) on top of the core API, which it re-exports.

#### From an in-memory letter map (browser or Node)

```ts
import { generateMonogramFont } from '@richardmcquiston01/monogram-font-maker';

const fontBytes = generateMonogramFont(
  {
    A: '<svg viewBox="0 0 100 100"><path d="M10,90 L50,10 L90,90 Z"/></svg>',
    B: '<svg viewBox="0 0 100 100"><path d="M10,10 ..."/></svg>',
    // ...one entry per letter
  },
  { familyName: 'My Monogram' }
);
// fontBytes is an ArrayBuffer containing a complete OTF/TTF font.
```

#### From a single ZIP upload (e.g. a web app file input)

```ts
import { generateMonogramFontFromZip } from '@richardmcquiston01/monogram-font-maker';

const zipBytes = await file.arrayBuffer(); // `file` is a File from an <input type="file">
const fontBytes = await generateMonogramFontFromZip(zipBytes, {
  familyName: 'My Monogram',
});

// Use it immediately in the page, no server involved:
const fontFace = new FontFace('My Monogram', fontBytes);
await fontFace.load();
document.fonts.add(fontFace);
```

#### From files on disk (Node)

```ts
import {
  loadLettersFromDirectory,
  writeMonogramFont,
  writeMonogramFontFromZipFile,
} from '@richardmcquiston01/monogram-font-maker/node';

// One SVG per letter in a directory:
const letters = await loadLettersFromDirectory('./monogram-svgs');
await writeMonogramFont(
  letters,
  { familyName: 'My Monogram' },
  './MyMonogram.otf'
);

// Or straight from a ZIP file on disk:
await writeMonogramFontFromZipFile(
  './monogram-svgs.zip',
  { familyName: 'My Monogram' },
  './MyMonogram.otf'
);
```

### Examples

See [`test/`](./test) for runnable examples of every entry point, including round-tripping a generated font back through `opentype.js` to confirm the glyphs come out correctly.

## Buy Me a Coffee

If this app, code, or repository has helped you or someone you know, please consider donating. I appreciate any help to offset the costs of development and/or AI Credits.

[**Donate via Stripe**](https://donate.stripe.com/00w5kD3Gj1Xo9v7gVOcs800), or scan:

[![Donate via Stripe](./donate.svg)](https://donate.stripe.com/00w5kD3Gj1Xo9v7gVOcs800)

## License

Apache 2

## Copyright

(c)2026 Richard McQuiston. All rights reserved.

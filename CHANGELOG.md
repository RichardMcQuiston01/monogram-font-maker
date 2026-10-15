# CHANGELOG

## 0.3.0

- Security: bump the dev toolchain so `npm audit` is clean (`source-map-js` 1.2.2+ via lockfile, `esbuild` 0.28.1+ via an npm override).
- Reject oversized input before decoding it: at most 1000 archive/directory entries, 5 MiB per SVG, 50 MiB total, checked against the ZIP header and while streaming.
- Filename patterns are matched with a linear scan, so templates with several `*` no longer stall on long non-matching names. `compileFilenamePattern` now returns a `CompiledFilenamePattern` object instead of a `RegExp`; pass it to `matchFilenamePattern` as before.
- The ZIP, directory, and file-list loaders share one letter-collection routine. `loadLettersFromFiles([])` now throws like the other loaders.
- Fix `loadLettersFromDirectory` throwing `EISDIR` when a subdirectory's name matches the pattern; non-files are now skipped. `loadLettersFromFiles` reports a directory path as "not a file".
- Fix ZIP entries with `\` path separators never matching.
- Replace the regex SVG reader with a small tokenizer: single-quoted attributes, exact root `width`/`height`, units (absolute units converted, `%`/`em` rejected), finite `viewBox` numbers, and paths in comments, `<defs>`, `<clipPath>`, etc. are ignored.
- Reject a `transform` on a painted `<path>` or any ancestor instead of silently dropping it.
- Honor `fill-rule="evenodd"` by reversing nested contours so holes survive the font's nonzero rule; evenodd contours that cross each other are rejected with a clear error. `parseSvgDocument` also returns `paths` with each path's fill rule.
- Fix SVG arc flags other than `0`/`1` (any non-zero large-arc flag is a large arc).
- Validate font metrics, glyph coordinates, advance widths, family/style names, and glyph letters up front, with errors naming the letter and value.

## 0.2.0

- Add an optional `filenamePattern` option (`extractLettersFromZip`, `generateMonogramFontFromZip`, `loadLettersFromDirectory`, `loadLettersFromFiles`, `writeMonogramFontFromZipFile`) for matching letters out of non-default filenames, e.g. `*_monogram_{letter}.svg` or `*_{number}.svg`. Defaults to the existing `{letter}.svg` behavior.

## 0.1.0

- Initial release: generate an installable OTF/TTF font from a set of monogram letter SVGs, supplied as an in-memory map, a ZIP archive, or files on disk.

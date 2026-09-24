# CHANGELOG

## 0.2.0

- Add an optional `filenamePattern` option (`extractLettersFromZip`, `generateMonogramFontFromZip`, `loadLettersFromDirectory`, `loadLettersFromFiles`, `writeMonogramFontFromZipFile`) for matching letters out of non-default filenames, e.g. `*_monogram_{letter}.svg` or `*_{number}.svg`. Defaults to the existing `{letter}.svg` behavior.

## 0.1.0

- Initial release: generate an installable OTF/TTF font from a set of monogram letter SVGs, supplied as an in-memory map, a ZIP archive, or files on disk.

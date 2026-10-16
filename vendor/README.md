# Browser map dependencies

The gallery is served as static files, so these pinned distributions are checked in.
No build step or map API key is required. Map tiles are requested from
`https://tile.openstreetmap.org` only when the photo map is opened; the map retains
OpenStreetMap attribution and uses the browser's normal HTTP cache.

- Leaflet 1.9.4: https://www.npmjs.com/package/leaflet/v/1.9.4
  - License: `leaflet/LICENSE`
  - npm tarball integrity: `sha512-nxS1ynzJOmOlHp+iL3FyWqK89GtNL8U8rvlMOsQdTTssxZwCXh8N2NB3GDQOL+YR3XnWyZAxwQixURb+FA74PA==`
- Leaflet.markercluster 1.5.3: https://www.npmjs.com/package/leaflet.markercluster/v/1.5.3
  - License: `leaflet-markercluster/MIT-LICENCE.txt`
  - npm tarball integrity: `sha512-vPTw/Bndq7eQHjLBVlWpnGeLa3t+3zGiuM7fJwCkiMFq+nmRuG3RI3f7f4N4TDX7T4NpbAXpR2+NTRSEGfCSeA==`

To update, use `npm pack <package>@<version>`, verify the published integrity, and
copy the unmodified `dist` JavaScript, source map, CSS, images and license. Keep
the script and stylesheet paths in `index.html` in sync with these files.

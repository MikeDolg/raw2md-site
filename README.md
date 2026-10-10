# raw2md.com

The source of [raw2md.com](https://raw2md.com), the site of
[raw2md](https://github.com/MikeDolg/raw2md). The site is built with Astro
from the public documents of raw2md. This repository holds no copy of them.

## Content and version

The site shows the last version of raw2md on [PyPI](https://pypi.org/project/raw2md/).
The deploy reads that version from PyPI and builds from the tag `v<version>`
of `MikeDolg/raw2md`. If the tag does not exist, the build fails.

## Local build

Requirements:

- Node.js, the version in `.nvmrc`;
- [`lychee`](https://github.com/lycheeverse/lychee) on `PATH`, for
  `npm run check`;
- Chrome, for the Lighthouse step of `npm run check`;
- a clone of `MikeDolg/raw2md`.

The build reads the documents from `../public`, so clone raw2md into a folder
`public` next to this repository. To use another folder, set
`RAW2MD_DOCS_DIR` to the root of the raw2md clone.

```bash
npm ci
npm run dev     # preview at http://localhost:4321
npm run check   # linters, tests, build, checks of dist/
```

## Deploy

`.github/workflows/deploy.yml` runs `npm run check`, publishes `dist/` to
GitHub Pages, and notifies IndexNow. These events start it:

| Event                 | Source                                      |
| --------------------- | ------------------------------------------- |
| push to `main`        | a change to the site                        |
| `repository_dispatch` | `raw2md-release`, after a release of raw2md |
| `workflow_dispatch`   | a manual run                                |

The Pages source of the repository must be GitHub Actions. `static/CNAME`
holds the domain.

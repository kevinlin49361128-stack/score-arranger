# Third-Party Licenses — Score Arranger

**Auto-generated** by `scripts/gen-third-party-licenses.sh`. To refresh:

```sh
bash scripts/gen-third-party-licenses.sh THIRD_PARTY_LICENSES.md
```

This file enumerates **every package whose code is bundled into the
distributed binaries** (npm transitive prod deps + Python frozen deps).
Curated top-level notices and conditions remain in [`NOTICE.md`](NOTICE.md).

Last generated: 2026-05-26T12:34:25Z

## npm — production dependencies (transitive)

Extracted from `package-lock.json`.

| Package | Version | License |
|---------|---------|---------|
| @babel/runtime | 7.29.2 | MIT |
| @tonejs/midi | 2.0.28 | MIT |
| @types/pako | 2.0.4 | MIT |
| @types/vexflow | 1.2.42 | MIT |
| argparse | 2.0.1 | Python-2.0 |
| array-flatten | 3.0.0 | MIT |
| automation-events | 7.1.19 | MIT |
| builder-util-runtime | 9.5.1 | MIT |
| core-util-is | 1.0.3 | MIT |
| debug | 4.4.3 | MIT |
| electron-updater | 6.8.3 | MIT |
| fast-png | 6.4.0 | MIT |
| fflate | 0.8.3 | MIT |
| fft.js | 4.0.4 | MIT |
| fs-extra | 10.1.0 | MIT |
| graceful-fs | 4.2.11 | ISC |
| immediate | 3.0.6 | MIT |
| inherits | 2.0.4 | ISC |
| iobuffer | 5.4.0 | MIT |
| isarray | 1.0.0 | MIT |
| js-tokens | 4.0.0 | MIT |
| js-yaml | 4.1.1 | MIT |
| jsonfile | 4.0.0 | MIT |
| jspdf | 4.2.1 | MIT |
| jszip | 3.10.1 | (MIT OR GPL-3.0-or-later) |
| lazy-val | 1.0.5 | MIT |
| lie | 3.3.0 | MIT |
| lodash.escaperegexp | 4.1.2 | MIT |
| lodash.isequal | 4.5.0 | MIT |
| loglevel | 1.9.2 | MIT |
| loose-envify | 1.4.0 | MIT |
| midi-file | 1.2.4 | MIT |
| ms | 2.1.3 | MIT |
| opensheetmusicdisplay | 1.9.9 | BSD-3-Clause |
| pako | 1.0.11 | (MIT AND Zlib) |
| pitchy | 4.1.0 | MIT |
| process-nextick-args | 2.0.1 | MIT |
| react | 18.3.1 | MIT |
| react-dom | 18.3.1 | MIT |
| readable-stream | 2.3.8 | MIT |
| safe-buffer | 5.1.2 | MIT |
| sax | 1.6.0 | BlueOak-1.0.0 |
| scheduler | 0.23.2 | MIT |
| semver | 6.3.1 | ISC |
| setimmediate | 1.0.5 | MIT |
| standardized-audio-context | 25.3.77 | MIT |
| string_decoder | 1.1.1 | MIT |
| tiny-typed-emitter | 2.1.0 | MIT |
| tone | 15.1.22 | MIT |
| tslib | 2.8.1 | 0BSD |
| typescript-collections | 1.3.3 | MIT |
| universalify | 0.1.2 | MIT |
| use-sync-external-store | 1.6.0 | MIT |
| util-deprecate | 1.0.2 | MIT |
| verovio | 6.1.0 | LGPL-3.0-or-later |
| vexflow | 1.2.93 | MIT |
| zustand | 4.5.7 | MIT |

## Python — frozen engine dependencies

Extracted from `engine/.venv` (the venv used by `engine/freeze.sh`).

| Package | Version | License |
|---------|---------|---------|
| annotated-types | 0.7.0 | ? |
| anyio | 4.13.0 | MIT |
| ast_serialize | 0.5.0 | MIT |
| attrs | 26.1.0 | MIT |
| certifi | 2026.4.22 | MPL-2.0 |
| cffi | 2.0.0 | MIT |
| chardet | 7.4.3 | 0BSD |
| charset-normalizer | 3.4.7 | MIT |
| click | 8.4.0 | BSD-3-Clause |
| contourpy | 1.3.3 | BSD License |
| cryptography | 48.0.0 | Apache-2.0 OR BSD-3-Clause |
| cycler | 0.12.1 | BSD License |
| fonttools | 4.63.0 | MIT |
| h11 | 0.16.0 | MIT |
| httpcore | 1.0.9 | BSD-3-Clause |
| httpx | 0.28.1 | BSD-3-Clause |
| httpx-sse | 0.4.3 | MIT |
| idna | 3.15 | BSD-3-Clause |
| joblib | 1.5.3 | BSD-3-Clause |
| jsonpickle | 4.1.1 | BSD-3-Clause |
| jsonschema | 4.26.0 | MIT |
| jsonschema-specifications | 2025.9.1 | MIT |
| kiwisolver | 1.5.0 | BSD License |
| librt | 0.11.0 | MIT |
| matplotlib | 3.10.9 | Python Software Foundation License |
| mcp | 1.27.1 | MIT |
| more-itertools | 11.0.2 | MIT |
| music21 | 10.1.0 | BSD-3-Clause |
| numpy | 2.4.5 | BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0 |
| packaging | 26.2 | Apache-2.0 OR BSD-2-Clause |
| pathspec | 1.1.1 | ? |
| pillow | 12.2.0 | MIT-CMU |
| pycparser | 3.0 | BSD-3-Clause |
| pydantic | 2.13.4 | MIT |
| pydantic-settings | 2.14.1 | MIT |
| pydantic_core | 2.46.4 | MIT |
| Pygments | 2.20.0 | BSD-2-Clause |
| PyJWT | 2.12.1 | MIT |
| pyobjc-core | 12.1 | MIT |
| pyobjc-framework-Cocoa | 12.1 | MIT |
| pyobjc-framework-Quartz | 12.1 | MIT |
| pyparsing | 3.3.2 | MIT |
| python-dateutil | 2.9.0.post0 | Dual License |
| python-dotenv | 1.2.2 | BSD-3-Clause |
| python-multipart | 0.0.29 | Apache-2.0 |
| referencing | 0.37.0 | MIT |
| requests | 2.34.2 | Apache-2.0 |
| rpds-py | 0.30.0 | MIT |
| six | 1.17.0 | MIT |
| sse-starlette | 3.4.4 | BSD-3-Clause |
| starlette | 1.0.0 | BSD-3-Clause |
| typing-inspection | 0.4.2 | MIT |
| typing_extensions | 4.15.0 | PSF-2.0 |
| urllib3 | 2.7.0 | MIT |
| uvicorn | 0.47.0 | BSD-3-Clause |
| webcolors | 25.10.0 | BSD-3-Clause |

---

**Note on excluded dev tools**: build/test tools (mypy, pytest, ruff,
coverage, PyInstaller itself, etc.) are excluded — they are not part
of the distributed binary, only the build environment.

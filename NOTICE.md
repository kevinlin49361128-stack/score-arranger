# Score Arranger — Third-Party Notices

Score Arranger is built on the shoulders of many open-source projects.
This file lists every third-party component whose code is **bundled** into
the distributed app, its license, and any conditions attached to its
redistribution.

For the **complete machine-extracted dependency list** (39 npm packages +
~60 Python packages, transitive), see
[`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md).

For corresponding-source obligations under GPL-3.0, see
[`SOURCE.md`](SOURCE.md).

For privacy practices, see [`PRIVACY.md`](PRIVACY.md).

---

## 1. Core libraries (bundled, top-level)

### 1.1 npm (Electron renderer + main process)

| Component | License | Role |
|-----------|---------|------|
| [React](https://react.dev/) + [react-dom](https://react.dev/) | MIT | UI framework |
| [Zustand](https://github.com/pmndrs/zustand) | MIT | State management |
| [Electron](https://www.electronjs.org/) | MIT | Desktop runtime (devDependency, redistributed via electron-builder) |
| [OpenSheetMusicDisplay](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay) | BSD-3-Clause | In-app score rendering (SVG) |
| [VexFlow](https://github.com/0xfe/vexflow) (via OSMD) | MIT | Music notation primitives |
| [Verovio](https://github.com/rism-digital/verovio) | **LGPL-3.0-or-later** | PDF export rendering (see §1.3) |
| [Tone.js](https://github.com/Tonejs/Tone.js) | MIT | Audio playback engine |
| [@tonejs/midi](https://github.com/Tonejs/Midi) | MIT | MIDI file parsing |
| [standardized-audio-context](https://github.com/chrisguttandin/standardized-audio-context) | MIT | Web Audio compatibility |
| [jsPDF](https://github.com/parallax/jsPDF) | MIT | PDF assembly |
| [JSZip](https://stuk.github.io/jszip/) | **MIT OR GPL-3.0-or-later** (dual) | MXL zip handling |
| [pako](https://github.com/nodeca/pako) | **MIT AND Zlib** | Compression (used by JSZip) |
| [fast-png](https://github.com/image-js/fast-png) | MIT | PNG encoding |
| [fflate](https://github.com/101arrowz/fflate) | MIT | Compression |
| [Vite](https://vitejs.dev/) | MIT | Build tooling (devDependency, output bundled) |

### 1.2 Python (frozen via PyInstaller into `score-arranger-engine` binary)

| Component | License | Role |
|-----------|---------|------|
| [music21](https://github.com/cuthbertLab/music21) | BSD-3-Clause | MusicXML/MIDI parsing & writing, music theory analysis |
| [MCP SDK](https://github.com/modelcontextprotocol/python-sdk) (`mcp`) | MIT | Model Context Protocol server |
| [numpy](https://numpy.org/) (via music21) | BSD-3-Clause | Numerical arrays |
| [matplotlib](https://matplotlib.org/) (via music21) | matplotlib (PSF-based) | Plotting (rarely invoked by Score Arranger) |
| [requests](https://requests.readthedocs.io/) | Apache-2.0 | HTTP (MCP transport) |
| [pydantic](https://docs.pydantic.dev/) + pydantic-core | MIT | MCP schema validation |
| [jsonschema](https://github.com/python-jsonschema/jsonschema) | MIT | Schema validation |
| [Pillow (PIL)](https://python-pillow.org/) | MIT-CMU | Image handling (via matplotlib) |
| [chardet](https://github.com/chardet/chardet) | LGPL-2.1 | Character encoding detection |
| [PyInstaller](https://pyinstaller.org/) bootloader | Apache-2.0 (with exception) | Runtime loader |
| [cryptography](https://github.com/pyca/cryptography) | Apache-2.0 OR BSD-3-Clause | TLS for HTTP |
| [PyJWT](https://github.com/jpadilla/pyjwt) | MIT | (MCP optional auth) |
| [anyio](https://github.com/agronholm/anyio) | MIT | Async I/O |
| [httpx](https://github.com/encode/httpx) / httpcore / h11 | BSD-3-Clause | HTTP client |
| [starlette](https://www.starlette.io/) / uvicorn / sse-starlette | BSD-3-Clause | MCP SSE transport |
| [click](https://click.palletsprojects.com/) | BSD-3-Clause | CLI handling |

A full machine-extracted list of all transitive Python dependencies
(version + license) lives in [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md).

### 1.3 Verovio (LGPL-3.0-or-later) — special notice

Verovio is licensed under the GNU Lesser General Public License v3 (or later).
This means:

1. **Right to replace** — End users have the right to replace the Verovio
   component with a modified version. In Score Arranger, Verovio is loaded
   as a separate, dynamically-imported bundle. Replacement instructions are
   documented in [`SOURCE.md`](SOURCE.md#replacing-verovio).
2. **Source availability** — The source code for the exact Verovio version
   bundled (currently v6.1.0) is publicly available at
   <https://github.com/rism-digital/verovio>. We do not modify Verovio.
3. **No additional restrictions** — LGPL does not require us to display
   any attribution string on rendered output. We removed Verovio's default
   "MEI engraved with Verovio" footer for cleaner output; this notice file
   serves as the formal attribution instead.

---

## 2. Audio samples (runtime download, not bundled)

| Sample set | License | Attribution | License URL |
|------------|---------|-------------|-------------|
| Salamander Grand Piano (v3) | **CC-BY 3.0 Unported** | © Alexander Holm — <https://sfzinstruments.github.io/pianos/salamander> | <https://creativecommons.org/licenses/by/3.0/> |
| tonejs-instruments | varies (see [repo](https://github.com/nbrosowsky/tonejs-instruments)) — most samples derive from VSCO 2 (CC0) and Salamander (CC-BY 3.0) | © Nicholas Brosowsky and individual sample authors | mixed (see per-sample README in repo) |

Both sample sets are fetched on-demand from their official CDNs (`tonejs.github.io`,
`nbrosowsky.github.io`); they are **not bundled** with Score Arranger.

The CC-BY 3.0 license for Salamander Grand Piano requires attribution
whenever the samples are used to produce derivative works. The on-screen
attribution in the About dialog satisfies this requirement.

---

## 3. Musical works (bundled in `engine/core/sample_scores/`)

Score Arranger ships 58 sample MusicXML files in the frozen engine binary
(under `core/sample_scores/`) — 45 long-standing samples plus 13
**OpenScore Lieder** (added 0.1.40, files prefixed `openscore_*.mxl`).
The musical works themselves are all in the **public domain** (composers
from Bach to Verdi, all died ≥ 70 years ago). The MusicXML **encodings**
carry varying provenance:

**OpenScore Lieder (13 files)** — sourced from
<https://github.com/OpenScore/Lieder>, released under
[**CC0 1.0 Universal**](https://creativecommons.org/publicdomain/zero/1.0/)
("No Rights Reserved"). Commercial redistribution unrestricted. Files
prefixed `openscore_*.mxl` are these — Beethoven Op.48/52 Lieder,
Schubert Schöne Müllerin selections, Schumann Dichterliebe / Liederkreis /
Frauenliebe selections, Brahms Op.43.

**Most files** (~41 of 45) have no `<rights>` tag and were obtained from
publicly available encoding archives. They are treated as
[music21 corpus](https://github.com/cuthbertLab/music21/blob/master/music21/corpus/license.txt) –
type redistributions, which the music21 license describes as:

> ...distributed with the permission of the encoders (and, where needed,
> the composers or arrangers) and where permitted under United States
> copyright law. Some encodings included in the corpus may not be used
> for commercial uses or have other restrictions.

**Files with explicit notices** (treat with extra care for commercial use):

| File | `<rights>` text | Notes |
|------|-----------------|-------|
| `bach_bwv281.musicxml` | Copyright 1994, Center for Computer Assisted Research in the Humanities | CCARH/MuseData encoding, freely redistributable for non-commercial use per [MuseData policy](http://www.musedata.org/) |
| `corelli_opus3no1_1grave.musicxml` | © 2014, Creative Commons License (CC-BY) | Per CC-BY: attribute encoder, give license URL |
| `schubert_Lindenbaum.musicxml` | Copyright © | Encoder unidentified; included on best-effort basis. Commercial redistributors should re-encode from public-domain score. |
| `schumann_clara_opus17_movement3.musicxml` | © | Encoder unidentified; same caveat as above. |

If you plan to **commercially distribute** arrangements derived from these
sample scores, you should either (a) substitute your own MusicXML encoding
of the public-domain work, or (b) verify the specific encoding's license
with the original encoder.

---

## 4. AI integration

Score Arranger's "AI suggestions" feature optionally uses Anthropic's
Claude API (or any OpenAI-compatible / Ollama endpoint the user configures).

- **API key**: User-provided in the in-app settings dialog or via
  environment variable. The key is never bundled, transmitted to us,
  or stored on any server.
- **Data flow**: When a user clicks "🤖 AI 建議" inside the Measure
  Editor or natural-language panel, the relevant score segment (notes,
  dynamics of the targeted region) is sent directly from the user's
  computer to the user-configured LLM endpoint. No other data is sent.
- **Terms of service**: Use of Claude API is subject to Anthropic's
  [Usage Policies](https://www.anthropic.com/legal/aup) and
  [Commercial Terms](https://www.anthropic.com/legal/commercial-terms).
  Other providers' terms apply to their respective APIs.
- **Disabling**: If no API key is configured, the AI features explain
  how to enable them but make no network calls.

For broader privacy practices, see [`PRIVACY.md`](PRIVACY.md).

---

## 5. Trademarks

- **MuseScore** is a trademark of MuseScore BVBA
- **Dorico** is a trademark of Steinberg Media Technologies GmbH
- **Sibelius** is a trademark of Avid Technology, Inc.
- **Claude** and **Anthropic** are trademarks of Anthropic, PBC
- **MX Master** is a trademark of Logitech International S.A.
- **macOS** is a trademark of Apple Inc.

These names appear in Score Arranger's UI and documentation in a strictly
**nominative fair use** capacity (to identify the products being interoperated
with). No endorsement is implied.

---

## 6. Score Arranger itself

- **License**: [GPL-3.0-only](LICENSE) (SPDX: `GPL-3.0-only`)
- **Copyright**: © 2026 Kevin Lin
- **Source**: <https://github.com/kevinlinxyz/score-arranger>
  (replace with actual URL once public)
- **Corresponding Source for binaries**: see [`SOURCE.md`](SOURCE.md)

To contribute, see [`CONTRIBUTING.md`](CONTRIBUTING.md).
To report security issues, see [`SECURITY.md`](SECURITY.md).

---

*This notice is maintained alongside the codebase. The npm/Python lists in
§1 may lag transitive updates; the canonical machine-extracted list lives
in [`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md), which is regenerated
per release.*

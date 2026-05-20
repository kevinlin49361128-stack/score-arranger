# Score Arranger — Third-Party Notices

Score Arranger is built on the shoulders of many open-source projects.
This file lists every third-party component, its license, and any conditions
attached to its redistribution.

---

## 1. Core libraries

| Component | License | Role |
|-----------|---------|------|
| [music21](https://github.com/cuthbertLab/music21) | BSD-3-Clause | MusicXML/MIDI parsing & writing, music theory analysis |
| [OpenSheetMusicDisplay](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay) | BSD-3-Clause | In-app score rendering (SVG) |
| [Verovio](https://github.com/rism-digital/verovio) | **LGPL-3.0-or-later** | PDF export rendering (see §1.1) |
| [Tone.js](https://github.com/Tonejs/Tone.js) | MIT | Audio playback engine |
| [@tonejs/midi](https://github.com/Tonejs/Midi) | MIT | MIDI file parsing |
| [jsPDF](https://github.com/parallax/jsPDF) | MIT | PDF assembly |
| [html2canvas](https://github.com/niklasvh/html2canvas) | MIT | (used internally by jsPDF) |
| [React](https://react.dev/) | MIT | UI framework |
| [Zustand](https://github.com/pmndrs/zustand) | MIT | State management |
| [Electron](https://www.electronjs.org/) | MIT | Desktop runtime |
| [Vite](https://vitejs.dev/) | MIT | Build tooling |
| [MCP SDK](https://github.com/modelcontextprotocol/python-sdk) | MIT | Model Context Protocol server |

### 1.1 Verovio (LGPL-3.0-or-later) — special notice

Verovio is licensed under the GNU Lesser General Public License v3 (or later).
This means:

1. **Right to replace** — End users have the right to replace the Verovio
   component with a modified version. In Score Arranger, Verovio is loaded
   as a separate, dynamically-imported bundle (`verovio-*.js`); replacing
   that file with a custom build is sufficient to exercise this right.
2. **Source availability** — The source code for the exact Verovio version
   bundled (currently v6.1.0) is publicly available at
   <https://github.com/rism-digital/verovio>. We do not modify Verovio.
3. **No additional restrictions** — LGPL does not require us to display
   any attribution string on rendered output. We removed Verovio's default
   "MEI engraved with Verovio" footer for cleaner output; this notice file
   serves as the formal attribution instead.

---

## 2. Audio samples (runtime download, not bundled)

| Sample set | License | Attribution |
|------------|---------|-------------|
| Salamander Grand Piano | **CC-BY 3.0** | © Alexander Holm — <https://sfzinstruments.github.io/pianos/salamander> |
| tonejs-instruments | varies (see [repo](https://github.com/nbrosowsky/tonejs-instruments)) | © Nicholas Brosowsky and individual sample authors |

Both sample sets are fetched on-demand from their official CDNs (`tonejs.github.io`,
`nbrosowsky.github.io`); they are **not bundled** with Score Arranger.

The CC-BY 3.0 license for Salamander Grand Piano requires attribution
whenever the samples are used to produce derivative works. The on-screen
attribution in the About panel satisfies this requirement.

---

## 3. Musical works (music21 corpus)

Score Arranger ships pointers to ~30 pieces in `music21`'s built-in corpus.
Per the [music21 corpus license](https://github.com/cuthbertLab/music21/blob/master/music21/corpus/license.txt):

> The BSD licensed music21 software is distributed with a corpus of encoded
> compositions which are distributed with the permission of the encoders
> (and, where needed, the composers or arrangers) and where permitted under
> United States copyright law. Some encodings included in the corpus may
> not be used for commercial uses or have other restrictions: please see
> the licenses embedded in individual compositions or directories for more
> details.

Composers referenced (all in public domain):
- J.S. Bach (BWV chorales)
- W.A. Mozart (string quartets, K.80)
- L. van Beethoven (op.18 quartets)
- F. Schubert (Lieder)
- F. Chopin (Mazurkas)
- A. Corelli, G. Handel and others

The musical works themselves are in the public domain. The MusicXML
**encodings** may carry additional restrictions per the music21 corpus
license above. Users planning to commercially distribute arrangements
derived from these encodings should verify the per-file licenses in
the music21 source tree.

---

## 4. AI integration

Score Arranger's "AI suggestions" feature uses Anthropic's Claude API.

- **API key**: User-provided via `ANTHROPIC_API_KEY` environment variable
  before launching the app. The key is never bundled, transmitted to us,
  or stored on disk by Score Arranger.
- **Data flow**: When a user clicks "🤖 AI 建議" inside the Measure Editor,
  the relevant score segment (notes, dynamics of one measure) is sent to
  the Claude API. No other data is sent.
- **Terms of service**: Use of Claude API is subject to Anthropic's
  [Usage Policies](https://www.anthropic.com/legal/aup) and
  [Commercial Terms](https://www.anthropic.com/legal/commercial-terms).
- **Disabling**: If `ANTHROPIC_API_KEY` is not set, the 🤖 button still
  appears but explains how to enable the feature; no API calls are made.

---

## 5. Privacy

Score Arranger does **not**:
- Collect telemetry or analytics
- Phone home with usage data
- Upload your scores to any server (other than the optional AI feature above)

Score Arranger **does** store the following on your local machine:
- **localStorage** (in Electron's user data dir): theme, panel layout,
  zoom, tab list, AI-suggestion preference learning counts
- **`~/.score-arranger/sessions/*.json`**: persistent arrangement state
  per tab, so your work survives app restarts
- **`/tmp/score-arranger/*.musicxml`**: temporary files when you use
  "Open in external editor"; these are cleaned up by the OS

---

## 6. Trademarks

- **MuseScore** is a trademark of MuseScore BVBA
- **Dorico** is a trademark of Steinberg Media Technologies GmbH
- **Sibelius** is a trademark of Avid Technology, Inc.
- **Claude** and **Anthropic** are trademarks of Anthropic, PBC
- **MX Master** is a trademark of Logitech International S.A.

These names appear in Score Arranger's UI and documentation in a strictly
**nominative fair use** capacity (to identify the products being interoperated
with). No endorsement is implied.

---

## 7. Score Arranger itself

- Version: 0.1.0
- Copyright © 2026 Kevin Lin
- License: (TBD — currently unreleased / private)

To report issues, suggest features, or contribute:
- See `CLAUDE.md` for development notes
- See `docs/mcp-setup.md` for the AI integration entry point

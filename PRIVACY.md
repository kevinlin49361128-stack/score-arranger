# Privacy Policy — Score Arranger

_Last updated: 2026-05-26 (v0.1.44)_

Score Arranger is a desktop application that runs entirely on your machine.
This document explains what data it processes, where that data goes, and
what choices you have.

> This is a statement of practices, not a legally-binding contract. The
> source code is open (GPL-3.0-only) so you can verify everything below
> yourself. If anything here drifts from reality, please open an issue.

---

## 1. Data we do not collect

Score Arranger **does not**:

- Send telemetry, analytics, crash reports, or "phone home" pings
- Collect your name, email, IP address, or any personally identifying info
- Track which scores you open, what edits you make, or how often you use
  any feature
- Maintain any server that could receive such data — there is no
  Score Arranger backend

---

## 2. Data stored locally on your computer

Score Arranger writes the following to your local filesystem:

| Path | Contents | Why |
|------|----------|-----|
| `<userData>/score-arranger/` | `localStorage` for UI: theme, panel layout, zoom, tab list, AI-suggestion preference counts, UI language (`sa-locale`), guidance-mode flags | Persist UI state across launches |
| `<userData>/score-arranger/` | `localStorage` for teacher workflow (0.1.39+): student cards (name, instrument, grade, free-text notes), ensemble templates | Per-student arrangement targeting; never leaves your machine |
| `~/.score-arranger/sessions/*.json` | Per-tab arrangement state | Survive app restarts so your work isn't lost |
| `<tmp>/score-arranger/*.musicxml` | Temporary files for "Open in external editor" | Inter-process handoff to MuseScore/Dorico; OS cleans these up |
| `<userData>/score-arranger/llm-settings.json` | LLM provider, endpoint, model selection (NOT the API key) | Remember which AI provider you chose |

`<userData>` resolves to:
- macOS: `~/Library/Application Support/score-arranger/`
- Windows: `%APPDATA%/score-arranger/`
- Linux: `~/.config/score-arranger/`

Removing the app does not automatically remove these files; delete them
manually if desired.

---

## 3. Network connections — when they happen, why, and what is sent

Score Arranger makes network connections **only** in the following
clearly-triggered situations. None happen passively in the background.

### 3.1 Audio sample downloads (first playback)

When you press Play for the first time, Score Arranger fetches audio
samples for the instruments in your arrangement from:

- `https://tonejs.github.io/audio/salamander/` — Salamander Grand Piano
- `https://nbrosowsky.github.io/tonejs-instruments/` — orchestral samples

These are static asset hosts. **No identifying data** is sent (only
standard browser-style HTTP requests for files).

### 3.2 AI suggestions (only when you click the AI button)

If you have configured an LLM provider in Settings and click an AI button,
Score Arranger sends:

- The **musical segment** relevant to your request (notes, dynamics,
  articulations of the targeted measures only — not the entire score)
- Your prompt text (e.g. "make this more lyrical")
- Your API key in the request header

…directly to the **endpoint you configured** (Anthropic Claude API by
default; can be set to OpenAI-compatible servers, Ollama on localhost,
etc.). Score Arranger is **not in the middle** of this connection —
it goes from your machine to the provider you chose.

Anthropic's data handling is governed by their
[Usage Policies](https://www.anthropic.com/legal/aup) and
[Commercial Terms](https://www.anthropic.com/legal/commercial-terms).
Other providers' terms apply to their respective APIs.

### 3.3 OMR (PDF → MusicXML) — local-only

The optional PDF import feature uses **Audiveris**, which runs **locally**
on your machine. No PDF data leaves your computer.

### 3.4 AMT (audio → MusicXML) — local-only

The optional audio import feature uses **basic-pitch**, which runs
**locally** on your machine. No audio data leaves your computer.

### 3.5 Microphone (Performance Following, 0.1.35+) — local-only

The optional Mic Practice / Performance Following feature uses your
microphone to estimate the pitch of what you sing/play in real time
(via the [pitchy](https://github.com/ianprime0509/pitchy) McLeod / YIN
algorithm). The audio:

- Is processed **frame-by-frame in renderer memory** (Web Audio API)
- Is **never recorded to disk**, never uploaded, never persisted
- Stops as soon as you close the Mic Practice panel

macOS will prompt for microphone permission on first use; the prompt
text (`NSMicrophoneUsageDescription`) reflects this practice.

### 3.6 Auto-update check (0.1.36+) — GitHub Releases manifest only

On each launch, Score Arranger checks for a newer version by fetching
**one** static YAML manifest from GitHub Releases:

```
https://github.com/kevinlin49361128-stack/score-arranger/releases/latest/download/latest-mac.yml
```

This is a `GET` against a public CDN. **No user data is sent** beyond
standard HTTP headers (User-Agent identifying Electron / electron-updater,
your IP visible to GitHub the same as for any web fetch). If a newer
version is available, the app shows an update banner — **you decide
whether to install**; nothing downloads or installs automatically.

To disable, set environment variable `ELECTRON_UPDATER_DISABLED=1` or
build from source with `electron-updater` removed.

### 3.7 Website analytics (landing page only, 0.1.45+)

The marketing site **<https://score-arranger.vercel.app/>** (and the
GitHub Pages mirror) loads
[**Cloudflare Web Analytics**](https://www.cloudflare.com/web-analytics/).

What this does:

- Counts page views, referrers, country (coarse), device class (desktop /
  mobile / tablet) — **aggregated**
- **No cookies**, **no `localStorage`**, **no fingerprinting**, **no
  cross-site tracking**
- Cloudflare does not link these signals to any user account or build
  a profile

This **only affects the marketing site**, not the desktop application.
Score Arranger.app itself sends **zero telemetry** (see §1).

If you want to block the analytics beacon, any standard content blocker
(uBlock Origin, Brave Shields, Firefox ETP) will catch it; the site
still works without it. See
[Cloudflare's Web Analytics privacy notice](https://www.cloudflare.com/web-analytics/privacy/)
for their side.

---

## 4. Your scores and arrangements

Your MusicXML files and edited arrangements:

- Stay on your filesystem unless **you** explicitly export, share, or
  use the AI feature on them
- Are not uploaded, backed up to a cloud, or indexed by Score Arranger
- Belong to you (Score Arranger claims no rights in your output)

---

## 5. API keys

If you enter an LLM API key in the Settings dialog:

- It is stored in `<userData>/score-arranger/llm-settings.json` on your
  machine
- It is sent only to the LLM endpoint you configured, in the standard
  `Authorization` or provider-specific header
- It is **never** sent to any third party or logged

You can clear the key any time via Settings → "Clear API key".

---

## 6. Children's data

Score Arranger does not knowingly process data from minors because it
does not knowingly process any personal data from any user — see §1.

---

## 7. Changes to this policy

Material changes will be reflected by updating the "_Last updated_"
header at the top and noted in `CHANGELOG.md` (when applicable). This
file is version-controlled in the public repository.

---

## 8. Contact

For privacy questions, open an issue on the GitHub repository or email
the maintainer (address listed in `package.json` / GitHub profile).

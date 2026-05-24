# Privacy Policy — Score Arranger

_Last updated: 2026-05-24 (v0.1.33)_

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
| `<userData>/score-arranger/` | `localStorage` for UI: theme, panel layout, zoom, tab list, AI-suggestion preference counts | Persist UI state across launches |
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

### 3.5 No automatic update checks

Score Arranger does not check for updates. You decide when to upgrade.

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

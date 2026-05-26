# Security Policy — Score Arranger

## Supported versions

Score Arranger is a single-author hobby project. Only the **latest
released version** receives security fixes. There is no LTS branch.
The auto-update system (0.1.36+) makes upgrading trivial — open the
app, click the update banner.

| Version | Supported |
|---------|-----------|
| latest (currently 0.1.44) | ✅ |
| any other | ❌ — please upgrade |

---

## Reporting a vulnerability

**Please do not open a public GitHub issue for security problems.**

Email the maintainer directly:

> **kevin.lin.49361128 [at] gmail.com**

with the subject `[SECURITY] Score Arranger ...`. Please include:

- Affected version (Help → About)
- A description of the issue and how to reproduce it
- Your assessment of impact (e.g. arbitrary file read, RCE, etc.)
- Any proof-of-concept (script, MusicXML payload, etc.)

You can expect:

- An acknowledgment within **5 business days** (allowing for travel /
  hospital workload as the maintainer is a physician)
- A coordinated disclosure timeline — typically 30 days to fix + ship
  before public disclosure; longer if the fix requires upstream changes
  in Electron / music21 / etc.
- Credit in the release notes (unless you prefer to remain anonymous)

There is no bug-bounty program. This is a hobby project.

---

## Out-of-scope

The following are **not** considered security vulnerabilities for this
project:

- Score Arranger generating an unsatisfactory arrangement (this is a
  music-quality issue, not a security issue — open a normal issue)
- LLM provider terms-of-service issues
- Vulnerabilities in transitive dependencies that don't have a viable
  exploit path through Score Arranger
- Issues only reproducible by running unsigned third-party Verovio
  builds (you have the right to do that under LGPL, but the trust
  boundary changes — see [`NOTICE.md`](NOTICE.md) §1.3)

---

## Threat model

The trust boundary, summarized:

- **Trusted**: the code in this repository, signed Electron, the signed
  PyInstaller-frozen engine binary, the user (you)
- **Semi-trusted**: MusicXML / MIDI / audio files you open; Audiveris /
  basic-pitch local binaries; LLM endpoints you configured
- **Untrusted**: anything received from network responses (sample CDNs,
  LLM responses), filesystem contents at user-specified paths

Score Arranger uses Electron with sandboxed renderer, strict CSP,
navigation guard, and IPC dialog tokens (see release notes for 0.1.20-21)
to limit the blast radius of any single-component compromise.

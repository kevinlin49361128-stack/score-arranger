# Disclaimer & Limitation of Liability — Score Arranger

_Effective: 2026-05-24 (v0.1.33)_

Score Arranger is released under [GPL-3.0-only](LICENSE). This document
restates and clarifies, in plain language, the warranty disclaimer and
liability limits already present in §15 and §16 of the GPL-3.0 text,
plus practical notes on responsibility for content the user processes.

> Nothing here is legal advice. If you need legal certainty for a
> commercial use case, consult a lawyer.

---

## 1. No warranty

The software is provided **"AS IS"**, without warranty of any kind,
express or implied, including (but not limited to) warranties of
merchantability, fitness for a particular purpose, and non-infringement.

In particular:

- **Output correctness**: The arrangement engine uses heuristics and ML.
  Generated parts may contain incorrect notes, infeasible passages,
  voice-leading mistakes, or unidiomatic writing. **You must musically
  verify any output before performance or publication.**
- **Playability checks**: Range and chord-feasibility detection is best-
  effort. Edge cases on extended technique, unusual tunings, or hybrid
  instruments may not be caught.
- **OMR / AMT accuracy**: Optical music recognition (PDF → MusicXML)
  and automatic music transcription (audio → MusicXML) are inherently
  imperfect; treat their output as drafts requiring human review.

---

## 2. No liability

To the maximum extent permitted by applicable law, the author(s) and
contributors shall not be liable for any damages, losses, or claims
arising from your use of the software, including but not limited to:

- Lost performances, missed deadlines, or scheduling conflicts caused
  by software errors
- Copyright disputes arising from your use of input scores you did not
  have rights to (see §3)
- Embarrassment from a published arrangement containing engine-generated
  errors you did not catch (see §1)
- Loss of edited work due to file-system errors, crashes, or undo-stack
  bugs — save backups
- Any direct, indirect, incidental, consequential, special, or punitive
  damages

This limitation applies regardless of the legal theory (contract, tort,
strict liability) and even if the author was advised of the possibility
of such damages.

---

## 3. Your responsibility for inputs

Score Arranger processes any MusicXML / MIDI / PDF / audio file you
provide. **You are responsible for ensuring you have the legal right
to do so** in your jurisdiction. This includes:

- Verifying that the source work is in the public domain, you own the
  copyright, you have the rightsholder's permission, or your use falls
  under a fair-use / fair-dealing exception
- Respecting any restrictions in the original encoding's license (some
  MusicXML encodings of public-domain works carry encoder copyright)
- Not using the OMR feature to circumvent technical protection measures
  on copyrighted PDFs

---

## 4. Your responsibility for outputs

You own (or otherwise hold the rights to) any arrangement you produce,
subject to the underlying work's copyright. Score Arranger claims no
ownership over your output.

If you publish, perform, or distribute an arrangement produced with
Score Arranger:

- Acknowledging Score Arranger (e.g. "Arranged with Score Arranger
  v0.1.x" in PDF footer) is appreciated but **not required**
- The GPL-3.0 license of Score Arranger does **not** apply to your
  arrangement; the arrangement is governed by the copyright status of
  the underlying composition + your edits
- For commercial publication, consult the licensing terms of any
  third-party MusicXML sources you used (see [`NOTICE.md`](NOTICE.md) §3)

---

## 5. Third-party services

When you use the optional AI features, your data is sent to the
LLM provider you chose (e.g. Anthropic). Their terms govern that
data once it leaves your machine. Score Arranger is not responsible
for those providers' practices.

See [`PRIVACY.md`](PRIVACY.md) §3.2 for the data flow.

---

## 6. Severability

If any part of this disclaimer is held invalid or unenforceable, the
remaining parts continue in effect. The strongest disclaimer permitted
by applicable law shall apply in place of any invalid clause.

# Contributing to Score Arranger

Thanks for your interest in contributing. This document covers the
**legal** and **practical** essentials for submitting changes.

---

## 1. License & copyright

Score Arranger is licensed under [GPL-3.0-only](LICENSE).

**By submitting a contribution** (PR, patch, issue with code suggestion,
or any other form), **you agree that your contribution is licensed under
GPL-3.0-only** and may be redistributed by the project under those terms.

You retain copyright to your contribution; we do not require a CLA
(Contributor License Agreement) — the implicit DCO-equivalent above is
sufficient.

### Developer Certificate of Origin (DCO)

By contributing, you certify (per the
[Developer Certificate of Origin v1.1](https://developercertificate.org/))
that:

- The contribution was created in whole or part by you and you have the
  right to submit it under the project license, OR
- The contribution is based upon previous work that, to the best of your
  knowledge, is covered under an appropriate open source license that
  permits you to redistribute it under the project license, OR
- The contribution was provided to you by someone who certified one of
  the above, and you have not modified it

You may signify acceptance by signing off your commits with `git commit -s`
(adds a `Signed-off-by:` line). This is **encouraged but not required** —
the act of submitting a PR is itself acceptance of these terms.

### Third-party code in PRs

If your PR adds a new third-party dependency:

- Make sure the dependency's license is GPL-3.0-compatible
  (MIT / BSD / Apache-2.0 / ISC are fine; LGPL needs the same treatment
  as Verovio in [`NOTICE.md`](NOTICE.md) §1.3)
- Update [`NOTICE.md`](NOTICE.md) §1 and re-run
  `bash scripts/gen-third-party-licenses.sh THIRD_PARTY_LICENSES.md`

If your PR copies code (not just imports) from another project, include
the original copyright/license header.

---

## 2. Practical workflow

### Setup

```sh
git clone <repo>
cd score-arranger
npm install
python -m venv engine/.venv
engine/.venv/bin/pip install -e engine[dev]
```

### Run tests before submitting

```sh
# Python engine
cd engine && .venv/bin/python -m pytest

# Front-end typecheck
cd .. && npm run typecheck

# Mypy baseline must not regress
bash engine/scripts/check_mypy_baseline.sh
```

### Code style

- **Python**: ruff + mypy clean. Comments explain *why*, not *what*.
- **TypeScript**: strict mode, functional React components, biome lint clean.
- **User-facing strings**: zh-TW + en + ja in `i18n.*.ts`. zh-TW uses
  Taiwan framing (never `中国` / `Chinese` / `China`).
- **Commits**: descriptive subject, English or zh-TW both fine.

### PR description checklist

- [ ] What problem does this solve / what feature does this add?
- [ ] Tests added or existing tests cover the change
- [ ] Mypy baseline did not regress
- [ ] If dependency added: NOTICE.md updated, THIRD_PARTY_LICENSES.md regenerated
- [ ] If user-facing UI changed: all three locales (zh-TW / en / ja) updated

---

## 3. Reporting bugs / requesting features

Open a GitHub issue. Include:

- Score Arranger version (Help → About)
- macOS version (or Windows/Linux if you've ported it)
- Reproduction steps + expected vs. actual behavior
- For arrangement-quality issues: attach the MusicXML if you can
  (or describe the input ensemble + target ensemble)

---

## 4. Security issues

**Do not** report security vulnerabilities in public issues. See
[`SECURITY.md`](SECURITY.md).

---

## 5. Code of conduct

Be respectful. We follow the
[Contributor Covenant](https://www.contributor-covenant.org/version/2/1/code_of_conduct/)
by default. Disputes are resolved by the maintainer.

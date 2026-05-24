# Corresponding Source — Score Arranger

This document explains how to obtain the **Corresponding Source** for
any binary release of Score Arranger, as required by §6 of the
[GNU GPL-3.0](LICENSE).

---

## 1. Where to find the source

Each release published at the project's GitHub releases page links to:

- A **git tag** matching the version (e.g. `v0.1.33`)
- A **commit hash** in the release notes

You can fetch the exact source for any release with:

```sh
git clone https://github.com/kevinlinxyz/score-arranger.git
cd score-arranger
git checkout v0.1.33   # match your binary version
```

If GitHub is unavailable to you, a tarball of the source for any
released version is available on request (see §5).

---

## 2. Build instructions (macOS)

Reproducing the signed `.dmg` we publish requires the macOS toolchain
and an Apple Developer ID certificate (not redistributable). However,
producing an **unsigned `.app`** that behaves identically is fully
documented and reproducible from source:

```sh
# Prereqs: Node 20+, Python 3.11+, macOS, Xcode CLT
npm install
python -m venv engine/.venv
engine/.venv/bin/pip install -e engine[dev]

# Build (unsigned)
npm run dist:mac:unsigned

# Output: dist/Score Arranger-<version>-arm64-mac.zip
```

The unsigned build differs from the signed release only in code-signing
metadata; bit-for-bit equivalence of the underlying JavaScript and
Python is preserved.

For Linux / Windows builds, the same process applies with
`electron-builder` targets for those platforms (not officially supported
yet, but the build script is portable in principle).

---

## 3. Frozen Python engine — source correspondence

The macOS `.dmg` bundles a PyInstaller-frozen Python binary at
`Score Arranger.app/Contents/Resources/engine/score-arranger-engine`.

This binary is produced by `engine/freeze.sh`, which:

1. Reads `engine/core/*.py` (the application source — all in this repo)
2. Resolves `engine/pyproject.toml` dependencies into `engine/.venv`
3. Calls PyInstaller with `--collect-all music21 --add-data sample_scores`
4. Outputs a standalone executable + supporting `.dylib`s

To reproduce the frozen engine alone:

```sh
cd engine
bash freeze.sh
# Output: engine/build-pyi/dist/score-arranger-engine/
```

The freeze process is deterministic up to dependency resolution
(`pip install`); to lock to exact dep versions, see
[`THIRD_PARTY_LICENSES.md`](THIRD_PARTY_LICENSES.md) for the version
manifest of the last published release.

---

## 4. Replacing Verovio (LGPL §6)

Verovio is bundled at:

```
Score Arranger.app/Contents/Resources/app.asar
  → node_modules/verovio/wasm/verovio-toolkit-wasm.js
  → node_modules/verovio/wasm/verovio-toolkit-wasm.wasm
```

To exercise your LGPL right to **substitute a different Verovio build**:

1. Build (or download) the Verovio JavaScript/WASM bundle you want from
   <https://github.com/rism-digital/verovio>. The build target you need
   is the "JS toolkit" — `npm run` inside the verovio repo produces
   `verovio-toolkit-wasm.js` + `.wasm`.

2. Extract the app.asar (one-time):
   ```sh
   cd "/Applications/Score Arranger.app/Contents/Resources/"
   npx asar extract app.asar app.asar.contents
   ```

3. Replace the verovio files inside `app.asar.contents/node_modules/verovio/wasm/`
   with your build.

4. Re-pack (or delete `app.asar` and rename `app.asar.contents` → `app`).
   ```sh
   npx asar pack app.asar.contents app.asar
   ```

5. Re-sign the app if you want Gatekeeper to keep trusting it (requires
   your own developer cert):
   ```sh
   codesign --force --deep --sign "Developer ID Application: <YOUR NAME>" \
     "/Applications/Score Arranger.app"
   ```
   Or remove the quarantine bit if you accept the unsigned state:
   ```sh
   xattr -dr com.apple.quarantine "/Applications/Score Arranger.app"
   ```

The PDF export feature will then use your Verovio build.

> Note: We do not modify Verovio. The bundle is shipped verbatim from
> `npm install verovio`. If you discover incompatibilities with newer
> Verovio releases, please file an issue.

---

## 5. Written offer (GPL §6(b))

For any binary released by this project, the maintainer commits to
providing the Corresponding Source (machine-readable, complete) on
request, for the duration of three years from the release date,
charging no more than the cost of physically performing the source
distribution.

Requests: email the maintainer (see [`SECURITY.md`](SECURITY.md) for
contact). In practice, the most efficient route is always `git clone`
from the public repository.

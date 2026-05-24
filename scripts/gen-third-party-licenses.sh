#!/usr/bin/env bash
# 重新產出 THIRD_PARTY_LICENSES.md — 列出所有 bundled 第三方授權.
# 每次發 release 前跑一次, commit 進 repo.
#
# 用法: bash scripts/gen-third-party-licenses.sh > THIRD_PARTY_LICENSES.md
# 或:  bash scripts/gen-third-party-licenses.sh THIRD_PARTY_LICENSES.md

set -euo pipefail

cd "$(dirname "$0")/.."
OUT="${1:-/dev/stdout}"

ENGINE_PY=".venv/bin/python"
if [[ ! -x "engine/$ENGINE_PY" ]]; then
  echo "WARNING: engine/.venv 不存在, Python deps 區會空" >&2
fi

{
cat <<'EOF'
# Third-Party Licenses — Score Arranger

**Auto-generated** by `scripts/gen-third-party-licenses.sh`. To refresh:

```sh
bash scripts/gen-third-party-licenses.sh THIRD_PARTY_LICENSES.md
```

This file enumerates **every package whose code is bundled into the
distributed binaries** (npm transitive prod deps + Python frozen deps).
Curated top-level notices and conditions remain in [`NOTICE.md`](NOTICE.md).

EOF

echo "Last generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
echo "## npm — production dependencies (transitive)"
echo ""
echo "Extracted from \`package-lock.json\`."
echo ""
echo "| Package | Version | License |"
echo "|---------|---------|---------|"
node -e "
const fs = require('fs');
const pl = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const prodDeps = new Set(Object.keys(pkg.dependencies || {}));
const visited = new Set();
const toVisit = [...prodDeps];
const results = [];
function walk(name) {
  if (visited.has(name)) return;
  visited.add(name);
  const candidates = [
    'node_modules/' + name,
    ...Object.keys(pl.packages).filter(p => p.endsWith('/node_modules/' + name)),
  ];
  for (const path of candidates) {
    const p = pl.packages[path];
    if (!p) continue;
    const lic = typeof p.license === 'string' ? p.license : JSON.stringify(p.license || '?');
    results.push([name, p.version || '?', lic]);
    for (const dep of Object.keys(p.dependencies || {})) toVisit.push(dep);
    break;
  }
}
while (toVisit.length) walk(toVisit.shift());
results.sort();
for (const [n, v, l] of results) console.log('| ' + n + ' | ' + v + ' | ' + l + ' |');
"

echo ""
echo "## Python — frozen engine dependencies"
echo ""
echo "Extracted from \`engine/.venv\` (the venv used by \`engine/freeze.sh\`)."
echo ""
echo "| Package | Version | License |"
echo "|---------|---------|---------|"
if [[ -x "engine/$ENGINE_PY" ]]; then
  cd engine && "$ENGINE_PY" -c "
import importlib.metadata as md
pkgs = sorted(md.distributions(), key=lambda d: d.metadata['Name'].lower())
EXCLUDE = {'mypy', 'mypy-extensions', 'mypy_extensions', 'pytest', 'pytest-cov',
           'ruff', 'coverage', 'pluggy', 'iniconfig', 'pip', 'setuptools',
           'wheel', 'pyinstaller', 'pyinstaller-hooks-contrib', 'macholib',
           'altgraph'}
for d in pkgs:
    name = d.metadata['Name']
    if not name or name.lower() in EXCLUDE:
        continue
    ver = d.version or '?'
    lic = d.metadata.get('License-Expression') or d.metadata.get('License') or ''
    # 短化過長的 license 文字 (有些 package 把整段全文塞進 License 欄位)
    if len(lic) > 80 or '\n' in lic:
        cls = [c for c in d.metadata.get_all('Classifier') or []
               if c.startswith('License ::')]
        if cls:
            lic = cls[0].split('::')[-1].strip()
        else:
            lic = '(see distribution)'
    print(f'| {name} | {ver} | {lic or \"?\"} |')
"
  cd ..
else
  echo "| _(engine/.venv missing — re-run after \`python -m venv engine/.venv && pip install -e engine\`)_ | | |"
fi

echo ""
echo "---"
echo ""
echo "**Note on excluded dev tools**: build/test tools (mypy, pytest, ruff,"
echo "coverage, PyInstaller itself, etc.) are excluded — they are not part"
echo "of the distributed binary, only the build environment."
} > "$OUT"

if [[ "$OUT" != "/dev/stdout" ]]; then
  echo "Wrote: $OUT"
fi

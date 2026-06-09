"""OMR 後校正 PoC — harmony-aware 偵測/校正 OMR 類錯誤 (③ 路線)。

決策見 docs/decision-pdf-omr.html: 投資 D + 先建評估集 + 先做此 PoC。
研究結論: LLM 放 OMR「之後」做符號層校正 (不是之前清影像)。

本 PoC 用「受控錯誤注入」量化 harmony context 能多大程度偵測/修正 OMR 類錯誤:
  乾淨 MusicXML → 注入 OMR 類音高錯誤 → 在被汙染的譜上跑 harmony 分析 →
  用 classify_note_function 偵測可疑音 → 對照 ground truth 算 recall/precision。

關鍵誠實點:
  - harmony 偵測靠 pitch-class。±1/±2 半音 (線間/臨時記號誤判) 會改 pc → 可偵測。
  - ±12 八度誤判**不改 pc** → 仍是和弦音 → harmony 偵測**盲區** (需音域/旋律輪廓推理,
    正是 LLM / range-model 要補的)。故 recall 依錯誤型別拆開報。
  - precision 難點: 真實音樂本有大量合法 NCT (經過/掛留/鄰音), classify 已盡量豁免它們;
    剩下 "other" 才當可疑。clean 譜的 "other" 率 = 假陽性底線。

rule-only baseline 不需 LLM, 可直接跑。LLM leg (build_llm_prompts) 備好, 有
ANTHROPIC_API_KEY 才實跑 (此環境無 key → 只輸出 prompt 樣本)。
"""
from __future__ import annotations

import copy
import dataclasses
import json
import os
import random
import sys
from fractions import Fraction
from pathlib import Path

ENGINE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ENGINE))

from core.analyzer.harmony_function import (  # noqa: E402
    _per_part_cumulative_starts,
    _region_starts_float,
    analyze_harmony,
    classify_note_function,
    find_region_at,
)
from core.ir import NoteEvent  # noqa: E402
from core.parser import parse_musicxml  # noqa: E402

# OMR 類音高錯誤模型: (semitone delta, weight, kind)
ERROR_MODEL = [
    (-1, 3, "pc"), (1, 3, "pc"),     # 臨時記號 / 半音誤判
    (-2, 2, "pc"), (2, 2, "pc"),     # 線間誤判
    (-12, 1, "octave"), (12, 1, "octave"),  # 八度誤判 (pc 不變)
]
_NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]


def _spelling(midi: int) -> str:
    return f"{_NAMES[midi % 12]}{midi // 12 - 1}"


def _melodic_notes(score):
    """回傳 [(part_idx, measure, voice_id, ev_idx, NoteEvent), ...] (僅 NoteEvent)。"""
    out = []
    for pi, part in enumerate(score.parts):
        for measure in part.measures:
            for vid, voice in measure.voices.items():
                for i, ev in enumerate(voice.events):
                    if isinstance(ev, NoteEvent):
                        out.append((pi, measure, vid, i, ev))
    return out


def inject_errors(score, rate: float, rng: random.Random):
    """注入 OMR 類音高錯誤; 回傳 ground-truth 錯誤清單。in-place 改 score。"""
    notes = _melodic_notes(score)
    n_err = max(3, int(len(notes) * rate))
    targets = rng.sample(notes, min(n_err, len(notes)))
    deltas, weights = [(d, k) for d, _, k in ERROR_MODEL], [w for _, w, _ in ERROR_MODEL]
    truth = []
    for (pi, measure, vid, i, ev) in targets:
        (delta, kind) = rng.choices(deltas, weights=weights, k=1)[0]
        orig = ev.pitch.midi_number
        new_midi = orig + delta
        if not (0 <= new_midi <= 127):
            new_midi = orig - delta
            delta = -delta
        new_pitch = dataclasses.replace(
            ev.pitch, midi_number=new_midi, spelling=_spelling(new_midi)
        )
        measure.voices[vid].events[i] = dataclasses.replace(ev, pitch=new_pitch)
        truth.append({
            "part": pi, "measure": measure.number, "voice": vid, "idx": i,
            "orig_midi": orig, "corrupt_midi": new_midi, "delta": delta, "kind": kind,
        })
    return truth


def detect(score):
    """harmony-aware 偵測。回傳 {(part,measure,voice,idx): {...}} 含 cls / suspicious / fix。"""
    regions = analyze_harmony(score)
    if not regions:
        return {}, None
    starts_float = _region_starts_float(regions)
    cum = _per_part_cumulative_starts(score)
    out = {}
    for pi, part in enumerate(score.parts):
        mstarts = cum[pi]
        for measure in part.measures:
            mstart = mstarts.get(measure.number, Fraction(0))
            for vid, voice in measure.voices.items():
                seq = [(i, ev) for i, ev in enumerate(voice.events)
                       if isinstance(ev, NoteEvent)]
                gons = [mstart + ev.onset for _, ev in seq]
                for k, (i, ev) in enumerate(seq):
                    midi = ev.pitch.midi_number
                    region = find_region_at(regions, gons[k], starts_float)
                    if region is None:
                        continue
                    prev_midi = seq[k - 1][1].pitch.midi_number if k > 0 else None
                    next_midi = seq[k + 1][1].pitch.midi_number if k + 1 < len(seq) else None
                    prev_region = (find_region_at(regions, gons[k - 1], starts_float)
                                   if k > 0 else None)
                    cls = classify_note_function(
                        midi, region, prev_midi, prev_region, next_midi)
                    suspicious = cls == "other"
                    fix = None
                    if suspicious:
                        # 提議修正: 最小 |±1,±2| 使 pc 落入和弦音 (octave 錯誤抓不到, 因 pc 不變)
                        for d in (1, -1, 2, -2):
                            if (midi + d) % 12 in region.ideal_pitch_classes:
                                fix = midi + d
                                break
                    out[(pi, measure.number, vid, i)] = {
                        "midi": midi, "cls": cls, "suspicious": suspicious, "fix": fix,
                    }
    return out, regions


def evaluate(path: str, rate: float, seed: int):
    clean = parse_musicxml(path)
    clean_det, regions = detect(clean)
    if regions is None:
        return {"name": Path(path).stem, "skipped": "no harmony regions"}
    # clean 譜的 "other" 率 = 假陽性底線
    clean_other = sum(1 for d in clean_det.values() if d["suspicious"])
    clean_total = len(clean_det)

    corrupt = parse_musicxml(path)  # 重新 parse 一份乾淨的去汙染
    rng = random.Random(seed)
    truth = inject_errors(corrupt, rate, rng)
    det, _ = detect(corrupt)

    truth_keys = {(t["part"], t["measure"], t["voice"], t["idx"]): t for t in truth}
    flagged = {k for k, d in det.items() if d["suspicious"]}

    # recall 依錯誤型別
    pc_truth = {k for k, t in truth_keys.items() if t["kind"] == "pc"}
    oct_truth = {k for k, t in truth_keys.items() if t["kind"] == "octave"}
    pc_hit = len(pc_truth & flagged)
    oct_hit = len(oct_truth & flagged)

    # precision: flagged 中有多少真的是注入錯誤
    tp = len(flagged & set(truth_keys))
    precision = tp / len(flagged) if flagged else 0.0

    # 修正準確率: 提議 fix == 原音 (僅 pc 類, 在 flagged∩truth 上)
    fix_ok = 0
    for k in (flagged & set(truth_keys)):
        if det[k]["fix"] is not None and det[k]["fix"] == truth_keys[k]["orig_midi"]:
            fix_ok += 1

    return {
        "name": Path(path).stem,
        "notes": clean_total,
        "injected": len(truth),
        "pc_errors": len(pc_truth), "octave_errors": len(oct_truth),
        "recall_pc": round(pc_hit / len(pc_truth), 3) if pc_truth else None,
        "recall_octave": round(oct_hit / len(oct_truth), 3) if oct_truth else None,
        "precision": round(precision, 3),
        "fix_accuracy_on_caught": round(fix_ok / tp, 3) if tp else None,
        "clean_nct_floor": round(clean_other / clean_total, 3) if clean_total else None,
    }


def build_llm_prompts(corrupt_path: str, max_prompts: int = 3):
    """為 LLM leg 備好 per-可疑音 prompt (有 key 才實跑; 此處只示範樣本)。"""
    score = parse_musicxml(corrupt_path)
    det, regions = detect(score)
    if regions is None:
        return []
    prompts = []
    for (pi, mnum, vid, i), d in det.items():
        if not d["suspicious"]:
            continue
        region = find_region_at(regions, Fraction(0), None)  # 簡化: 示範用
        prompts.append({
            "context": (
                f"調性 {region.key.name if region else '?'}, 此處和弦 "
                f"{region.roman.figure_string if region else '?'} "
                f"(和弦音 pc={sorted(region.ideal_pitch_classes) if region else []})。"
            ),
            "question": (
                f"第 {mnum} 小節有個音 midi={d['midi']} 被 harmony 判為自由非和弦音。"
                "考慮 OMR 常見誤判 (±1/±2 半音=臨時記號/線間, ±12=八度), "
                "判斷它是否疑似辨識錯誤; 若是, 提議最可能的正確音高。"
            ),
        })
        if len(prompts) >= max_prompts:
            break
    return prompts


def emit_packet(path: str, rate: float, seed: int, truth_out: str):
    """產生「盲測封包」: flagged 候選 + 完整 context, 但印出時不含 ground truth。

    用途: 讓 LLM (含「我自己當 LLM」) 只憑 context 做 triage, 再用 grade() 計分。
    """
    corrupt = parse_musicxml(path)
    truth = inject_errors(corrupt, rate, random.Random(seed))
    truth_keys = {(t["part"], t["measure"], t["voice"], t["idx"]): t for t in truth}
    regions = analyze_harmony(corrupt)
    starts_float = _region_starts_float(regions)
    cum = _per_part_cumulative_starts(corrupt)
    cands = []
    cid = 0
    for pi, part in enumerate(corrupt.parts):
        mstarts = cum[pi]
        for measure in part.measures:
            mstart = mstarts.get(measure.number, Fraction(0))
            for vid, voice in measure.voices.items():
                seq = [(i, ev) for i, ev in enumerate(voice.events)
                       if isinstance(ev, NoteEvent)]
                gons = [mstart + ev.onset for _, ev in seq]
                for k, (i, ev) in enumerate(seq):
                    midi = ev.pitch.midi_number
                    region = find_region_at(regions, gons[k], starts_float)
                    if region is None:
                        continue
                    prev_midi = seq[k - 1][1].pitch.midi_number if k > 0 else None
                    next_midi = seq[k + 1][1].pitch.midi_number if k + 1 < len(seq) else None
                    prev_region = (find_region_at(regions, gons[k - 1], starts_float)
                                   if k > 0 else None)
                    cls = classify_note_function(
                        midi, region, prev_midi, prev_region, next_midi)
                    if cls != "other":
                        continue
                    key = (pi, measure.number, vid, i)
                    cands.append({
                        "cid": cid, "key": list(key), "measure": measure.number,
                        "note": _spelling(midi), "midi": midi,
                        "keysig": region.key.name, "roman": region.roman.figure_string,
                        "chord_pcs": sorted(region.ideal_pitch_classes),
                        "prev": _spelling(prev_midi) if prev_midi is not None else None,
                        "next": _spelling(next_midi) if next_midi is not None else None,
                        "_is_error": key in truth_keys,
                        "_orig": truth_keys[key]["orig_midi"] if key in truth_keys else None,
                    })
                    cid += 1
    Path(truth_out).write_text(json.dumps(cands, ensure_ascii=False, indent=2))
    print(f"=== 盲測封包: {Path(path).stem} ({len(cands)} 個 flagged 候選) ===")
    print("(只給 context, 不給答案。triage: 每個候選判 真錯誤? + 提議正確音)\n")
    for c in cands:
        print(f"cid={c['cid']:>2} | m{c['measure']} {c['note']}(midi {c['midi']}) | "
              f"{c['keysig']} {c['roman']} 和弦pc={c['chord_pcs']} | "
              f"prev={c['prev']} next={c['next']}")
    print(f"\ntruth 寫入 {truth_out} (grade 時讀)")


def grade(truth_path: str, verdicts_path: str):
    """用 LLM verdicts (含我自己當 LLM 的) 對盲測封包計分, 比較 rule-only vs LLM-triage。"""
    cands = json.loads(Path(truth_path).read_text())
    verdicts = json.loads(Path(verdicts_path).read_text())  # {cid: {error:bool, fix:int|null}}
    by_cid = {c["cid"]: c for c in cands}
    total = len(cands)
    real = sum(1 for c in cands if c["_is_error"])
    kept = [int(cid) for cid, v in verdicts.items() if v.get("error")]
    tp = sum(1 for cid in kept if by_cid[cid]["_is_error"])
    llm_prec = tp / len(kept) if kept else 0.0
    llm_recall = tp / real if real else 0.0
    fix_ok = sum(1 for cid in kept if by_cid[cid]["_is_error"]
                 and verdicts[str(cid)].get("fix") == by_cid[cid]["_orig"])
    print(f"=== 計分: {total} 個 flagged 候選, 其中真錯誤 {real} ===")
    print(f"rule-only (全留為可疑): precision={real / total:.3f}  recall=1.000")
    print(f"LLM-triage (留 {len(kept)} 個): precision={llm_prec:.3f}  "
          f"recall={llm_recall:.3f}  修正對={fix_ok}/{tp}")
    delta = llm_prec - real / total
    print(f"→ precision 變化: {delta:+.3f} ({'LLM triage 有效' if delta > 0 else '無改善'})")


def call_anthropic(prompt: str, model: str = "claude-opus-4-20250514") -> str:
    """PoC 專用最小 Anthropic 呼叫 (raw HTTP, 無相依)。需 ANTHROPIC_API_KEY。"""
    import urllib.request
    key = os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY 未設")
    body = json.dumps({
        "model": model, "max_tokens": 256,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages", data=body,
        headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                 "content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = json.loads(r.read())
    return "".join(b.get("text", "") for b in data.get("content", []))


def main():
    # CLI dispatch
    if len(sys.argv) > 1 and sys.argv[1] == "packet":
        sd = ENGINE / "core" / "sample_scores"
        emit_packet(str(sd / "bach_chorale_336.musicxml"), 0.08, 1234,
                    "/tmp/omr_poc_truth.json")
        return
    if len(sys.argv) > 2 and sys.argv[1] == "grade":
        grade("/tmp/omr_poc_truth.json", sys.argv[2])
        return

    sample_dir = ENGINE / "core" / "sample_scores"
    # 挑和聲密度不同的代表曲: Bach chorale (最密) / Corelli / Beethoven / Chopin
    picks = [
        "bach_chorale_336", "corelli_opus3no1_1grave",
        "beethoven_sonata_06_1", "chopin_prelude_28_13",
    ]
    rate, seed = 0.08, 1234
    print(f"=== OMR 後校正 PoC (rule-only baseline, rate={rate}, seed={seed}) ===\n")
    rows = []
    for stem in picks:
        p = sample_dir / f"{stem}.musicxml"
        if not p.exists():
            print(f"  (跳過 {stem}: 找不到)")
            continue
        try:
            rows.append(evaluate(str(p), rate, seed))
        except Exception as e:
            print(f"  (失敗 {stem}: {type(e).__name__}: {e})")
    hdr = ("曲目", "音數", "注入", "recall_pc", "recall_8va", "precision",
           "修正準確", "NCT底線")
    print(f"{hdr[0]:<26}{hdr[1]:>5}{hdr[2]:>5}{hdr[3]:>10}{hdr[4]:>10}"
          f"{hdr[5]:>10}{hdr[6]:>9}{hdr[7]:>9}")
    print("-" * 96)
    for r in rows:
        if "skipped" in r:
            print(f"{r['name']:<26}  (skip: {r['skipped']})")
            continue
        print(f"{r['name']:<26}{r['notes']:>5}{r['injected']:>5}"
              f"{str(r['recall_pc']):>10}{str(r['recall_octave']):>10}"
              f"{str(r['precision']):>10}{str(r['fix_accuracy_on_caught']):>9}"
              f"{str(r['clean_nct_floor']):>9}")
    print()
    print("解讀:")
    print("  recall_pc   = ±1/±2 半音錯誤被 harmony 抓到的比例 (harmony 強項)")
    print("  recall_8va  = 八度錯誤被抓到的比例 — 預期接近 0 (pc 不變, harmony 盲區)")
    print("  precision   = 被標可疑的音裡真的是注入錯誤的比例 (越高越好)")
    print("  NCT底線     = 乾淨譜本來就被判 'other' 的比例 = 假陽性底線 (越低越好)")
    print("  → 八度盲區 + 假陽性底線, 正是 LLM/range-model 要補的 headroom。")

    key = os.environ.get("ANTHROPIC_API_KEY")
    print(f"\n[LLM leg] ANTHROPIC_API_KEY: {'有' if key else '無 → 只輸出 prompt 樣本'}")
    p = sample_dir / "bach_chorale_336.musicxml"
    if p.exists():
        corrupt = parse_musicxml(str(p))
        inject_errors(corrupt, rate, random.Random(seed))
        import tempfile
        from core.ir_to_musicxml import score_to_musicxml
        tmp = Path(tempfile.gettempdir()) / "_omr_poc_corrupt.musicxml"
        tmp.write_text(score_to_musicxml(corrupt))
        for j, pr in enumerate(build_llm_prompts(str(tmp), max_prompts=2), 1):
            print(f"  prompt#{j}: {pr['context']} {pr['question']}")

    out = ENGINE / "scripts" / "omr_poc_result.json"
    out.write_text(json.dumps(rows, ensure_ascii=False, indent=2))
    print(f"\n結果寫入 {out.relative_to(ENGINE)}")


if __name__ == "__main__":
    main()

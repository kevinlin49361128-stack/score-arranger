"""
Score Arranger CLI — Phase 0 可行性實驗工具

提供以下子命令:
- parse: MusicXML → IR JSON
- validate: 解析 + 驗證 IR 不變式
- phrases: 解析 + 偵測樂句邊界
- check-playability: 解析 + 對每個聲部的和弦做可演奏性檢查
- analyze: 完整分析報告 (整合上述功能)

用法:
    python -m core.cli parse score.musicxml --pretty
    python -m core.cli validate score.musicxml
    python -m core.cli phrases score.musicxml --json
    python -m core.cli check-playability score.musicxml
    python -m core.cli analyze score.musicxml > report.json
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Optional

from core.analyzer import (
    analyze_harmony,
    detect_phrases,
    tag_all_sections,
)
from core.arrangement_model import (
    ENSEMBLE_TEMPLATES,
    build_ensemble,
    violin_piano_ensemble,
)
from core.arranger import arrange
from core.evaluation import evaluate_phrase_detection, load_annotation
from core.instruments import (
    check_piano_hand_span,
    check_pitch_in_range,
    check_violin_chord,
    get_profile,
)
from core.ir import ChordEvent, Movement, NoteEvent, Score, Section, VoiceFunction
from core.ir_serialize import to_dict, to_json
from core.ir_validate import validate
from core.musicxml_writer import write_musicxml_file, write_musicxml_string
from core.parser import parse_musicxml
from core.repair import collect_issues, repair_loop, severity_score


# ============================================================================
# Subcommand: parse
# ============================================================================

def cmd_parse(args: argparse.Namespace) -> int:
    score = parse_musicxml(args.input)
    indent = 2 if args.pretty else None
    print(to_json(score, indent=indent))
    return 0


# ============================================================================
# Subcommand: validate
# ============================================================================

def cmd_validate(args: argparse.Namespace) -> int:
    score = parse_musicxml(args.input)
    result = validate(score)

    if args.json:
        out = {
            "ok": result.ok,
            "errors": [_validation_error_to_dict(e) for e in result.errors],
            "warnings": [_validation_error_to_dict(w) for w in result.warnings],
        }
        print(json.dumps(out, indent=2, ensure_ascii=False))
    else:
        for e in result.errors:
            loc = f" [{e.location}]" if e.location else ""
            print(f"ERROR  {e.code}{loc}: {e.message}", file=sys.stderr)
        for w in result.warnings:
            loc = f" [{w.location}]" if w.location else ""
            print(f"WARN   {w.code}{loc}: {w.message}", file=sys.stderr)
        if result.ok:
            print(
                f"OK ({len(result.warnings)} warnings)",
                file=sys.stderr,
            )
        else:
            print(
                f"FAIL: {len(result.errors)} errors, "
                f"{len(result.warnings)} warnings",
                file=sys.stderr,
            )

    return 0 if result.ok else 1


# ============================================================================
# Subcommand: phrases
# ============================================================================

def cmd_phrases(args: argparse.Namespace) -> int:
    score = parse_musicxml(args.input)
    report = _build_phrase_report(score)

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        for part_id, sections in report.items():
            print(f"\n=== {part_id} ===")
            for section in sections:
                print(f"  Section {section['section_id']} "
                      f"(m.{section['start']}-{section['end']})")
                for ph in section["phrases"]:
                    bar = _confidence_bar(ph["confidence"])
                    print(f"    Phrase {ph['phrase_id']:>3}: "
                          f"m.{ph['start']:>4}-{ph['end']-1:<4} "
                          f"conf={ph['confidence']:.2f} {bar}")
    return 0


def _build_phrase_report(score: Score) -> dict[str, list[dict]]:
    """為每個 part × section 偵測樂句, 回傳分層 dict。"""
    out: dict[str, list[dict]] = {}
    sections = _ensure_sections(score)

    for part in score.parts:
        out[part.part_id] = []
        for section in sections:
            phrases = detect_phrases(part, section)
            out[part.part_id].append({
                "section_id": section.section_id,
                "section_name": section.name,
                "start": section.start_measure,
                "end": section.end_measure,
                "phrases": [
                    {
                        "phrase_id": p.phrase_id,
                        "start": p.start[0],
                        "end": p.end[0],
                        "confidence": round(p.detection_confidence, 3),
                    }
                    for p in phrases
                ],
            })
    return out


# ============================================================================
# Subcommand: check-playability
# ============================================================================

def cmd_check_playability(args: argparse.Namespace) -> int:
    score = parse_musicxml(args.input)
    report = _build_playability_report(score)

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        total_errors = sum(p["error_count"] for p in report.values())
        total_warnings = sum(p["warning_count"] for p in report.values())
        for part_id, info in report.items():
            print(f"\n=== {part_id} ({info['instrument_id']}) ===")
            print(f"  ERRORS:   {info['error_count']}")
            print(f"  WARNINGS: {info['warning_count']}")
            for issue in info["issues"][:10]:  # 前 10 筆
                marker = "🔴" if issue["severity"] == "error" else "🟡"
                print(f"  {marker} m.{issue['measure']:>4}: "
                      f"{issue['code']} {issue['params']}")
            if len(info["issues"]) > 10:
                print(f"  ... 還有 {len(info['issues']) - 10} 個問題")
        print(f"\n總計: {total_errors} errors, {total_warnings} warnings",
              file=sys.stderr)
    return 0


def _build_playability_report(score: Score) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for part in score.parts:
        profile = get_profile(part.instrument_id)
        issues: list[dict] = []

        if profile is None:
            # 未知樂器,僅報告
            out[part.part_id] = {
                "instrument_id": part.instrument_id,
                "instrument_known": False,
                "issues": [],
                "error_count": 0,
                "warning_count": 0,
            }
            continue

        for measure in part.measures:
            for voice in measure.voices.values():
                if voice.is_divisi:
                    continue
                for event in voice.events:
                    issues.extend(
                        _check_event(event, measure.number, part.instrument_id)
                    )

        out[part.part_id] = {
            "instrument_id": part.instrument_id,
            "instrument_known": True,
            "issues": issues,
            "error_count": sum(1 for i in issues if i["severity"] == "error"),
            "warning_count": sum(1 for i in issues if i["severity"] == "warning"),
        }
    return out


def _check_event(event, measure_number: int, instrument_id: str) -> list[dict]:
    """對單一事件做可演奏性檢查, 回傳 issue dict 列表。"""
    issues: list[dict] = []
    profile = get_profile(instrument_id)
    if profile is None:
        return issues

    if isinstance(event, NoteEvent):
        # 單音音域檢查
        result = check_pitch_in_range(event.pitch, profile)
        if not result.is_ok:
            issues.append(_check_result_to_dict(result, measure_number))

    elif isinstance(event, ChordEvent):
        # 和弦特定樂器檢查
        if instrument_id == "violin":
            result = check_violin_chord(event.pitches)
            if not result.is_ok:
                issues.append(_check_result_to_dict(result, measure_number))
        elif instrument_id == "piano":
            # 鋼琴: 假設整個 chord 用右手 (簡化, Phase 2 需推斷分手)
            result = check_piano_hand_span(event.pitches, hand="right")
            if not result.is_ok:
                issues.append(_check_result_to_dict(result, measure_number))
        else:
            # 其他樂器: 僅檢查各音音域
            for pitch in event.pitches:
                result = check_pitch_in_range(pitch, profile)
                if not result.is_ok:
                    issues.append(_check_result_to_dict(result, measure_number))

    return issues


def _check_result_to_dict(result, measure_number: int) -> dict:
    return {
        "severity": result.severity,
        "code": result.code,
        "params": result.params,
        "measure": measure_number,
        "difficulty": round(result.difficulty_score, 3),
        "suggestions": [
            {"code": s.code, "params": s.params}
            for s in result.suggestions
        ],
    }


# ============================================================================
# Subcommand: to-musicxml
# ============================================================================

def cmd_to_musicxml(args: argparse.Namespace) -> int:
    """將任何 music21 可解析的格式轉為 MusicXML 字串輸出。

    用途: 前端載入 .mxl / MIDI / .krn 等格式時透過此命令轉為 OSMD 可吃的 MusicXML。
    """
    from music21 import converter, musicxml as m21_musicxml
    m21_score = converter.parse(args.input)
    exporter = m21_musicxml.m21ToXml.GeneralObjectExporter(m21_score)
    sys.stdout.write(exporter.parse().decode("utf-8"))
    return 0


# ============================================================================
# Subcommand: tag-functions
# ============================================================================

def cmd_tag_functions(args: argparse.Namespace) -> int:
    score = parse_musicxml(args.input)
    reports = tag_all_sections(score)

    if args.json:
        out = {
            str(section_id): {
                "tags": {pid: tag.value for pid, tag in r.tags.items()},
                "melody_scores": {
                    pid: round(s, 3) for pid, s in r.melody_scores.items()
                },
                "bass_scores": {
                    pid: round(s, 3) for pid, s in r.bass_scores.items()
                },
            }
            for section_id, r in reports.items()
        }
        print(json.dumps(out, indent=2, ensure_ascii=False))
    else:
        for section_id, r in reports.items():
            print(f"\n=== Section {section_id} ===")
            for pid, tag in r.tags.items():
                m_score = r.melody_scores.get(pid, 0)
                b_score = r.bass_scores.get(pid, 0)
                print(f"  {pid:>20}: {tag.value:<15} "
                      f"(melody={m_score:.2f}, bass={b_score:.2f})")
    return 0


# ============================================================================
# Subcommand: arrange
# ============================================================================

def cmd_arrange(args: argparse.Namespace) -> int:
    score = parse_musicxml(args.input)

    if args.target not in ENSEMBLE_TEMPLATES:
        print(
            f"未知目標編制: {args.target} (可用: {sorted(ENSEMBLE_TEMPLATES)})",
            file=sys.stderr,
        )
        return 2
    players = build_ensemble(args.target)

    # 標記功能 (若尚未標)
    tag_all_sections(score)

    arrangement = arrange(score, players)

    # 執行修復迴圈
    repair_report = None
    if args.repair:
        initial_issues = collect_issues(arrangement.target_score)
        initial_score = severity_score(initial_issues)
        repair_report = repair_loop(arrangement)
        final_issues = collect_issues(arrangement.target_score)
        final_score = severity_score(final_issues)
        if not args.json:
            print(
                f"\n修復: 嚴重度 {initial_score:.1f} → {final_score:.1f} "
                f"({len(repair_report.iterations)} 次迭代, "
                f"{'已收斂' if repair_report.converged else '達上限'})",
                file=sys.stderr,
            )

    # 寫出 MusicXML
    if args.output:
        if arrangement.target_score is None:
            print("沒有產出 target_score, 無法匯出", file=sys.stderr)
            return 3
        out_path = write_musicxml_file(arrangement.target_score, args.output)
        print(f"已寫入 {out_path}", file=sys.stderr)

    if args.json:
        # 輸出 arrangement 摘要 + target_score + target_musicxml
        target_xml: Optional[str] = None
        if arrangement.target_score is not None:
            try:
                target_xml = write_musicxml_string(arrangement.target_score)
            except Exception as e:
                print(f"MusicXML 寫入失敗: {e}", file=sys.stderr)

        out = {
            "arrangement_id": arrangement.arrangement_id,
            "name": arrangement.name,
            "source_id": arrangement.source_id,
            "players": [
                {
                    "player_id": p.player_id,
                    "display_name": p.display_name,
                    "primary_instrument": p.primary_instrument,
                    "staves": p.staves,
                }
                for p in arrangement.players
            ],
            "assignments": [
                {
                    "id": a.assignment_id,
                    "source_part": a.source_part_id,
                    "target": f"{a.target_player_id}/{a.target_staff}",
                    "function": a.function.value,
                    "span": list(a.span),
                }
                for a in arrangement.assignments
            ],
            "target_musicxml": target_xml,
            "target_score": to_dict(arrangement.target_score)
            if arrangement.target_score else None,
        }
        print(json.dumps(out, indent=2, ensure_ascii=False))
    else:
        print(f"\nArrangement: {arrangement.name}")
        print(f"Source: {arrangement.source_id}")
        print(f"\nPlayers ({len(arrangement.players)}):")
        for p in arrangement.players:
            staves_label = "" if p.staves == 1 else f" ({p.staves} staves)"
            print(f"  • {p.display_name}{staves_label}")
        print(f"\nAssignments ({len(arrangement.assignments)}):")
        for a in arrangement.assignments:
            print(f"  {a.source_part_id:>15} → "
                  f"{a.target_player_id}/{a.target_staff:<6} "
                  f"[{a.function.value}]")

    return 0


# ============================================================================
# Subcommand: evaluate
# ============================================================================

def cmd_evaluate(args: argparse.Namespace) -> int:
    """跑 phrase detection 在資料集上,輸出 F1 統計表。"""
    from pathlib import Path
    from music21 import converter, corpus as m21_corpus

    use_harmony = getattr(args, "use_harmony", False)
    datasets_dir = Path(args.datasets_dir)
    if not datasets_dir.exists():
        print(f"資料集目錄不存在: {datasets_dir}", file=sys.stderr)
        return 2

    json_files = sorted(datasets_dir.glob("*.json"))
    if not json_files:
        print("沒有找到任何 annotation 檔", file=sys.stderr)
        return 1

    results: list[dict] = []
    for path in json_files:
        try:
            gt = load_annotation(path)
        except Exception as e:
            print(f"  跳過 {path.name}: {e}", file=sys.stderr)
            continue

        # 解析 source
        source_str = gt.source
        try:
            if source_str.startswith("music21:"):
                m21_score = m21_corpus.parse(source_str[len("music21:"):])
            elif source_str == "synthetic":
                # 合成資料: 跳過 (需專屬建構)
                continue
            else:
                m21_score = converter.parse(source_str)
        except Exception as e:
            print(f"  跳過 {gt.piece_id}: 解析失敗 ({e})", file=sys.stderr)
            continue

        ir = parse_musicxml.__self__ if hasattr(parse_musicxml, "__self__") else None
        from core.parser import parse_stream as _parse_stream
        ir = _parse_stream(m21_score)

        # 可選: 預先跑和聲分析 (用於整曲 cadence detection)
        cadences = None
        if use_harmony:
            try:
                harmony = analyze_harmony(ir)
                cadences = harmony.cadences
            except Exception as e:
                print(f"  和聲分析失敗 ({gt.piece_id}): {e}", file=sys.stderr)

        for ann in gt.annotations:
            section = Section(
                section_id=ann.section_id,
                start_measure=ann.section_range[0],
                end_measure=ann.section_range[1],
            )

            if ann.part_id == "all":
                # 用第一個 (通常為最高聲部) part
                target_parts = [ir.parts[0]] if ir.parts else []
            else:
                target_parts = [
                    p for p in ir.parts if p.part_id == ann.part_id
                ]

            for part in target_parts:
                phrases = detect_phrases(part, section, cadences=cadences)
                r = evaluate_phrase_detection(phrases, ann, tolerance=1)
                results.append({
                    "piece_id": gt.piece_id,
                    "part_id": part.part_id,
                    "f1": r.f1,
                    "precision": r.precision,
                    "recall": r.recall,
                    "displacement": r.avg_displacement,
                    "tp": r.true_positives,
                    "fp": r.false_positives,
                    "fn": r.false_negatives,
                    "passes": r.passes_phase_0_classical,
                })

    if args.json:
        print(json.dumps(results, indent=2, ensure_ascii=False))
    else:
        print(f"\n{'Piece':<30} {'F1':>6} {'P':>6} {'R':>6} {'Disp':>6} "
              f"{'TP/FP/FN':>10} {'Phase0':>8}")
        print("-" * 80)
        for r in results:
            mark = "✓" if r["passes"] else "—"
            print(f"{r['piece_id']:<30} "
                  f"{r['f1']:>6.2f} {r['precision']:>6.2f} "
                  f"{r['recall']:>6.2f} {r['displacement']:>6.1f} "
                  f"{r['tp']:>2}/{r['fp']:>2}/{r['fn']:>2}   {mark:>5}")
        if results:
            avg_f1 = sum(r["f1"] for r in results) / len(results)
            print("-" * 80)
            print(f"  平均 F1: {avg_f1:.3f}")

    return 0


# ============================================================================
# Subcommand: analyze (合併所有報告)
# ============================================================================

def cmd_analyze(args: argparse.Namespace) -> int:
    score = parse_musicxml(args.input)
    validation = validate(score)
    phrase_report = _build_phrase_report(score)
    playability = _build_playability_report(score)

    report = {
        "metadata": score.metadata,
        "summary": {
            "movement_count": len(score.movements),
            "measure_count": (
                max((len(p.measures) for p in score.parts), default=0)
            ),
            "part_count": len(score.parts),
            "parts": [
                {
                    "part_id": p.part_id,
                    "name": p.name_display,
                    "instrument_id": p.instrument_id,
                    "measure_count": len(p.measures),
                }
                for p in score.parts
            ],
        },
        "validation": {
            "ok": validation.ok,
            "error_count": len(validation.errors),
            "warning_count": len(validation.warnings),
            "errors": [_validation_error_to_dict(e) for e in validation.errors],
            "warnings": [_validation_error_to_dict(w) for w in validation.warnings],
        },
        "phrases": phrase_report,
        "playability": playability,
        "parse_warnings": score.parse_warnings,
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0


# ============================================================================
# Helpers
# ============================================================================

def _validation_error_to_dict(err) -> dict:
    return {
        "code": err.code,
        "message": err.message,
        "location": err.location,
    }


def _ensure_sections(score: Score) -> list[Section]:
    """若 Score 無 Section, 為每個 movement 建立預設 (整曲) Section。"""
    sections: list[Section] = []
    measure_count = max((len(p.measures) for p in score.parts), default=0)

    for movement in score.movements:
        if movement.sections:
            sections.extend(movement.sections)
        elif measure_count > 0:
            sections.append(Section(
                section_id=movement.movement_id,
                name=movement.title or f"Movement {movement.movement_id}",
                start_measure=1,
                end_measure=measure_count,
            ))

    # 若連 movement 都沒有, fallback
    if not sections and measure_count > 0:
        sections.append(Section(
            section_id=0,
            start_measure=1,
            end_measure=measure_count,
        ))

    return sections


def _confidence_bar(confidence: float, width: int = 20) -> str:
    """繪製信心度條 [██████░░░░] 0.60"""
    filled = int(confidence * width)
    return "[" + "█" * filled + "░" * (width - filled) + "]"


# ============================================================================
# Entry point
# ============================================================================

def _run_server() -> int:
    from core.server import serve
    serve()
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="score-arranger",
        description="Score Arranger 核心引擎 CLI (Phase 0 可行性實驗工具)",
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_parse = sub.add_parser("parse", help="解析 MusicXML 為 IR JSON")
    p_parse.add_argument("input", help="MusicXML 檔案路徑")
    p_parse.add_argument("--pretty", action="store_true", help="格式化 JSON 輸出")
    p_parse.set_defaults(func=cmd_parse)

    p_validate = sub.add_parser("validate", help="解析並驗證 IR 不變式")
    p_validate.add_argument("input")
    p_validate.add_argument("--json", action="store_true")
    p_validate.set_defaults(func=cmd_validate)

    p_phrases = sub.add_parser("phrases", help="偵測樂句邊界")
    p_phrases.add_argument("input")
    p_phrases.add_argument("--json", action="store_true")
    p_phrases.set_defaults(func=cmd_phrases)

    p_pl = sub.add_parser("check-playability", help="對各聲部做可演奏性檢查")
    p_pl.add_argument("input")
    p_pl.add_argument("--json", action="store_true")
    p_pl.set_defaults(func=cmd_check_playability)

    p_xml = sub.add_parser("to-musicxml", help="任意格式 → MusicXML 字串")
    p_xml.add_argument("input")
    p_xml.set_defaults(func=cmd_to_musicxml)

    p_server = sub.add_parser(
        "server",
        help="持久 server: stdin/stdout JSON-Lines 協定 (供 Electron bridge)",
    )
    p_server.set_defaults(func=lambda _args: _run_server())

    p_tag = sub.add_parser("tag-functions", help="為各 part 標記聲部功能")
    p_tag.add_argument("input")
    p_tag.add_argument("--json", action="store_true")
    p_tag.set_defaults(func=cmd_tag_functions)

    p_arr = sub.add_parser("arrange", help="執行改編 (Phase 1 四階段分配)")
    p_arr.add_argument("input")
    p_arr.add_argument(
        "--target", default="violin_piano",
        choices=sorted(ENSEMBLE_TEMPLATES.keys()),
        help="目標編制 (預設 violin_piano)",
    )
    p_arr.add_argument("--json", action="store_true")
    p_arr.add_argument(
        "--output", "-o", default=None,
        help="同時將 target_score 寫為 MusicXML 至此路徑",
    )
    p_arr.add_argument(
        "--repair", action="store_true",
        help="執行修復迴圈 (octave shift + omit notes)",
    )
    p_arr.set_defaults(func=cmd_arrange)

    p_eval = sub.add_parser("evaluate", help="跑 phrase detection 評估")
    p_eval.add_argument(
        "--datasets-dir",
        default="../evaluation/datasets",
        help="標註 JSON 檔所在目錄",
    )
    p_eval.add_argument("--json", action="store_true")
    p_eval.add_argument(
        "--use-harmony", action="store_true",
        help="同時跑和聲分析,把 cadence 當訊號加入 phrase detection",
    )
    p_eval.set_defaults(func=cmd_evaluate)

    p_analyze = sub.add_parser("analyze", help="完整分析報告 (JSON)")
    p_analyze.add_argument("input")
    p_analyze.set_defaults(func=cmd_analyze)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())

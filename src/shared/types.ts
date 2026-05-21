/**
 * 前後端共用型別定義。
 * 對應 Python IR (engine/core/ir.py) 的 JSON 序列化結構。
 */

// ============================================================================
// IR mirror types (subset, for UI consumption)
// ============================================================================

export type Fraction = string; // "3/8" or "2"

export interface Pitch {
  midi_number: number;
  spelling: string;
  written_midi: number | null;
  written_spelling: string | null;
}

export type VoiceFunction =
  | "melody"
  | "bass"
  | "countermelody"
  | "harmony_fill"
  | "pedal"
  | "ornamental"
  | "unassigned";

export type IssueSeverity = "error" | "warning" | "info";

export interface PlayabilityIssue {
  severity: IssueSeverity;
  code: string;
  params: Record<string, unknown>;
  measure: number;
  difficulty: number;
  suggestions: { code: string; params: Record<string, unknown> }[];
}

// ============================================================================
// Analysis report (engine/core/cli.py analyze 輸出結構)
// ============================================================================

export interface AnalysisReport {
  metadata: Record<string, string>;
  summary: {
    movement_count: number;
    measure_count: number;
    part_count: number;
    parts: PartSummary[];
  };
  validation: {
    ok: boolean;
    error_count: number;
    warning_count: number;
    errors: ValidationIssue[];
    warnings: ValidationIssue[];
  };
  phrases: Record<string, PhraseSection[]>;
  playability: Record<string, PlayabilityReport>;
  parse_warnings: string[];
}

export interface PartSummary {
  part_id: string;
  name: string;
  instrument_id: string;
  measure_count: number;
}

export interface ValidationIssue {
  code: string;
  message: string;
  location: string | null;
}

export interface PhraseSection {
  section_id: number;
  section_name: string | null;
  start: number;
  end: number;
  phrases: PhraseEntry[];
}

export interface PhraseEntry {
  phrase_id: number;
  start: number;
  end: number;
  confidence: number;
}

export interface PlayabilityReport {
  instrument_id: string;
  instrument_known: boolean;
  issues: PlayabilityIssue[];
  error_count: number;
  warning_count: number;
}

// ============================================================================
// Arrangement (Phase 1)
// ============================================================================

export type Staff = "main" | "upper" | "lower";

export interface PlayerInfo {
  player_id: string;
  display_name: string;
  primary_instrument: string;
  staves: number;
}

export interface AssignmentInfo {
  id: number;
  source_part: string;
  target: string; // "{player_id}/{staff}"
  function: VoiceFunction;
  span: [number, number];
}

export interface ArrangementResult {
  arrangement_id: string;
  name: string;
  source_id: string;
  players: PlayerInfo[];
  assignments: AssignmentInfo[];
  target_musicxml: string | null;
  target_score?: unknown;
  repair?: {
    iterations: number;
    converged: boolean;
    severity_before: number;
    severity_after: number;
    timeline?: RepairTimelineEntry[];
    quality_before?: QualityScores | null;
    quality_after?: QualityScores | null;
  } | null;
  issues?: ArrangementIssue[];
  /** 整體改編品質 (melody/harmony/playability) — 給 A/B 版本比較 */
  quality?: QualityScores | null;
}

/** 改編品質三項分數 (0~1) — repair 前/後比對用 */
export interface QualityScores {
  melody_preservation: number;
  harmony_completeness: number;
  playability: number;
}

/** 修復迴圈單步 — 給時間軸 scrubber 用 */
export interface RepairTimelineEntry {
  iteration: number;
  issue_code: string;
  issue_location: string;
  applied_strategy: string | null;
  score_before: number;
  score_after: number;
  /** 此步結束後的 target_score MusicXML 快照 */
  target_musicxml: string | null;
}

/** 位置完整的 issue (來自 target_score, 可被 apply_suggestion 鎖定) */
export interface ArrangementIssue {
  part_id: string;
  measure: number;
  voice_id: number;
  event_index: number;
  severity: IssueSeverity;
  code: string;
  params: Record<string, unknown>;
  difficulty: number;
  suggestions: { code: string; params: Record<string, unknown> }[];
}

export interface ApplySuggestionResult {
  applied: boolean;
  suggestion_code: string;
  target_musicxml: string | null;
  issues: ArrangementIssue[];
  musicxml_error?: string | null;
  can_undo: boolean;
  can_redo: boolean;
}

export interface PreviewSuggestionResult {
  previewable: boolean;
  reason?: string;
  suggestion_code?: string;
  target_musicxml?: string | null;
  issues?: ArrangementIssue[];
}

export interface ReassignResult {
  reassigned: boolean;
  source_part_id: string;
  target_player_id: string;
  target_staff: string;
  target_musicxml: string | null;
  issues: ArrangementIssue[];
  can_undo: boolean;
  can_redo: boolean;
}

export interface MeasureEvent {
  part_id: string;
  voice_id: number;
  event_index: number;
  onset: string;
  duration: string;
  kind: "note" | "chord" | "rest";
  pitch?: string;
  midi?: number;
  pitches?: string[];
  midis?: number[];
  dynamic?: string | null;
  articulations?: string[];
  /** 使用者鎖定 — 鎖定後 repair 不會動到此事件 */
  is_locked?: boolean;
}

export interface MeasureEventsResult {
  events: MeasureEvent[];
  measure: number;
}

export interface EditEventResult {
  edited: boolean;
  action: string;
  target_musicxml: string | null;
  issues: ArrangementIssue[];
  can_undo: boolean;
  can_redo: boolean;
}

export interface UndoRedoResult {
  target_musicxml: string | null;
  issues: ArrangementIssue[];
  can_undo: boolean;
  can_redo: boolean;
}

export interface HistoryStatus {
  can_undo: boolean;
  can_redo: boolean;
  history_depth: number;
  redo_depth: number;
}

export interface MidiResult {
  midi_base64: string;
  size_bytes: number;
}

export interface SaveProjectResult {
  saved_to: string;
  size_bytes: number;
}

export interface ExportFileResult {
  exported_to: string;
  size_bytes: number;
}

export interface LoadProjectResult {
  source_path: string;
  arrangement: {
    arrangement_id: string;
    name: string;
    source_id: string;
    players: PlayerInfo[];
    assignments: AssignmentInfo[];
  };
  target_musicxml: string | null;
  issues: ArrangementIssue[];
}

// ============================================================================
// IPC channel definitions
// ============================================================================

export type IpcRequest =
  | { type: "parse"; path: string }
  | { type: "validate"; path: string }
  | { type: "phrases"; path: string }
  | { type: "tag-functions"; path: string }
  | { type: "analyze"; path: string }
  | { type: "arrange"; path: string; target: string };

export interface IpcResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

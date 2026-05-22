/**
 * Renderer 端 window.scoreArranger API 型別聲明
 *
 * 對應 src/main/preload.ts 透過 contextBridge 暴露的 API。
 */

import type {
  AnalysisReport,
  ApplySuggestionResult,
  ArrangementResult,
  EditEventResult,
  ExportFileResult,
  HistoryStatus,
  IpcResponse,
  LoadProjectResult,
  MeasureEventsResult,
  MidiResult,
  PreviewSuggestionResult,
  ReassignResult,
  SaveProjectResult,
  UndoRedoResult,
} from "@shared/types";

declare global {
  interface Window {
    scoreArranger: {
      openScoreDialog: () => Promise<string | null>;
      saveProjectDialog: () => Promise<string | null>;
      openProjectDialog: () => Promise<string | null>;
      exportFileDialog: (
        kind: "musicxml" | "midi",
      ) => Promise<string | null>;
      openInExternalEditor: (
        musicxml: string,
        baseName?: string,
      ) => Promise<IpcResponse<{ path: string }>>;
      onExternalEditorChanged: (
        cb: (data: { path: string; musicxml: string }) => void,
      ) => () => void;
      llmIsAvailable: () => Promise<boolean>;
      llmInfo: () => Promise<
        | { available: false }
        | {
          available: true;
          provider: "anthropic" | "openai_compat" | "ollama";
          model: string;
          baseUrl: string;
        }
      >;
      llmSuggest: (ctx: {
        context: string;
        userQuery: string;
        ensemble?: string;
        styleAddendum?: string;
      }) => Promise<IpcResponse<{ text: string }>>;
      llmGetConfig: () => Promise<LLMConfigUI>;
      llmSetConfig: (partial: {
        provider?: "anthropic" | "openai_compat" | "ollama";
        baseUrl?: string;
        model?: string;
      }) => Promise<LLMConfigUI>;
      llmEditPlan: (ctx: {
        userRequest: string;
        parts: { part_id: string; name: string }[];
        sourceParts?: { part_id: string; name: string }[];
        history?: { request: string; summary: string }[];
        measureCount: number;
        ensemble?: string;
        styleAddendum?: string;
      }) => Promise<IpcResponse<LLMEditPlan>>;
      llmExplainIssue: (ctx: {
        issueDescription: string;
        instrument?: string;
        measure: number;
        ensemble?: string;
        suggestions: { code: string; label: string }[];
      }) => Promise<IpcResponse<LLMIssueExplanation>>;
      engine: {
        parse: (path: string) => Promise<IpcResponse<unknown>>;
        validate: (path: string) => Promise<IpcResponse<unknown>>;
        phrases: (path: string) => Promise<IpcResponse<unknown>>;
        tagFunctions: (path: string) => Promise<IpcResponse<unknown>>;
        analyze: (path: string) => Promise<IpcResponse<AnalysisReport>>;
        arrange: (
          path: string,
          target?: string,
          repair?: boolean,
          skillLevel?: "amateur" | "intermediate" | "professional",
          stylePreset?: string,
          strategyOrder?: string[],
        ) => Promise<IpcResponse<ArrangementResult>>;
        listStylePresets: () => Promise<IpcResponse<
          { id: string; display_name: string; description: string;
            llm_addendum: string }[]
        >>;
        listAvailableInstruments: () => Promise<IpcResponse<Array<{
          instrument_id: string;
          display_name: string;
          family: string;
          range_comfortable_low: number;
          range_comfortable_high: number;
          default_staves: number;
        }>>>;
        arrangeCustom: (
          path: string,
          players: Array<{
            player_id?: string;
            display_name?: string;
            instrument_id: string;
            staves?: number;
            skill_level?: "amateur" | "intermediate" | "professional";
          }>,
          repair?: boolean,
          skillLevel?: "amateur" | "intermediate" | "professional",
          stylePreset?: string,
        ) => Promise<IpcResponse<ArrangementResult>>;
        toMusicXML: (
          path: string, maxMeasures?: number,
        ) => Promise<IpcResponse<string>>;
        scoreInfo: (path: string) => Promise<IpcResponse<{
          measure_count: number;
          part_count: number;
        }>>;
        omrStatus: () => Promise<IpcResponse<{
          available: boolean;
          java_ok: boolean;
          audiveris_path: string | null;
          version: string | null;
          missing: string[];
          install_hints: Record<string, string>;
        }>>;
        pdfToMusicXML: (path: string) => Promise<IpcResponse<{
          musicxml_path: string;
          audiveris_version: string | null;
        }>>;
        amtStatus: () => Promise<IpcResponse<{
          available: boolean;
          version: string | null;
          missing: string[];
          install_hints: Record<string, string>;
        }>>;
        audioToMusicXML: (path: string) => Promise<IpcResponse<{
          musicxml_path: string;
          basic_pitch_version: string | null;
        }>>;
        setMeasureArticulation: (
          partId: string,
          measure: number,
          voiceId: number,
          articulation: string,
          mode?: "set" | "add" | "clear",
        ) => Promise<IpcResponse<{
          changed: number;
          target_musicxml: string | null;
          issues: ArrangementIssue[];
          can_undo: boolean;
          can_redo: boolean;
        }>>;
        setActiveSession: (id: string | null) => Promise<{ ok: boolean }>;
        closeSession: (id: string) =>
          Promise<IpcResponse<{ closed: boolean; session_id?: string }>>;
        applySuggestion: (
          partId: string,
          measure: number,
          voiceId: number,
          eventIndex: number,
          suggestionCode: string,
        ) => Promise<IpcResponse<ApplySuggestionResult>>;
        previewSuggestion: (
          partId: string,
          measure: number,
          voiceId: number,
          eventIndex: number,
          suggestionCode: string,
        ) => Promise<IpcResponse<PreviewSuggestionResult>>;
        reassign: (
          sourcePartId: string,
          targetPlayerId: string,
          targetStaff: string,
        ) => Promise<IpcResponse<ReassignResult>>;
        listMeasureEvents: (
          measure: number,
          partId?: string,
        ) => Promise<IpcResponse<MeasureEventsResult>>;
        editEvent: (
          partId: string,
          measure: number,
          voiceId: number,
          eventIndex: number,
          action: string,
          extra?: Record<string, unknown>,
        ) => Promise<IpcResponse<EditEventResult>>;
        applyEditOps: (
          ops: LLMEditOp[],
        ) => Promise<IpcResponse<ApplyEditOpsResult>>;
        undo: () => Promise<IpcResponse<UndoRedoResult>>;
        redo: () => Promise<IpcResponse<UndoRedoResult>>;
        historyStatus: () => Promise<IpcResponse<HistoryStatus>>;
        toMidi: () => Promise<IpcResponse<MidiResult>>;
        saveProject: (
          path: string,
          sourcePath: string,
        ) => Promise<IpcResponse<SaveProjectResult>>;
        loadProject: (
          path: string,
        ) => Promise<IpcResponse<LoadProjectResult>>;
        exportTargetMusicXML: (
          path: string,
        ) => Promise<IpcResponse<ExportFileResult>>;
        exportTargetMidi: (
          path: string,
        ) => Promise<IpcResponse<ExportFileResult>>;
        targetPartMusicXML: (
          playerId: string,
        ) => Promise<
          IpcResponse<{
            musicxml: string;
            player_id: string;
            display_name: string;
          }>
        >;
        computeDifficulty: () => Promise<
          IpcResponse<Record<string, DifficultyEntry>>
        >;
        computeQuality: () => Promise<IpcResponse<QualityReport>>;
        listNavigation: () => Promise<IpcResponse<NavigationResult>>;
        listSourceParts: (
          path: string,
        ) => Promise<IpcResponse<SourcePartInfo[]>>;
        suggestTransposition: (
          source: string,
          target: string,
        ) => Promise<IpcResponse<{ semitones: number }>>;
        transcribe: (
          path: string,
          mapping: Record<string, TranscribeMappingValue>,
        ) => Promise<IpcResponse<TranscribeResult>>;
        toSourceMidi: (
          path?: string,
        ) => Promise<IpcResponse<MidiResult>>;
      };
    };
  }

  interface LLMConfigUI {
    provider: "anthropic" | "openai_compat" | "ollama";
    baseUrl: string;
    model: string;
    available: boolean;
  }

  interface LLMEditOp {
    op: "transpose" | "articulation" | "dynamic" | "rest" | "reassign"
      | "enrich";
    part_id: string;
    measure_start: number;
    measure_end: number;
    semitones?: number;
    articulation?: string;
    mode?: "set" | "add" | "clear";
    dynamic?: string;
    source_part_id?: string;
    target_part_id?: string;
    density?: "light" | "medium" | "full";
    reason: string;
  }

  interface LLMEditPlan {
    summary: string;
    operations: LLMEditOp[];
    notes?: string;
  }

  interface LLMIssueExplanation {
    explanation: string;
    recommended: string | null;
    reasoning: string;
  }

  interface ApplyEditOpsResult {
    applied: boolean;
    results: {
      op: string;
      part_id: string;
      measure_start: number;
      measure_end: number;
      changed: number;
    }[];
    target_musicxml: string | null;
    issues: ArrangementIssue[];
    can_undo: boolean;
    can_redo: boolean;
  }

  interface SourcePartInfo {
    part_id: string;
    instrument_id: string;
    display_name: string;
  }

  interface TranscribeMappingValue {
    instrument: string;
    semitones?: number | null;
    fit_to_range?: boolean;
    preserve_octave?: boolean;
  }

  interface TranscribeResult extends ArrangementResult {
    semitones_used: Record<string, number>;
    adjustments_count: number;
    adjustments: {
      part_id: string;
      measure: number;
      voice_id: number;
      event_index: number;
      original_midi: number;
      final_midi: number;
      reason: string;
    }[];
    warnings: string[];
  }

  interface NavigationMovement {
    movement_id: number;
    title: string;
    measure_count: number;
    sections: {
      section_id: number;
      name: string;
      start: number;
      end: number;
    }[];
  }
  interface NavigationResult {
    movements: NavigationMovement[];
    rehearsal_marks: { measure: number; mark: string }[];
    total_measures: number;
  }

  interface QualityReport {
    melody_preservation: number;
    harmony_completeness: number;
    playability: number;
    overall: number;
    details: {
      melody_matched: number;
      melody_total: number;
      measures_compared: number;
      issue_count_error: number;
      issue_count_warning: number;
    };
  }

  interface DifficultyEntry {
    part_id: string;
    instrument_id: string;
    score: number;
    label: string;
    factors: {
      range: number;
      density: number;
      chord: number;
      rhythm: number;
    };
    raw_score: number;
    note_count: number;
    chord_count: number;
    measures: MeasureDifficultyEntry[];
  }

  interface MeasureDifficultyEntry {
    measure: number;
    score: number;
    range: number;
    density: number;
    chord: number;
    rhythm: number;
    note_count: number;
  }
}

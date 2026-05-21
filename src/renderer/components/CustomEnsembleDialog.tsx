/**
 * CustomEnsembleDialog — 自訂編制 builder
 *
 * 取代「8 個固定 templates」限制. 使用者從樂器庫挑 1-8 個 player, 每個指定:
 * - instrument
 * - display name
 * - 譜表數 (1 = 單譜, 2 = 大譜表 — 鍵盤類預設 2)
 *
 * 完成後 onApply 把 player list 帶出去, 由 Toolbar 呼叫 arrangeCustom.
 */

import { useEffect, useState } from "react";

import { t, useLocale } from "../utils/i18n";

export interface CustomPlayer {
  player_id: string;
  display_name: string;
  instrument_id: string;
  staves: number;
}

interface AvailableInstrument {
  instrument_id: string;
  display_name: string;
  family: string;
  range_comfortable_low: number;
  range_comfortable_high: number;
  default_staves: number;
}

interface Props {
  onApply: (players: CustomPlayer[]) => void;
  onCancel: () => void;
  initial?: CustomPlayer[];
}

/** 樂器家族 → i18n key。 */
const FAMILY_LABEL_KEYS: Record<string, string> = {
  strings: "ensemble.family.strings",
  woodwind: "ensemble.family.woodwind",
  brass: "ensemble.family.brass",
  keyboard: "ensemble.family.keyboard",
  voice: "ensemble.family.voice",
  percussion: "ensemble.family.percussion",
};

export function CustomEnsembleDialog(
  { onApply, onCancel, initial }: Props,
) {
  useLocale();
  const [instruments, setInstruments] = useState<AvailableInstrument[]>([]);
  const [players, setPlayers] = useState<CustomPlayer[]>(
    initial ?? [
      {
        player_id: "violin_1",
        display_name: "Violin",
        instrument_id: "violin",
        staves: 1,
      },
    ],
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const api = window.scoreArranger?.engine?.listAvailableInstruments;
    if (typeof api !== "function") {
      setLoading(false);
      return;
    }
    api()
      .then((res) => {
        if (alive && res.ok && res.data) {
          setInstruments(res.data);
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  const familyGroups: Record<string, AvailableInstrument[]> = {};
  for (const i of instruments) {
    (familyGroups[i.family] ??= []).push(i);
  }

  const addPlayer = () => {
    if (players.length >= 8) return;
    const newIdx = players.length + 1;
    setPlayers([
      ...players,
      {
        player_id: `violin_${newIdx}`,
        display_name: "Violin",
        instrument_id: "violin",
        staves: 1,
      },
    ]);
  };

  const removePlayer = (idx: number) => {
    if (players.length <= 1) return;
    setPlayers(players.filter((_, i) => i !== idx));
  };

  const updatePlayer = (idx: number, patch: Partial<CustomPlayer>) => {
    setPlayers(
      players.map((p, i) => {
        if (i !== idx) return p;
        const merged = { ...p, ...patch };
        // 切樂器時自動帶入 default staves + display_name
        if (patch.instrument_id && patch.instrument_id !== p.instrument_id) {
          const inst = instruments.find(
            (x) => x.instrument_id === patch.instrument_id,
          );
          if (inst) {
            merged.staves = inst.default_staves;
            merged.display_name = inst.display_name;
            // 避免 player_id 衝突
            const baseId = patch.instrument_id;
            const existing = players.filter(
              (x, xi) => xi !== idx && x.player_id.startsWith(baseId),
            ).length;
            merged.player_id = `${baseId}_${existing + 1}`;
          }
        }
        return merged;
      }),
    );
  };

  const handleApply = () => {
    if (players.length === 0) return;
    onApply(players);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.5)",
        zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg-panel)",
          color: "var(--fg-primary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: 24,
          maxWidth: 720,
          width: "92%",
          maxHeight: "85vh",
          overflow: "auto",
          boxShadow: "0 12px 48px rgba(0,0,0,0.3)",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>{t("ensemble.heading")}</h2>
        <p
          style={{ marginTop: 8, color: "var(--fg-muted)", fontSize: 12 }}
        >
          {t("ensemble.intro")}
        </p>

        {loading
          ? <div style={{ padding: 24 }}>{t("ensemble.loading")}</div>
          : (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {players.map((p, idx) => (
                <PlayerRow
                  key={idx}
                  player={p}
                  index={idx}
                  familyGroups={familyGroups}
                  onUpdate={(patch) => updatePlayer(idx, patch)}
                  onRemove={() => removePlayer(idx)}
                  canRemove={players.length > 1}
                />
              ))}
              <button
                onClick={addPlayer}
                disabled={players.length >= 8}
                style={{
                  padding: "8px 12px",
                  border: "1px dashed var(--border)",
                  borderRadius: 4,
                  background: "transparent",
                  color: "var(--fg-secondary)",
                  cursor: players.length >= 8 ? "not-allowed" : "pointer",
                  fontSize: 13,
                  marginTop: 4,
                }}
              >
                {t("ensemble.addPlayer")}
                {players.length >= 8 ? t("ensemble.addPlayer.atLimit") : ""}
              </button>
            </div>
          )}

        <div
          style={{
            marginTop: 20,
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onCancel}
            style={btnSecondary}
          >
            {t("ensemble.cancel")}
          </button>
          <button
            onClick={handleApply}
            disabled={players.length === 0}
            style={btnPrimary}
          >
            {t("ensemble.apply", { count: players.length })}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PlayerRowProps {
  player: CustomPlayer;
  index: number;
  familyGroups: Record<string, AvailableInstrument[]>;
  onUpdate: (patch: Partial<CustomPlayer>) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function PlayerRow(
  { player, index, familyGroups, onUpdate, onRemove, canRemove }: PlayerRowProps,
) {
  useLocale();
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "40px 1fr 1fr 80px 40px",
        gap: 8,
        alignItems: "center",
        padding: "8px 12px",
        background: "var(--bg-secondary)",
        borderRadius: 6,
        fontSize: 13,
      }}
    >
      <div style={{ color: "var(--fg-muted)", fontWeight: 600 }}>
        {index + 1}.
      </div>
      <select
        value={player.instrument_id}
        onChange={(e) => onUpdate({ instrument_id: e.target.value })}
        style={selectStyle}
      >
        {Object.entries(familyGroups).map(([family, list]) => (
          <optgroup
            key={family}
            label={FAMILY_LABEL_KEYS[family] ? t(FAMILY_LABEL_KEYS[family]) : family}
          >
            {list.map((i) => (
              <option key={i.instrument_id} value={i.instrument_id}>
                {i.display_name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <input
        type="text"
        value={player.display_name}
        onChange={(e) => onUpdate({ display_name: e.target.value })}
        placeholder={t("ensemble.row.displayNamePlaceholder")}
        style={selectStyle}
      />
      <select
        value={player.staves}
        onChange={(e) =>
          onUpdate({ staves: parseInt(e.target.value, 10) })}
        title={t("ensemble.row.staves.title")}
        style={selectStyle}
      >
        <option value={1}>{t("ensemble.row.staves.one")}</option>
        <option value={2}>{t("ensemble.row.staves.two")}</option>
      </select>
      <button
        onClick={onRemove}
        disabled={!canRemove}
        title={t("ensemble.row.remove.title")}
        style={{
          padding: "4px 8px",
          border: "1px solid var(--border)",
          background: "transparent",
          color: canRemove ? "var(--error, #ef4444)" : "var(--fg-muted)",
          borderRadius: 4,
          cursor: canRemove ? "pointer" : "not-allowed",
          fontSize: 14,
        }}
      >
        ×
      </button>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  padding: "4px 8px",
  border: "1px solid var(--button-border)",
  borderRadius: 4,
  background: "var(--button-bg)",
  color: "var(--button-fg)",
  fontSize: 13,
  width: "100%",
};

const btnSecondary: React.CSSProperties = {
  padding: "6px 14px",
  border: "1px solid var(--button-border)",
  background: "var(--button-bg)",
  color: "var(--button-fg)",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 13,
};

const btnPrimary: React.CSSProperties = {
  padding: "6px 14px",
  border: "1px solid var(--accent)",
  background: "var(--accent)",
  color: "var(--accent-fg)",
  borderRadius: 4,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
};

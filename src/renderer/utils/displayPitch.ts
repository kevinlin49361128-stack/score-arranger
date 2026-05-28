/**
 * displayPitch — MusicXML 譜面在「記譜音 (written)」與「實音 (sounding)」
 * 之間切換的後處理.
 *
 * 0.1.55: 移調樂器 (Clarinet B♭ / Trumpet B♭ / Horn F / Saxophone) 的譜面
 * 預設輸出 written pitch + <transpose> 元素 (給玩家拿到的譜). 老師 / 作曲家
 * 想看 concert score (實音對齊) 時, 用 toSoundingPitchXML() 把每個 <part>
 * 內所有 <pitch> 加上 chromatic 半音、剝掉 <transpose>.
 *
 * 注意:
 * - 只處理 partwise 結構 (本專案唯一輸出格式).
 * - 簡化: 用 <chromatic> 半音差直接調 octave/step/alter, 不去重新
 *   spell (e.g. C♯→D♭). OSMD 顯示音名仍正確, 雖然個別音的拼寫可能不
 *   是音樂家會手寫的版本.
 * - 不處理跨 <transpose> 變更 (一個 part 內換樂器 — 極罕見).
 * - 已知限制: 調號 (<key><fifths>) 不轉. Clarinet B♭ 譜上若是 D major
 *   (2 升), 切到 sounding 後仍顯示 D major 調號但音實際在 C major.
 *   結果是大量 accidental 出現. 真正的 concert score 應該也轉調號,
 *   留作後續改進; 目前優先功能性正確 (音高正確).
 */

/** MIDI pitch class → (step, alter). 黑鍵預設用升記號. */
const PC_TO_STEP: Array<[string, number]> = [
  ["C", 0], ["C", 1], ["D", 0], ["D", 1], ["E", 0], ["F", 0],
  ["F", 1], ["G", 0], ["G", 1], ["A", 0], ["A", 1], ["B", 0],
];

const STEP_TO_PC: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

interface PitchParts {
  step: string;
  alter: number;
  octave: number;
}

function pitchToMidi(p: PitchParts): number {
  const pc = STEP_TO_PC[p.step];
  if (pc === undefined) return 60; // fallback
  // MIDI 60 = C4; (octave + 1) * 12 + pc + alter
  return (p.octave + 1) * 12 + pc + p.alter;
}

function midiToPitch(midi: number): PitchParts {
  const safeMidi = Math.max(0, Math.min(127, midi));
  const [step, alter] = PC_TO_STEP[((safeMidi % 12) + 12) % 12];
  const octave = Math.floor(safeMidi / 12) - 1;
  return { step, alter, octave };
}

function readPitchEl(pitchEl: Element): PitchParts {
  const step = pitchEl.querySelector("step")?.textContent?.trim() || "C";
  const alterRaw = pitchEl.querySelector("alter")?.textContent?.trim() || "0";
  const octaveRaw = pitchEl.querySelector("octave")?.textContent?.trim() || "4";
  return {
    step,
    alter: parseInt(alterRaw, 10) || 0,
    octave: parseInt(octaveRaw, 10) || 4,
  };
}

function writePitchEl(pitchEl: Element, parts: PitchParts) {
  // 直接 mutate; 順序: step, alter (可選), octave
  const doc = pitchEl.ownerDocument;
  while (pitchEl.firstChild) pitchEl.removeChild(pitchEl.firstChild);
  const stepEl = doc.createElement("step");
  stepEl.textContent = parts.step;
  pitchEl.appendChild(stepEl);
  if (parts.alter !== 0) {
    const alterEl = doc.createElement("alter");
    alterEl.textContent = String(parts.alter);
    pitchEl.appendChild(alterEl);
  }
  const octEl = doc.createElement("octave");
  octEl.textContent = String(parts.octave);
  pitchEl.appendChild(octEl);
}

/**
 * 把 MusicXML 從「玩家用譜 (written pitch + <transpose>)」轉成
 * 「總譜模式 (concert / sounding pitch, 無 <transpose>)」.
 *
 * 對非移調 part (沒 <transpose>) 為 no-op. 失敗時回傳原字串.
 */
export function toSoundingPitchXML(xml: string | null): string | null {
  if (!xml) return xml;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "application/xml");
    const root = doc.documentElement;
    if (!root || root.querySelector("parsererror")) return xml;

    const parts = root.querySelectorAll("part");
    parts.forEach((partEl) => {
      // 找該 part 內第一個 <transpose> (= part 開頭的移調設定).
      // 同 part 多次 transpose 變更未處理 (極少見).
      const transposeEl = partEl.querySelector("transpose");
      if (!transposeEl) return;
      const chromaticRaw = transposeEl.querySelector("chromatic")
        ?.textContent?.trim();
      const chromatic = chromaticRaw ? parseInt(chromaticRaw, 10) : 0;
      if (!chromatic) {
        // 沒 chromatic 或為 0 — 仍移除 <transpose> 元素保持一致
        transposeEl.parentNode?.removeChild(transposeEl);
        return;
      }
      // 對該 part 內所有 <pitch> 加 chromatic 半音
      // (written + chromatic = sounding)
      const pitches = partEl.querySelectorAll("pitch");
      pitches.forEach((p) => {
        const parts = readPitchEl(p);
        const midi = pitchToMidi(parts) + chromatic;
        writePitchEl(p, midiToPitch(midi));
        // 同步移掉同 <note> 內的 <accidental> 顯示記號 — 我們改了 alter
        // 但 OSMD 會根據新的 <pitch> + 調號自動補. 留舊的 <accidental>
        // 會出現「顯示音名與 <pitch> 不符」的視覺 bug.
        const note = p.parentElement;
        const accidental = note?.querySelector("accidental");
        if (accidental) accidental.parentNode?.removeChild(accidental);
      });
      // 移除 <transpose> 元素
      transposeEl.parentNode?.removeChild(transposeEl);
    });

    return new XMLSerializer().serializeToString(doc);
  } catch {
    return xml;
  }
}

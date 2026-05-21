/**
 * useMidiInput — 接 MIDI keyboard / pad 即時輸入
 *
 * 適合搭配 MeasureEditor 用: 選定一個事件後, 按外接 MIDI 鍵 → 該事件音高
 * 直接改成那個鍵的 pitch。
 *
 * 使用 Web MIDI API (Electron renderer 內可用; Chrome 也支援)。
 */

import { useEffect, useRef, useState } from "react";

import { t } from "../utils/i18n";

export interface MidiInputState {
  /** 已偵測到的 MIDI 裝置名稱 */
  devices: string[];
  /** 是否獲得 MIDI 權限 */
  enabled: boolean;
  /** 錯誤訊息 (e.g. 沒有 MIDI 支援) */
  error: string | null;
}

/**
 * 訂閱 MIDI note-on. 回傳 cleanup。
 *
 * onNoteOn(midi, velocity): midi 0-127, velocity 0-1
 */
export function useMidiInput(
  onNoteOn: (midi: number, velocity: number) => void,
): MidiInputState {
  const [devices, setDevices] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 用 ref 避免 effect 重複初始化造成重複訂閱
  const handlerRef = useRef(onNoteOn);
  useEffect(() => {
    handlerRef.current = onNoteOn;
  }, [onNoteOn]);

  useEffect(() => {
    const nav = navigator as Navigator & {
      requestMIDIAccess?: () => Promise<MIDIAccess>;
    };
    if (!nav.requestMIDIAccess) {
      setError(t("midi.error.unsupported"));
      return;
    }
    let access: MIDIAccess | null = null;
    const cleanups: Array<() => void> = [];

    nav.requestMIDIAccess()
      .then((midi) => {
        access = midi;
        setEnabled(true);

        const updateDevices = () => {
          const names: string[] = [];
          midi.inputs.forEach((input) => {
            if (input.name) names.push(input.name);
          });
          setDevices(names);
        };
        updateDevices();
        midi.onstatechange = updateDevices;

        const onMidiMessage = (msg: MIDIMessageEvent) => {
          const data = msg.data;
          if (!data || data.length < 3) return;
          const status = data[0];
          const note = data[1];
          const vel = data[2];
          // 0x90 = note on (channel 0); 高 nibble == 0x9
          if ((status & 0xf0) === 0x90 && vel > 0) {
            handlerRef.current(note, vel / 127);
          }
        };
        midi.inputs.forEach((input) => {
          input.onmidimessage = onMidiMessage;
          cleanups.push(() => {
            input.onmidimessage = null;
          });
        });
      })
      .catch((e) => {
        setError(t("midi.error.accessFailed", {
          message: e instanceof Error ? e.message : String(e),
        }));
      });

    return () => {
      cleanups.forEach((fn) => {
        fn();
      });
      if (access) access.onstatechange = null;
    };
  }, []);

  return { devices, enabled, error };
}

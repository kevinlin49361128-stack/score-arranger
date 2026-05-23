/**
 * Coachmark — 引導模式的「首次使用功能氣泡」.
 *
 * 設計約束:
 *   - 只在 guidanceMode = true 且 id 沒被 seen 過時顯示
 *   - 顯示時, anchor 元素加 pulse 動畫
 *   - 氣泡內含「知道了」按鈕 → markCoachmarkSeen(id) → 永不再顯示
 *   - 使用者點氣泡外側不算 dismiss (避免誤觸), 必須按按鈕
 *
 * 用法 (在父元件):
 *   <button ref={btnRef}>改譜</button>
 *   <Coachmark
 *     id="nl-edit-intro"
 *     anchorRef={btnRef}
 *     title="自然語言改譜"
 *     body="用文字描述你要的修改 — 例如「小提琴第 5-8 小節降一個八度」. 需要 AI 模型."
 *   />
 */

import { useEffect, useState, type RefObject } from "react";

import { useSessionStore } from "../stores/sessionStore";
import { t as tr } from "../utils/i18n";

interface Props {
  /** Coachmark 唯一 id — 用來記「已看過」, 之後不再顯示. */
  id: string;
  /** Anchor 元素 — 氣泡會貼在它附近, 並加 pulse 動畫. */
  anchorRef: RefObject<HTMLElement | null>;
  /** 氣泡標題 (一行). */
  title: string;
  /** 氣泡內文 (1-3 句, 解釋功能 + 是否需要 AI). */
  body: string;
  /** 可選: 顯示位置 — 預設 "bottom" (氣泡在 anchor 下方). */
  placement?: "bottom" | "top" | "right" | "left";
  /** 可選: 延遲毫秒 (等 anchor 渲染穩定再顯示). 預設 400ms. */
  delayMs?: number;
}

export function Coachmark({
  id, anchorRef, title, body,
  placement = "bottom", delayMs = 400,
}: Props) {
  const guidanceMode = useSessionStore((s) => s.guidanceMode);
  const seen = useSessionStore((s) => !!s.seenCoachmarks[id]);
  const markSeen = useSessionStore((s) => s.markCoachmarkSeen);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [visible, setVisible] = useState(false);

  // 是否該顯示這個 coachmark
  const shouldShow = guidanceMode && !seen;

  // 計算氣泡位置 — 依 anchor getBoundingClientRect + placement.
  // 用 useEffect 在 anchor 渲染穩定後計算; 沒 anchor 直接不顯示.
  useEffect(() => {
    if (!shouldShow) {
      setVisible(false);
      return;
    }
    const compute = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      let top = r.bottom + 8;
      let left = r.left;
      if (placement === "top") {
        top = r.top - 8 - 80; // 估氣泡高 ~80
      } else if (placement === "right") {
        top = r.top;
        left = r.right + 8;
      } else if (placement === "left") {
        top = r.top;
        left = r.left - 8 - 260; // 估氣泡寬 ~260
      }
      setPos({ top, left });
    };
    const timer = setTimeout(() => {
      compute();
      setVisible(true);
    }, delayMs);
    window.addEventListener("resize", compute);
    window.addEventListener("scroll", compute, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", compute);
      window.removeEventListener("scroll", compute, true);
    };
  }, [shouldShow, anchorRef, placement, delayMs]);

  // Pulse anchor 元素 — 加一個 class 讓人注意到. Cleanup 時移除.
  useEffect(() => {
    if (!visible || !shouldShow) return;
    const el = anchorRef.current;
    if (!el) return;
    el.classList.add("coachmark-pulse");
    return () => {
      el.classList.remove("coachmark-pulse");
    };
  }, [visible, shouldShow, anchorRef]);

  if (!shouldShow || !visible || !pos) return null;

  return (
    <div
      className="coachmark-popover"
      role="dialog"
      aria-label={title}
      style={{
        position: "fixed",
        top: pos.top, left: pos.left,
        zIndex: 300,
        maxWidth: 280,
        padding: "12px 14px",
        background: "var(--accent)",
        color: "var(--accent-fg)",
        borderRadius: 8,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        fontSize: 13,
        lineHeight: 1.5,
        animation: "fx-modal-in 0.22s ease-out",
      }}
    >
      <div style={{
        fontSize: 12, fontWeight: 700, letterSpacing: ".04em",
        marginBottom: 6, opacity: 0.85,
      }}>
        💡 {title}
      </div>
      <div style={{ marginBottom: 10 }}>{body}</div>
      <button
        type="button"
        onClick={() => markSeen(id)}
        style={{
          padding: "4px 12px",
          fontSize: 12, fontWeight: 600,
          border: "1px solid currentColor",
          background: "transparent",
          color: "inherit",
          borderRadius: 4,
          cursor: "pointer",
        }}
      >
        {tr("coachmark.gotIt")}
      </button>
    </div>
  );
}

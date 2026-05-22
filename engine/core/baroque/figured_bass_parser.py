"""MusicXML <figured-bass> 解析 (continuo realization 用).

巴洛克通奏低音譜的 figure 標示直接從 source MusicXML 抓 —— music21 在
import 時會丟掉大部分 figure-bass 細節, 改用 stdlib XML parser 自己讀,
拿到的資料夠 continuo.py 拿來決定 chord inversion / 7th 等。

只處理最常見的:
- "6" → 第一轉位 (6-3): 從 bass 用第 3 + 第 6 音
- "6/4" / "64" → 第二轉位 (6-4): 從 bass 用第 4 + 第 6 音
- "7" → 七和弦: 在預設 5-3 上加七度音
- 空 figure / "5" / "5/3" → 預設 5-3 三和弦 (current diatonic 行為)
- "#" / "b" 屬於變化音, 太細, MVP 階段先忽略

回傳:
    dict[(measure_number: int, beat_offset: Fraction)] = "figure_string"
"""

from __future__ import annotations

from fractions import Fraction
from pathlib import Path
from typing import Optional
import xml.etree.ElementTree as ET
import zipfile


def parse_figured_bass(
    source_path: str,
) -> dict[tuple[int, Fraction], str]:
    """讀 MusicXML 抽 <figured-bass> 元素 → {(measure, beat_offset): "figure"}.

    無法解析 / 沒有 figured-bass → 回空 dict (上游靜默 fallback 到 5-3 預設).

    路徑支援:
    - 一般 .xml / .musicxml / .mxl
    - "corpus:<id>" → 透過 samples.resolve 找到隨附檔
    """
    try:
        xml_bytes = _read_xml_bytes(source_path)
    except Exception:
        return {}
    if not xml_bytes:
        return {}
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError:
        return {}

    out: dict[tuple[int, Fraction], str] = {}
    # MusicXML 標準: <part> 內含 <measure number="N">, 每個 measure 有
    # <attributes><divisions>, 之後 events 用 <note>/<figured-bass>.
    # <figured-bass> 通常出現在 bass <note> 的旁邊 (前一個元素), 其 <duration>
    # 標示這個 figure 跨越的長度。我們只關心位置 → figure.
    for part in root.iter("part"):
        divisions = 1  # quarter note 預設, 隨 <attributes><divisions> 更新
        for measure in part.iter("measure"):
            mnum_attr = measure.attrib.get("number", "0")
            try:
                mnum = int(mnum_attr)
            except ValueError:
                continue
            beat = Fraction(0)
            for child in measure:
                if child.tag == "attributes":
                    div = child.find("divisions")
                    if div is not None and div.text:
                        try:
                            divisions = max(1, int(div.text))
                        except ValueError:
                            pass
                elif child.tag == "figured-bass":
                    fig_str = _figure_string(child)
                    if fig_str:
                        out[(mnum, beat)] = fig_str
                elif child.tag == "note":
                    # 跳過 chord 後續 note (它們共用同一 beat, 不推進)
                    if child.find("chord") is not None:
                        continue
                    dur = child.find("duration")
                    if dur is not None and dur.text:
                        try:
                            beat += Fraction(int(dur.text), divisions)
                        except (ValueError, ZeroDivisionError):
                            pass
                elif child.tag == "backup":
                    # voice 切換: 把 beat 倒回去, MVP 階段不細管 voice
                    dur = child.find("duration")
                    if dur is not None and dur.text:
                        try:
                            beat -= Fraction(int(dur.text), divisions)
                        except (ValueError, ZeroDivisionError):
                            pass
                elif child.tag == "forward":
                    dur = child.find("duration")
                    if dur is not None and dur.text:
                        try:
                            beat += Fraction(int(dur.text), divisions)
                        except (ValueError, ZeroDivisionError):
                            pass
    return out


def interpret_figure(figure: str) -> Optional[tuple[int, ...]]:
    """把 figure 字串轉成相對於 bass 的半音偏移 (回傳 tuple).

    回 None 表示「不認識的 figure → 維持預設 5-3」。
    """
    # 移除空白、變化音符號 (MVP 忽略 # / b)
    f = figure.replace(" ", "").replace("#", "").replace("b", "")
    f = f.replace("♯", "").replace("♭", "").replace("♮", "")
    # 常見正規化
    if f in ("", "5", "5/3", "53"):
        return None  # 預設 5-3 → 維持 diatonic 行為
    if f == "6" or f == "6/3" or f == "63":
        # 第一轉位: bass 上方 3rd + 6th. 用 diatonic 度數推 (5-3 邏輯類似)
        return (3, 6)  # scale-step offsets
    if f == "6/4" or f == "64":
        return (4, 6)
    if f == "7" or f == "7/5/3" or f == "753":
        return (3, 5, 7)
    if f in ("4/2", "42", "2"):
        return (2, 4, 6)  # 第三轉位 七和弦
    if f in ("6/5", "65"):
        return (3, 5, 6)
    if f in ("4/3", "43"):
        return (3, 4, 6)
    return None  # 不認識 → 預設


def _figure_string(elem: ET.Element) -> str:
    """把 <figured-bass> 內的多個 <figure><figure-number> 串成字串.

    例: <figure-number>6</figure-number><figure-number>4</figure-number>
    → "6/4"
    """
    numbers: list[str] = []
    for fig in elem.findall("figure"):
        num = fig.find("figure-number")
        if num is not None and num.text:
            numbers.append(num.text.strip())
    return "/".join(numbers)


def _read_xml_bytes(source_path: str) -> Optional[bytes]:
    """把 path 讀成 XML bytes; 處理 corpus / .mxl (zip) / 一般 XML 三種."""
    if source_path.startswith("corpus:"):
        try:
            from core.samples import resolve as resolve_sample
            sample_path = resolve_sample(source_path[len("corpus:"):])
            if sample_path is None:
                return None
            source_path = str(sample_path)
        except Exception:
            return None
    p = Path(source_path)
    if not p.exists():
        return None
    if p.suffix.lower() == ".mxl":
        # MXL = MusicXML zip. 內含 META-INF/container.xml 指向真正的 .xml
        with zipfile.ZipFile(p) as zf:
            # 取第一個非 META-INF 的 XML
            xml_name = next(
                (n for n in zf.namelist()
                 if not n.startswith("META-INF/") and n.endswith(".xml")),
                None,
            )
            if xml_name is None:
                return None
            return zf.read(xml_name)
    return p.read_bytes()

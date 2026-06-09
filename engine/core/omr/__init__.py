"""OMR (Optical Music Recognition) — PDF/影像 → MusicXML 子模組

可選引擎 (使用者按需安裝, child process invoke, 授權不污染主程式):
  - Audiveris (GPLv3, Java): PDF → MusicXML, 傳統 OMR。
  - homr (ONNXRuntime): 影像 → MusicXML, end-to-end transformer; 對拍照/掃描更穩。
兩者並列, 由前端引擎選擇器擇一。
"""

from .audiveris import (
    AudiverisError,
    AudiverisStatus,
    detect_audiveris,
    pdf_to_musicxml,
)
from .homr_engine import (
    HomrError,
    HomrStatus,
    detect_homr,
    image_to_musicxml,
)

__all__ = [
    "AudiverisError",
    "AudiverisStatus",
    "detect_audiveris",
    "pdf_to_musicxml",
    "HomrError",
    "HomrStatus",
    "detect_homr",
    "image_to_musicxml",
]

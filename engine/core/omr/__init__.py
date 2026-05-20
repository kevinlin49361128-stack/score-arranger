"""OMR (Optical Music Recognition) — PDF → MusicXML 子模組

目前僅支援 Audiveris (GPLv3, Java) 作為可選外掛.
透過 child process invoke, GPLv3 不污染主程式授權.
"""

from .audiveris import (
    AudiverisError,
    AudiverisStatus,
    detect_audiveris,
    pdf_to_musicxml,
)

__all__ = [
    "AudiverisError",
    "AudiverisStatus",
    "detect_audiveris",
    "pdf_to_musicxml",
]

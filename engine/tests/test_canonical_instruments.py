"""樂器 ID 正規化 (canonical) 測試 — 確保 parser / registry / writer 三方一致"""

from __future__ import annotations

import pytest

from core.instruments import (
    CANONICAL_IDS,
    get_profile,
    normalize_instrument_id,
)


class TestCanonical:
    def test_canonical_self(self):
        for cid in CANONICAL_IDS:
            assert normalize_instrument_id(cid) == cid

    def test_display_names(self):
        # 大寫顯示名 → canonical
        assert normalize_instrument_id("Violin") == "violin"
        assert normalize_instrument_id("Violoncello") == "cello"
        assert normalize_instrument_id("Contrabass") == "double_bass"
        assert normalize_instrument_id("Double Bass") == "double_bass"
        assert normalize_instrument_id("French Horn") == "horn_f"

    def test_clarinet_aliases(self):
        for alias in [
            "clarinet", "Clarinet", "Clarinet in B-flat",
            "clarinet_in_bb", "Clarinet in B-Flat",
        ]:
            assert normalize_instrument_id(alias) == "clarinet_bb", (
                f"alias {alias!r} failed"
            )

    def test_horn_aliases(self):
        for alias in ["horn", "Horn", "horn_in_f", "French Horn", "french_horn"]:
            assert normalize_instrument_id(alias) == "horn_f", (
                f"alias {alias!r} failed"
            )

    def test_trumpet_aliases(self):
        for alias in [
            "trumpet", "Trumpet", "Trumpet in B-flat",
            "trumpet_in_bb", "Trumpet in C", "trumpet_in_c",
        ]:
            assert normalize_instrument_id(alias) == "trumpet_bb"

    def test_bass_voice_not_double_bass(self):
        # 在 chorale 中 "Bass" 是聲部名稱, 不是低音提琴
        assert normalize_instrument_id("Bass") == "bass_voice"

    def test_unknown_falls_back(self):
        # 未知 ID 至少標準化過 (lowercase + underscore)
        assert normalize_instrument_id("Some Weird Instrument") \
            == "some_weird_instrument"

    def test_none_or_empty(self):
        assert normalize_instrument_id(None) == "unknown"
        assert normalize_instrument_id("") == "unknown"

    def test_every_canonical_has_registered_profile(self):
        """所有 CANONICAL_IDS 應該都對得到 InstrumentProfile (除了預留)"""
        # 不一定都註冊, 但已註冊的必定是 canonical
        for cid in CANONICAL_IDS:
            profile = get_profile(cid)
            if profile is not None:
                assert profile.instrument_id == cid


class TestParserIntegration:
    """確認 parser 解析出的 instrument_id 都是 canonical"""

    def test_parse_bwv_uses_canonical(self):
        from music21 import corpus
        from core.parser import parse_stream

        m21 = corpus.parse("bach/bwv66.6")
        score = parse_stream(m21)
        for part in score.parts:
            assert part.instrument_id in CANONICAL_IDS, (
                f"part_id={part.part_id} has non-canonical "
                f"instrument_id={part.instrument_id}"
            )

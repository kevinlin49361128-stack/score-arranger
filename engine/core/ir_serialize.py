"""
IR 序列化 — JSON 編解碼。

對應規格 §7。編碼規則:
- Fraction → "n/d" 字串 (整數時為 "n")
- Pitch → {"midi": int, "spelling": str, ...}
- Enum → 字串值
- tuple → JSON array
- dataclass → JSON object
"""

from __future__ import annotations

import json
from dataclasses import fields, is_dataclass
from enum import Enum
from fractions import Fraction
from typing import Any, get_args, get_origin, get_type_hints

from . import ir
from .ir import Pitch, Score


# ============================================================================
# Encoding (dataclass → dict)
# ============================================================================

def to_dict(obj: Any) -> Any:
    """遞迴將 IR 物件轉為 JSON-friendly dict。"""
    if obj is None:
        return None
    if isinstance(obj, Fraction):
        return _fraction_to_str(obj)
    if isinstance(obj, Enum):
        return obj.value
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, tuple):
        return [to_dict(x) for x in obj]
    if isinstance(obj, list):
        return [to_dict(x) for x in obj]
    if isinstance(obj, dict):
        return {str(k): to_dict(v) for k, v in obj.items()}
    if is_dataclass(obj):
        result: dict[str, Any] = {"__type__": type(obj).__name__}
        for f in fields(obj):
            value = getattr(obj, f.name)
            result[f.name] = to_dict(value)
        return result
    raise TypeError(f"無法序列化型別 {type(obj).__name__}")


def to_json(score: Score, indent: int | None = None) -> str:
    """Score → JSON 字串"""
    return json.dumps(to_dict(score), ensure_ascii=False, indent=indent)


def _fraction_to_str(f: Fraction) -> str:
    if f.denominator == 1:
        return str(f.numerator)
    return f"{f.numerator}/{f.denominator}"


# ============================================================================
# Decoding (dict → dataclass)
# ============================================================================

# 所有可被反序列化的 dataclass 名稱 → 類別
_TYPE_REGISTRY: dict[str, type] = {}


def _register_types() -> None:
    """從 ir 模組收集所有 dataclass。"""
    for name in dir(ir):
        cls = getattr(ir, name)
        if is_dataclass(cls):
            _TYPE_REGISTRY[name] = cls


_register_types()


def from_dict(data: Any, expected_type: Any = None) -> Any:
    """遞迴將 dict 還原為 IR 物件。

    expected_type 提供型別提示以還原 Fraction / Enum / tuple 等
    無法從 JSON 直接判斷的型別。
    """
    if data is None:
        return None

    # dataclass dict (含 __type__ 標籤)
    if isinstance(data, dict) and "__type__" in data:
        type_name = data["__type__"]
        cls = _TYPE_REGISTRY.get(type_name)
        if cls is None:
            raise ValueError(f"未知 IR 型別: {type_name}")
        hints = get_type_hints(cls)
        kwargs: dict[str, Any] = {}
        for f in fields(cls):
            if f.name not in data:
                continue
            field_type = hints.get(f.name)
            kwargs[f.name] = from_dict(data[f.name], field_type)
        return cls(**kwargs)

    # 用 expected_type 推斷
    if expected_type is not None:
        return _coerce_value(data, expected_type)

    # Fallback: 原樣
    if isinstance(data, list):
        return [from_dict(x) for x in data]
    if isinstance(data, dict):
        return {k: from_dict(v) for k, v in data.items()}
    return data


def _coerce_value(value: Any, expected_type: Any) -> Any:
    origin = get_origin(expected_type)
    args = get_args(expected_type)

    # Fraction
    if expected_type is Fraction:
        return _str_to_fraction(value)

    # Enum
    if isinstance(expected_type, type) and issubclass(expected_type, Enum):
        return expected_type(value)

    # Optional[X] = Union[X, None]
    if origin is type(None) or (origin is None and expected_type is type(None)):
        return None
    # typing.Union (含 Optional)
    if origin is not None and _is_union(origin):
        if value is None:
            return None
        # 嘗試每個非 None 型別
        for arg in args:
            if arg is type(None):
                continue
            try:
                return _coerce_value(value, arg)
            except (ValueError, TypeError):
                continue
        return value

    # list[X]
    if origin is list:
        item_type = args[0] if args else None
        return [from_dict(x, item_type) for x in value]

    # tuple[X, Y, ...]
    if origin is tuple:
        if len(args) == 2 and args[1] is ...:
            # tuple[X, ...]
            return tuple(from_dict(x, args[0]) for x in value)
        return tuple(from_dict(v, t) for v, t in zip(value, args))

    # dict[K, V]
    if origin is dict:
        v_type = args[1] if len(args) >= 2 else None
        return {_coerce_key(k, args[0] if args else None): from_dict(v, v_type) for k, v in value.items()}

    # dataclass
    if isinstance(expected_type, type) and is_dataclass(expected_type):
        if isinstance(value, dict):
            return from_dict({"__type__": expected_type.__name__, **value})
        return value

    return value


def _coerce_key(key: str, key_type: Any) -> Any:
    if key_type is int:
        return int(key)
    return key


def _is_union(origin: Any) -> bool:
    """判斷 origin 是否為 Union (Python 3.10+ 用 types.UnionType)"""
    import typing
    import types as _types
    return origin is typing.Union or (hasattr(_types, "UnionType") and origin is _types.UnionType)


def _str_to_fraction(s: Any) -> Fraction:
    if isinstance(s, Fraction):
        return s
    if isinstance(s, int):
        return Fraction(s)
    if isinstance(s, str):
        if "/" in s:
            num, denom = s.split("/")
            return Fraction(int(num), int(denom))
        return Fraction(int(s))
    raise TypeError(f"無法將 {type(s).__name__} 轉為 Fraction")


def from_json(s: str) -> Score:
    """JSON 字串 → Score"""
    return from_dict(json.loads(s))

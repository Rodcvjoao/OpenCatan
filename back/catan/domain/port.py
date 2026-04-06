from __future__ import annotations

from dataclasses import dataclass

from .enums import PortType


@dataclass
class Port:
    id: int
    port_type: PortType
    vertex_ids: tuple[int, int]
    trade_ratio: int

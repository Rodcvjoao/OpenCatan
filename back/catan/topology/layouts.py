from __future__ import annotations

import random

from catan.domain.enums import PortType, ResourceType

BASE_RESOURCE_DISTRIBUTION: list[ResourceType] = [
    ResourceType.BRICK,
    ResourceType.BRICK,
    ResourceType.BRICK,
    ResourceType.LUMBER,
    ResourceType.LUMBER,
    ResourceType.LUMBER,
    ResourceType.LUMBER,
    ResourceType.WOOL,
    ResourceType.WOOL,
    ResourceType.WOOL,
    ResourceType.WOOL,
    ResourceType.GRAIN,
    ResourceType.GRAIN,
    ResourceType.GRAIN,
    ResourceType.GRAIN,
    ResourceType.ORE,
    ResourceType.ORE,
    ResourceType.ORE,
    ResourceType.DESERT,
]

BASE_NUMBER_TOKENS: list[int] = [
    2,
    3,
    3,
    4,
    4,
    5,
    5,
    6,
    6,
    8,
    8,
    9,
    9,
    10,
    10,
    11,
    11,
    12,
]

BASE_PORT_DISTRIBUTION: list[PortType] = [
    PortType.THREE_TO_ONE,
    PortType.THREE_TO_ONE,
    PortType.THREE_TO_ONE,
    PortType.THREE_TO_ONE,
    PortType.BRICK,
    PortType.LUMBER,
    PortType.WOOL,
    PortType.GRAIN,
    PortType.ORE,
]


def shuffled_resource_layout(rng: random.Random | None = None) -> list[ResourceType]:
    layout = list(BASE_RESOURCE_DISTRIBUTION)
    (rng or random).shuffle(layout)
    return layout


def shuffled_token_layout(rng: random.Random | None = None) -> list[int]:
    layout = list(BASE_NUMBER_TOKENS)
    (rng or random).shuffle(layout)
    return layout


def shuffled_port_layout(rng: random.Random | None = None) -> list[PortType]:
    layout = list(BASE_PORT_DISTRIBUTION)
    (rng or random).shuffle(layout)
    return layout


def port_ratio(port_type: PortType) -> int:
    return 3 if port_type == PortType.THREE_TO_ONE else 2

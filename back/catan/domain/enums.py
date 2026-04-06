from __future__ import annotations

from enum import Enum, auto


class ResourceType(Enum):
    BRICK = auto()
    LUMBER = auto()
    WOOL = auto()
    GRAIN = auto()
    ORE = auto()
    DESERT = auto()


class PortType(Enum):
    THREE_TO_ONE = auto()
    BRICK = auto()
    LUMBER = auto()
    WOOL = auto()
    GRAIN = auto()
    ORE = auto()


class DevelopmentCardType(Enum):
    KNIGHT = auto()
    VICTORY_POINT = auto()
    ROAD_BUILDING = auto()
    YEAR_OF_PLENTY = auto()
    MONOPOLY = auto()


class GamePhase(Enum):
    SETUP_1 = auto()
    SETUP_2 = auto()
    MAIN = auto()
    FINISHED = auto()


class TurnPhase(Enum):
    ROLL = auto()
    TRADE = auto()
    BUILD = auto()
    END = auto()

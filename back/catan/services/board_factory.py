from __future__ import annotations

import random

from catan.domain.board import Board
from catan.domain.enums import PortType, ResourceType
from catan.topology.layouts import (
    shuffled_port_layout,
    shuffled_resource_layout,
    shuffled_token_layout,
)


class BoardFactory:
    @staticmethod
    def create_standard_board(
        resource_layout: list[ResourceType] | None = None,
        token_layout: list[int] | None = None,
        port_layout: list[PortType] | None = None,
        rng: random.Random | None = None,
    ) -> Board:
        board = Board()
        board.build_standard_topology()
        board.assign_tiles(
            resource_layout=resource_layout or shuffled_resource_layout(rng),
            token_layout=token_layout or shuffled_token_layout(rng),
        )
        board.assign_ports(port_layout=port_layout or shuffled_port_layout(rng))
        return board

from __future__ import annotations

from typing import Any

from catan.api.schemas import StateEnvelope
from catan.domain.game import CatanGame


def game_public_state(game: CatanGame) -> dict[str, Any]:
    board = game.board
    return {
        "phase": game.phase.name,
        "turn": {
            "number": game.turn_manager.turn_number,
            "current_player_id": game.current_player().id,
            "turn_phase": game.turn_manager.turn_phase.name,
            "last_roll": game.last_roll,
        },
        "board": {
            "robber_tile_id": board.robber.tile_id if board.robber else None,
            "tiles": [
                {
                    "id": tile.id,
                    "resource": tile.resource_type.name,
                    "number_token": tile.number_token,
                    "vertex_ids": list(tile.vertex_ids),
                    "edge_ids": list(tile.edge_ids),
                    "has_robber": tile.has_robber,
                }
                for tile in sorted(board.tiles.values(), key=lambda t: t.id)
            ],
            "vertices": [
                {
                    "id": vertex.id,
                    "adjacent_vertex_ids": sorted(vertex.adjacent_vertex_ids),
                    "incident_edge_ids": sorted(vertex.incident_edge_ids),
                    "adjacent_tile_ids": sorted(vertex.adjacent_tile_ids),
                    "port_id": vertex.port_id,
                    "building": (
                        None
                        if vertex.building is None
                        else {
                            "owner_id": vertex.building.owner_id,
                            "type": vertex.building.__class__.__name__.lower(),
                        }
                    ),
                }
                for vertex in sorted(board.vertices.values(), key=lambda v: v.id)
            ],
            "edges": [
                {
                    "id": edge.id,
                    "v1": edge.v1,
                    "v2": edge.v2,
                    "adjacent_tile_ids": sorted(edge.adjacent_tile_ids),
                    "road": (
                        None
                        if edge.road is None
                        else {
                            "owner_id": edge.road.owner_id,
                        }
                    ),
                }
                for edge in sorted(board.edges.values(), key=lambda e: e.id)
            ],
            "ports": [
                {
                    "id": port.id,
                    "port_type": port.port_type.name,
                    "trade_ratio": port.trade_ratio,
                    "vertex_ids": list(port.vertex_ids),
                }
                for port in sorted(board.ports.values(), key=lambda p: p.id)
            ],
        },
        "players": [
            {
                "id": player.id,
                "name": player.name,
                "color": player.color,
                "resource_count": player.resource_count(),
                "dev_card_count": len(player.dev_cards_hand),
                "roads": sorted(player.road_ids),
                "settlements": sorted(player.settlement_vertex_ids),
                "cities": sorted(player.city_vertex_ids),
                "victory_points": player.victory_points(),
                "played_knights": player.played_knights,
                "has_longest_road": player.has_longest_road,
                "has_largest_army": player.has_largest_army,
            }
            for player in game.players
        ],
        "bank": {
            "resource_cards": {
                resource.name: count
                for resource, count in game.bank.resource_cards.items()
            },
            "dev_cards_remaining": game.dev_deck.remaining(),
        },
    }


def game_private_state(game: CatanGame, player_id: int) -> dict[str, Any]:
    player = game.player_by_id(player_id)
    return {
        "player_id": player_id,
        "resources": {
            resource.name: count for resource, count in player.resources.items()
        },
        "dev_cards": [card.name for card in player.dev_cards_hand],
    }


def build_state_envelope(
    *,
    game_id: str,
    version: int,
    game: CatanGame,
    player_id: int | None = None,
) -> StateEnvelope:
    return StateEnvelope(
        game_id=game_id,
        version=version,
        public_state=game_public_state(game),
        private_state=None
        if player_id is None
        else game_private_state(game, player_id),
    )

from __future__ import annotations

from dataclasses import dataclass

from .enums import GamePhase, TurnPhase


@dataclass
class TurnManager:
    turn_phase: TurnPhase = TurnPhase.ROLL
    turn_number: int = 1

    def next_player(self, current_index: int, player_count: int) -> int:
        return (current_index + 1) % player_count

    def advance_phase(self) -> None:
        phase_order = [TurnPhase.ROLL, TurnPhase.TRADE, TurnPhase.BUILD, TurnPhase.END]
        current = phase_order.index(self.turn_phase)
        self.turn_phase = phase_order[(current + 1) % len(phase_order)]
        if self.turn_phase == TurnPhase.ROLL:
            self.turn_number += 1

    def reset_turn(self) -> None:
        self.turn_phase = TurnPhase.ROLL

    def is_setup_phase(self, game_phase: GamePhase) -> bool:
        return game_phase in {GamePhase.SETUP_1, GamePhase.SETUP_2}

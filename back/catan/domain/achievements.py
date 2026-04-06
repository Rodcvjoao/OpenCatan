from __future__ import annotations

from dataclasses import dataclass


@dataclass
class AchievementManager:
    largest_army_owner_id: int | None = None
    longest_road_owner_id: int | None = None

    def update_largest_army(self, players: list[object]) -> None:
        eligible = [p for p in players if getattr(p, "played_knights", 0) >= 3]
        if not eligible:
            self.largest_army_owner_id = None
            return
        winner = max(eligible, key=lambda p: getattr(p, "played_knights", 0))
        self.largest_army_owner_id = winner.id
        for player in players:
            player.has_largest_army = player.id == winner.id

    def update_longest_road(
        self, lengths: dict[int, int], players: list[object]
    ) -> None:
        eligible = [(pid, length) for pid, length in lengths.items() if length >= 5]
        if not eligible:
            self.longest_road_owner_id = None
            for player in players:
                player.has_longest_road = False
            return
        winner_id, _ = max(eligible, key=lambda item: item[1])
        self.longest_road_owner_id = winner_id
        for player in players:
            player.has_longest_road = player.id == winner_id

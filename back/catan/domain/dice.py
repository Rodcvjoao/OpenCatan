from __future__ import annotations

import random
from dataclasses import dataclass


@dataclass
class Dice:
    rng: random.Random | None = None

    def roll(self) -> int:
        rand = self.rng or random
        return rand.randint(1, 6) + rand.randint(1, 6)

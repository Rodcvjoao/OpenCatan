// Deterministic RNG reused across flora/fauna modules so geometry placement
// is stable across re-renders of the same tile. Per-tile seeding and inset
// hex tests are inlined in each cluster builder (forest/mountain/pasture)
// to preserve byte-identical placement from the pre-split implementation.

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function random(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

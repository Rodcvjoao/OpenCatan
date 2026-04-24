// Pure geometry: map tile/vertex/edge graph objects to world positions.

import { HEX_GAP, HEX_SIZE, TILE_AXIAL } from "../../config";
import type {
  Edge,
  EdgePosition,
  Point2D,
  Tile,
} from "../../types";

export function getHexPixelPos(q: number, r: number): Point2D {
  const x = HEX_SIZE * HEX_GAP * Math.sqrt(3) * (q + r / 2);
  const z = ((HEX_SIZE * HEX_GAP * 3) / 2) * r;
  return { x, z };
}

export function computeTilePositions(tiles: Tile[]): Record<number, Point2D> {
  const positions: Record<number, Point2D> = {};
  for (const tile of tiles) {
    const axial = TILE_AXIAL[tile.id];
    if (axial) positions[tile.id] = getHexPixelPos(axial.q, axial.r);
  }
  return positions;
}

export function computeVertexPositions(
  tiles: Tile[],
  tilePositions: Record<number, Point2D>,
): Record<number, Point2D> {
  const samples: Record<number, Point2D[]> = {};
  for (const tile of tiles) {
    const center = tilePositions[tile.id];
    if (!center) continue;
    for (let i = 0; i < 6; i++) {
      const vid = tile.vertex_ids[i];
      const angle = -Math.PI / 6 + (i * Math.PI) / 3;
      const vx = center.x + HEX_SIZE * Math.cos(angle);
      const vz = center.z + HEX_SIZE * Math.sin(angle);
      if (!samples[vid]) samples[vid] = [];
      samples[vid].push({ x: vx, z: vz });
    }
  }
  const positions: Record<number, Point2D> = {};
  for (const [vid, pts] of Object.entries(samples)) {
    const avgX = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const avgZ = pts.reduce((s, p) => s + p.z, 0) / pts.length;
    positions[Number(vid)] = { x: avgX, z: avgZ };
  }
  return positions;
}

export function computeEdgePositions(
  edges: Edge[],
  vertexPositions: Record<number, Point2D>,
): Record<number, EdgePosition> {
  const positions: Record<number, EdgePosition> = {};
  for (const edge of edges) {
    const v1 = vertexPositions[edge.v1];
    const v2 = vertexPositions[edge.v2];
    if (!v1 || !v2) continue;
    positions[edge.id] = {
      x: (v1.x + v2.x) / 2,
      z: (v1.z + v2.z) / 2,
      angle: Math.atan2(v2.z - v1.z, v2.x - v1.x),
    };
  }
  return positions;
}

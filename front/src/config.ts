// Config and static topology. Ported verbatim from the pre-split board.html
// so the rendered board stays pixel-identical.

import type { AxialCoord, PlayerColor, Resource } from "./types";

// The backend listens on port 8000 on the same host that serves the
// frontend. Deriving the hostname from `window.location` at runtime means
// the app works unchanged whether you open it as `http://localhost:5173/`,
// `http://192.168.1.5:5173/`, or `https://catan.example.com/`.
const isHttps =
  typeof window !== "undefined" && window.location.protocol === "https:";
const apiHost =
  (typeof window !== "undefined" && window.location.hostname) || "localhost";
const apiPort = 8000;

export const API_BASE = `${isHttps ? "https" : "http"}://${apiHost}:${apiPort}`;
export const WS_BASE = `${isHttps ? "wss" : "ws"}://${apiHost}:${apiPort}`;

// Tile id -> axial coordinate. Hardcoded base-Catan topology; must match
// back/catan/topology/standard_board.py per Decision 3 in AGENTS.md.
export const TILE_AXIAL: Record<number, AxialCoord> = {
  0:  { q:  0, r: -2 }, 1:  { q:  1, r: -2 }, 2:  { q:  2, r: -2 },
  3:  { q: -1, r: -1 }, 4:  { q:  0, r: -1 }, 5:  { q:  1, r: -1 }, 6:  { q:  2, r: -1 },
  7:  { q: -2, r:  0 }, 8:  { q: -1, r:  0 }, 9:  { q:  0, r:  0 }, 10: { q:  1, r:  0 }, 11: { q:  2, r:  0 },
  12: { q: -2, r:  1 }, 13: { q: -1, r:  1 }, 14: { q:  0, r:  1 }, 15: { q:  1, r:  1 },
  16: { q: -2, r:  2 }, 17: { q: -1, r:  2 }, 18: { q:  0, r:  2 },
};

// Backend resource enum -> internal texture/material key.
export const RESOURCE_MAP: Record<Resource, string> = {
  BRICK:  "brick",
  LUMBER: "wood",
  WOOL:   "sheep",
  GRAIN:  "wheat",
  ORE:    "ore",
  DESERT: "desert",
};

export const RESOURCE_LABELS: Record<string, string> = {
  BRICK:  "Brick",
  LUMBER: "Wood",
  WOOL:   "Sheep",
  GRAIN:  "Wheat",
  ORE:    "Ore",
};

export const RESOURCE_COLORS: Record<string, string> = {
  BRICK:  "#bd5a36",
  LUMBER: "#3b5e2b",
  WOOL:   "#8ebd3f",
  GRAIN:  "#f0c24f",
  ORE:    "#82858c",
};

export const RESOURCE_ORDER = ["LUMBER", "BRICK", "WOOL", "GRAIN", "ORE"] as const;

export const PLAYER_COLORS: Record<PlayerColor, string> = {
  red:    "#c83134",
  blue:   "#1a6b9c",
  white:  "#e0e0e0",
  orange: "#d67a1c",
  green:  "#2e7d32",
  purple: "#8a217c",
};

export const PLAYER_COLORS_DARK: Record<PlayerColor, string> = {
  red:    "#811818",
  blue:   "#0c3652",
  white:  "#999999",
  orange: "#7a430d",
  green:  "#1b5e20",
  purple: "#5a1551",
};

export const PLAYER_COLORS_MID: Record<PlayerColor, string> = {
  red:    "#a72323",
  blue:   "#124d73",
  white:  "#bbbbbb",
  orange: "#a85e13",
  green:  "#266b24",
  purple: "#6e1a63",
};

// Keep geometry constants here too: every layer references them and they map
// 1:1 to the backend topology (see AGENTS.md "Frontend Geometry Rules").
export const HEX_SIZE = 7;
export const HEX_HEIGHT = 1.8;
export const HEX_GAP = 1.0;

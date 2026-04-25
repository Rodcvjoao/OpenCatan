// Central mutable game state. Exported as a singleton to match the original
// semantics of the pre-split board.html. `updateState` is wired at runtime
// by main.ts to avoid a circular import between state, 3D rebuild, UI and
// modal code.

import type {
  EdgePosition,
  InteractionMode,
  PlayerPublic,
  Point2D,
  PrivateState,
  PublicState,
  StateEnvelope,
} from "./types";

export interface GameStateShape {
  gameId: string | null;
  playerToken: string | null;
  myPlayerId: number | null;
  version: number;
  publicState: PublicState | null;
  privateState: PrivateState | null;
  vertexPositions: Record<number, Point2D>;
  edgePositions: Record<number, EdgePosition>;
  tilePositions: Record<number, Point2D>;
  tileNumbers: Record<number, number>;
  playerMap: Record<number, PlayerPublic>;
  interactionMode: InteractionMode;
  pendingRobberTileId: number | null;
  requestSeq: number;
}

export const GameState: GameStateShape = {
  gameId: null,
  playerToken: null,
  myPlayerId: null,
  version: 0,
  publicState: null,
  privateState: null,
  vertexPositions: {},
  edgePositions: {},
  tilePositions: {},
  tileNumbers: {},
  playerMap: {},
  interactionMode: "none",
  pendingRobberTileId: null,
  requestSeq: 0,
};

export function playersList(): PlayerPublic[] {
  return GameState.publicState?.players ?? [];
}

// Runtime-wired callbacks. main.ts registers these after all modules load
// so the state layer doesn't statically depend on 3D/UI/modal modules.
type VoidFn = () => void;
let rebuildSceneFn: VoidFn = () => {};
let updateUIFn: VoidFn = () => {};
let checkPendingModalsFn: VoidFn = () => {};

export function registerStateCallbacks(callbacks: {
  rebuildScene: VoidFn;
  updateUI: VoidFn;
  checkPendingModals: VoidFn;
}): void {
  rebuildSceneFn = callbacks.rebuildScene;
  updateUIFn = callbacks.updateUI;
  checkPendingModalsFn = callbacks.checkPendingModals;
}

export function updateState(envelope: StateEnvelope | null | undefined): void {
  if (!envelope) return;
  GameState.publicState = envelope.public_state;
  GameState.privateState = envelope.private_state ?? null;
  GameState.version = envelope.version;
  if (GameState.privateState) {
    GameState.myPlayerId = GameState.privateState.player_id;
  }
  GameState.playerMap = {};
  if (GameState.publicState?.players) {
    for (const p of GameState.publicState.players) {
      GameState.playerMap[p.id] = p;
    }
  }
  GameState.interactionMode = "none";
  rebuildSceneFn();
  updateUIFn();
  checkPendingModalsFn();
}

// Helpers
import type { LegalAction } from "./types";

export function isSetupPhase(): boolean {
  const phase = GameState.publicState?.phase;
  return phase === "SETUP_1" || phase === "SETUP_2";
}

export function isMyTurn(): boolean {
  return (
    GameState.publicState?.turn?.current_player_id === GameState.myPlayerId
  );
}

export function getLegalActions(): LegalAction[] {
  return GameState.privateState?.legal_actions ?? [];
}

export function hasLegalAction(action: LegalAction): boolean {
  return getLegalActions().includes(action);
}

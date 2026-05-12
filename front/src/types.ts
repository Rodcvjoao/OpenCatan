// Types mirror the backend contract in back/FRONTEND_CONTRACT.md and
// back/catan/api/schemas.py / serialize.py. Fields we do not consume are
// typed loosely (unknown / Record) rather than enumerated.

export type PlayerColor =
  | "red"
  | "blue"
  | "white"
  | "orange"
  | "green"
  | "purple";

export type Resource = "BRICK" | "LUMBER" | "WOOL" | "GRAIN" | "ORE" | "DESERT";

export type Phase = "SETUP_1" | "SETUP_2" | "MAIN" | "FINISHED";

export type TurnPhase = "ROLL" | "TRADE" | "BUILD" | "END";

export type PortType =
  | "THREE_TO_ONE"
  | "BRICK"
  | "LUMBER"
  | "WOOL"
  | "GRAIN"
  | "ORE";

export type BuildingType = "settlement" | "city";

export interface Building {
  type: BuildingType;
  owner_id: number;
}

export interface Road {
  owner_id: number;
}

export interface Tile {
  id: number;
  resource: Resource;
  number_token: number | null;
  vertex_ids: number[];
  edge_ids: number[];
  has_robber: boolean;
}

export interface Vertex {
  id: number;
  adjacent_vertex_ids: number[];
  port_id: number | null;
  building: Building | null;
}

export interface Edge {
  id: number;
  v1: number;
  v2: number;
  adjacent_tile_ids: number[];
  road: Road | null;
}

export interface Port {
  id: number;
  port_type: PortType;
  trade_ratio: number;
  vertex_ids: [number, number];
}

export interface Board {
  robber_tile_id: number | null;
  tiles: Tile[];
  vertices: Vertex[];
  edges: Edge[];
  ports: Port[];
}

export interface PlayerPublic {
  id: number;
  name: string;
  color: PlayerColor;
  is_active: boolean;
  is_host: boolean;
  resource_count: number;
  dev_card_count: number;
  roads: number;
  settlements: number;
  cities: number;
  victory_points: number;
  played_knights: number;
  has_longest_road: boolean;
  has_largest_army: boolean;
}

export interface Turn {
  number: number;
  current_player_id: number | null;
  turn_phase: TurnPhase | string;
  last_roll: number | null;
  last_roll_dice?: [number, number] | number[] | null;
}

export interface TradeOffer {
  id: string;
  from_player_id: number;
  to_player_id: number;
  give: Record<string, number>;
  receive: Record<string, number>;
}

export interface PendingSetup {
  round?: number;
  order?: number[];
  index?: number;
  pending_setup_road_player_id?: number | null;
}

export interface Pending {
  pending_discards?: Record<string, number> | null;
  robber_move_required?: boolean;
  pending_trade_offer?: TradeOffer | null;
  setup?: PendingSetup | null;
}

export interface BankState {
  resource_cards: Record<string, number>;
  dev_cards_remaining: number;
}

export interface PublicState {
  phase: Phase;
  turn: Turn | null;
  board: Board;
  players: PlayerPublic[];
  bank?: BankState;
  pending?: Pending | null;
}

export type LegalAction =
  | "place_setup_settlement"
  | "place_setup_road"
  | "discard_resources"
  | "roll_dice"
  | "move_robber"
  | "build_road"
  | "build_settlement"
  | "build_city"
  | "buy_development_card"
  | "play_development_card"
  | "trade_bank"
  | "propose_trade_offer"
  | "respond_trade_offer"
  | "cancel_trade_offer"
  | "end_turn";

export interface PrivateState {
  player_id: number;
  resources: Record<string, number>;
  dev_cards: Record<string, number> | string[];
  new_dev_cards_this_turn?: Record<string, number> | string[];
  victory_points?: number;
  legal_actions: LegalAction[];
}

export interface StateEnvelope {
  game_id: string;
  version: number;
  public_state: PublicState;
  private_state: PrivateState | null;
}

// ---- Command request / response ----

export type CommandName =
  | "place_setup_settlement"
  | "place_setup_road"
  | "discard_resources"
  | "roll_dice"
  | "move_robber"
  | "build_road"
  | "build_settlement"
  | "build_city"
  | "buy_development_card"
  | "play_development_card"
  | "trade_bank"
  | "propose_trade_offer"
  | "respond_trade_offer"
  | "cancel_trade_offer"
  | "end_turn"
  | "leave_game"
  | "rejoin_game";

export interface CommandEvent {
  type: string;
  [key: string]: unknown;
}

export interface CommandResponse {
  accepted: boolean;
  version: number;
  reason: string | null;
  idempotent_replay: boolean;
  events: CommandEvent[];
  state: StateEnvelope | null;
}

// ---- Create-game response ----

export interface CreatedPlayer {
  player_id: number;
  name: string;
  color: PlayerColor;
  token: string;
}

export interface CreateGameResponse {
  game_id: string;
  version: number;
  players: CreatedPlayer[];
  state: StateEnvelope;
}

// ---- Interaction modes for the 3D board ----

export type InteractionMode =
  | "none"
  | "place_settlement"
  | "place_setup_settlement"
  | "place_road"
  | "place_setup_road"
  | "place_city"
  | "move_robber"
  | "play_knight"
  | "play_road_building";

// ---- Positions computed from the board graph ----

export interface Point2D {
  x: number;
  z: number;
}

export interface EdgePosition extends Point2D {
  angle: number;
}

export interface AxialCoord {
  q: number;
  r: number;
}

// ---- Input-related userData on meshes ----

export interface BoardMeshUserData {
  type: "tile" | "vertex" | "edge";
  id: number;
}

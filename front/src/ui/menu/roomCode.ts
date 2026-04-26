// Client-side room-code generator for the multiplayer Create Room flow.
// These codes are cosmetic only — they do not correspond to any backend
// `game_id`. They exist so the UI feels like a browser lobby game.

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I for legibility
const CODE_LEN = 6;

export function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LEN; i++) {
    code += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
  }
  return code;
}

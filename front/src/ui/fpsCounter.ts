// Minimal FPS overlay. Updates once per second from the animate loop.
// Toggle with the `F` key; default visible so you can measure right away.

const ELEMENT_ID = "fps-counter";
const UPDATE_INTERVAL_MS = 500;

interface FpsState {
  frames: number;
  lastUpdate: number;
  enabled: boolean;
}

const state: FpsState = {
  frames: 0,
  lastUpdate: 0,
  enabled: true,
};

function getElement(): HTMLElement | null {
  return document.getElementById(ELEMENT_ID);
}

/** Called once per frame from animate.ts. */
export function fpsFrame(nowMs: number): void {
  if (!state.enabled) return;
  state.frames += 1;
  if (state.lastUpdate === 0) {
    state.lastUpdate = nowMs;
    return;
  }
  const elapsed = nowMs - state.lastUpdate;
  if (elapsed >= UPDATE_INTERVAL_MS) {
    const fps = (state.frames * 1000) / elapsed;
    const el = getElement();
    if (el) {
      el.textContent = `${fps.toFixed(0)} FPS`;
    }
    state.frames = 0;
    state.lastUpdate = nowMs;
  }
}

function applyVisibility(): void {
  const el = getElement();
  if (!el) return;
  if (state.enabled) {
    el.classList.remove("hidden");
  } else {
    el.classList.add("hidden");
    state.frames = 0;
    state.lastUpdate = 0;
  }
}

export function toggleFps(): void {
  state.enabled = !state.enabled;
  applyVisibility();
}

export function setFpsEnabled(enabled: boolean): void {
  state.enabled = enabled;
  applyVisibility();
}

export function isFpsEnabled(): boolean {
  return state.enabled;
}

/** Bind the `F` keyboard shortcut + apply initial visibility. */
export function bindFpsCounter(): void {
  window.addEventListener("keydown", (event) => {
    if (event.key !== "f" && event.key !== "F") return;
    // Don't steal the keystroke while typing in an input/select.
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (target?.isContentEditable) return;
    toggleFps();
  });
  applyVisibility();
}

// Settings screen. Expanded with real 3D toggles that are applied live to
// the renderer and the animate loop. Persisted to localStorage so the
// user's preferences survive reloads.

import { setAnimateFlora, setAnimateOcean } from "../../three/animate";
import { applyShadowQuality } from "../../three/scene";
import { $ } from "../dom";
import { setFpsEnabled } from "../fpsCounter";
import { showScreen } from "./nav";
import type { ShadowQuality, GraphicsPreset } from "./settings.types";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  resetSettings,
  saveSettings,
  type MenuSettings,
} from "./storage";

let settings: MenuSettings = loadSettings();

/** Apply every setting to the running 3D scene. Called once at boot and
 *  again whenever the Settings panel changes a value. */
function applyAll(s: MenuSettings): void {
  applyShadowQuality(s.shadowQuality);
  setAnimateOcean(s.oceanAnimation);
  setAnimateFlora(s.floraAnimation);
  setFpsEnabled(s.showFps);
}

/** Presets compose the individual toggles so a user can one-click drop
 *  into a faster rendering profile. */
function applyPreset(preset: GraphicsPreset): MenuSettings {
  if (preset === "low") {
    return {
      ...settings,
      graphicsPreset: "low",
      shadowQuality: "off",
      oceanAnimation: false,
      floraAnimation: false,
    };
  }
  if (preset === "medium") {
    return {
      ...settings,
      graphicsPreset: "medium",
      shadowQuality: "low",
      oceanAnimation: true,
      floraAnimation: false,
    };
  }
  return {
    ...settings,
    graphicsPreset: "high",
    shadowQuality: "high",
    oceanAnimation: true,
    floraAnimation: true,
  };
}

function render(): void {
  $<HTMLSelectElement>("st-shadow").value = settings.shadowQuality;
  $<HTMLInputElement>("st-ocean").checked = settings.oceanAnimation;
  $<HTMLInputElement>("st-flora").checked = settings.floraAnimation;
  $<HTMLInputElement>("st-fps").checked = settings.showFps;
  $<HTMLSelectElement>("st-preset").value = settings.graphicsPreset;
}

function update(patch: Partial<MenuSettings>): void {
  settings = { ...settings, ...patch };
  saveSettings(settings);
  applyAll(settings);
  render();
}

export function bindSettings(): void {
  $<HTMLSelectElement>("st-shadow").addEventListener("change", (e) => {
    update({ shadowQuality: (e.target as HTMLSelectElement).value as ShadowQuality });
  });
  $<HTMLInputElement>("st-ocean").addEventListener("change", (e) => {
    update({ oceanAnimation: (e.target as HTMLInputElement).checked });
  });
  $<HTMLInputElement>("st-flora").addEventListener("change", (e) => {
    update({ floraAnimation: (e.target as HTMLInputElement).checked });
  });
  $<HTMLInputElement>("st-fps").addEventListener("change", (e) => {
    update({ showFps: (e.target as HTMLInputElement).checked });
  });
  $<HTMLSelectElement>("st-preset").addEventListener("change", (e) => {
    const preset = (e.target as HTMLSelectElement).value as GraphicsPreset;
    settings = applyPreset(preset);
    saveSettings(settings);
    applyAll(settings);
    render();
  });
  $("btn-st-reset").addEventListener("click", () => {
    settings = resetSettings();
    applyAll(settings);
    render();
  });
  $("btn-st-back").addEventListener("click", () => showScreen("main"));

  render();
}

/** Called from main.ts on boot to push the saved settings into the 3D
 *  scene before the first frame is rendered. */
export function bootstrapSettings(): void {
  settings = loadSettings();
  applyAll(settings);
}

export { DEFAULT_SETTINGS };

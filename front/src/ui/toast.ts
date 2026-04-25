// Transient bottom-right-ish notifications.

export type ToastType = "info" | "error" | "warning" | "success";

const COLORS: Record<ToastType, string> = {
  info:    "bg-blue-800 border-blue-600",
  error:   "bg-red-900 border-red-600",
  warning: "bg-yellow-800 border-yellow-600",
  success: "bg-green-800 border-green-600",
};

export function showToast(message: string, type: ToastType = "info"): void {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const el = document.createElement("div");
  el.className =
    `${COLORS[type]} border text-white text-sm px-4 py-2 rounded-lg ` +
    `shadow-lg pointer-events-auto opacity-0 transition-opacity duration-300`;
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => {
    el.style.opacity = "1";
  });
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

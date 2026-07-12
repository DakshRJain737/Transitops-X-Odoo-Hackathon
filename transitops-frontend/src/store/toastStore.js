import { create } from "zustand";

/**
 * Toast store — deliberately NOT persisted (toasts are ephemeral, shouldn't
 * survive a refresh). Holds an array so multiple toasts can stack.
 *
 * The `toast` export below is a plain object of functions (not a hook) so it
 * can be called from anywhere — form submit handlers, the axios interceptor
 * in services/api.js, even outside any component — without violating React's
 * rules of hooks. Components that need to RENDER the list use the
 * `useToastStore` hook directly (see Toast.jsx's ToastContainer).
 */
let idCounter = 0;

export const useToastStore = create((set) => ({
  toasts: [],

  add: (toastData) =>
    set((state) => ({
      toasts: [...state.toasts, { id: ++idCounter, ...toastData }],
    })),

  remove: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}));

function push(variant, message, options = {}) {
  const { title, duration = 4500 } = options;
  useToastStore.getState().add({ variant, message, title, duration });
}

/**
 * toast — the public API used throughout the app.
 * Usage:
 *   toast.success("Vehicle created successfully")
 *   toast.error("Cargo weight exceeds vehicle capacity")
 *   toast.info("Trip dispatched", { title: "TR-2291" })
 */
export const toast = {
  success: (message, options) => push("success", message, options),
  error: (message, options) => push("error", message, options),
  warning: (message, options) => push("warning", message, options),
  info: (message, options) => push("info", message, options),
};

export default toast;
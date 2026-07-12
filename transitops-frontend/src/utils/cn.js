import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn — merges conditional class logic (clsx) with Tailwind conflict resolution (twMerge).
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
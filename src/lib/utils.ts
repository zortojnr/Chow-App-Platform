// cn() — conditional Tailwind class merge utility.
// Combines clsx (conditional logic) with tailwind-merge (conflict resolution).
// frontend-standards.md §6.2 — use cn() whenever a component has more than
// 5 Tailwind classes or needs runtime conditional classes.

import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

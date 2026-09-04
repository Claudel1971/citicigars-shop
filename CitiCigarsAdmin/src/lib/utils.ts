import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFCFA(amount: number) {
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0
  }).format(amount) + ' FCFA';
}

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Normalize avatar URL to use API route for standalone builds
export function normalizeAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null
  // Convert /uploads/avatars/ to /api/uploads/avatars/ for standalone mode
  if (url.startsWith('/uploads/avatars/')) {
    return url.replace('/uploads/avatars/', '/api/uploads/avatars/')
  }
  return url
}

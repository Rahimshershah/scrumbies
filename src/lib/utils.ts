import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { join } from "path"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Get the uploads directory path that works in both dev and standalone mode
// This function should only be used in server-side code (API routes)
export function getUploadsDir(): string {
  // Use environment variable if set (for production)
  if (process.env.UPLOADS_DIR) {
    return process.env.UPLOADS_DIR
  }
  
  const cwd = process.cwd()
  
  // In standalone mode, process.cwd() is typically .next/standalone
  // Check if we're in standalone mode by looking for server.js
  // Use dynamic require to avoid build-time issues
  let isStandalone = false
  try {
    // Only check in Node.js environment (server-side)
    if (typeof window === 'undefined') {
      const fs = require('fs')
      isStandalone = fs.existsSync(join(cwd, 'server.js'))
    }
  } catch (e) {
    // If we can't check, assume dev mode
    isStandalone = false
  }
  
  if (isStandalone) {
    // In standalone mode, store uploads in a persistent location
    // Try to go up to the project root (where public folder might be)
    // Or use a fixed path like /var/www/scrumbies/uploads
    // For now, use a relative path that should work
    return join(cwd, '..', 'uploads')
  }
  
  // In dev mode, use public/uploads
  return join(cwd, 'public', 'uploads')
}

// Normalize avatar URL to use API route for standalone builds
export function normalizeAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null

  // If it's a data URL (base64 encoded image), return as is
  // This is commonly used for project logos
  if (url.startsWith('data:')) {
    return url
  }

  // If already using API route, return as is
  if (url.startsWith('/api/uploads/avatars/')) {
    return url
  }

  // Convert /uploads/avatars/ to /api/uploads/avatars/
  if (url.startsWith('/uploads/avatars/')) {
    return url.replace('/uploads/avatars/', '/api/uploads/avatars/')
  }

  // If it's a full URL (http/https), return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }

  // If it's already an API route but different format, ensure it's correct
  if (url.startsWith('/api/')) {
    return url
  }

  // Default: assume it needs API route prefix
  return url.startsWith('/') ? `/api${url}` : `/api/uploads/avatars/${url}`
}

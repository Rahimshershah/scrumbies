// Client-side image compression. Runs in the browser (uses canvas/FileReader).
// Downscales + re-encodes an image so it stays under a byte ceiling before upload,
// which keeps payloads small (the server has been sensitive to large requests) and
// enforces the "no images over 1 MB" rule without rejecting the user's screenshot.

const MAX_BYTES = 1024 * 1024 // 1 MB
const MAX_DIMENSION = 1600 // px — cap the longest edge

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality))
}

export interface CompressResult {
  file: File
  /** true if the file still exceeds maxBytes after compression (caller should reject) */
  tooLarge: boolean
}

/**
 * Compress an image File. Returns a (usually smaller) JPEG File. Animated GIFs are
 * left untouched (canvas would drop the animation) — only their size is checked.
 */
export async function compressImage(file: File, maxBytes: number = MAX_BYTES): Promise<CompressResult> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return { file, tooLarge: file.size > maxBytes }
  }

  try {
    const dataUrl = await readAsDataURL(file)
    const img = await loadImage(dataUrl)

    let width = img.naturalWidth || img.width
    let height = img.naturalHeight || img.height
    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height))
    width = Math.max(1, Math.round(width * scale))
    height = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return { file, tooLarge: file.size > maxBytes }
    ctx.drawImage(img, 0, 0, width, height)

    // Step the JPEG quality down until under the ceiling.
    let quality = 0.9
    let blob = await canvasToBlob(canvas, quality)
    while (blob && blob.size > maxBytes && quality > 0.4) {
      quality -= 0.1
      blob = await canvasToBlob(canvas, quality)
    }
    // Still too big? Shrink dimensions and retry a couple of times.
    let guard = 0
    while (blob && blob.size > maxBytes && Math.max(canvas.width, canvas.height) > 600 && guard < 4) {
      guard++
      canvas.width = Math.max(1, Math.round(canvas.width * 0.8))
      canvas.height = Math.max(1, Math.round(canvas.height * 0.8))
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      blob = await canvasToBlob(canvas, 0.7)
    }

    if (!blob) return { file, tooLarge: file.size > maxBytes }

    // If compression didn't help (e.g. already-tiny PNG), keep whichever is smaller.
    if (blob.size >= file.size) {
      return { file, tooLarge: file.size > maxBytes }
    }

    const baseName = file.name.replace(/\.[a-zA-Z0-9]+$/, '') || 'image'
    const compressed = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })
    return { file: compressed, tooLarge: compressed.size > maxBytes }
  } catch {
    // On any failure, fall back to the original and let the size check decide.
    return { file, tooLarge: file.size > maxBytes }
  }
}

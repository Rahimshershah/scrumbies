'use client'

import { useState, useRef, useCallback } from 'react'
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'

interface ImageCropperProps {
  open: boolean
  onClose: () => void
  imageSrc: string
  onCropComplete: (croppedBlob: Blob) => Promise<void>
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number
): Crop {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight
    ),
    mediaWidth,
    mediaHeight
  )
}

async function getCroppedImg(
  image: HTMLImageElement,
  crop: PixelCrop
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height

  // Set canvas size to desired output size (256x256 for avatars)
  const outputSize = 256
  canvas.width = outputSize
  canvas.height = outputSize

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('No 2d context')
  }

  // Enable high quality image scaling
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  // Calculate source dimensions
  const sourceX = crop.x * scaleX
  const sourceY = crop.y * scaleY
  const sourceWidth = crop.width * scaleX
  const sourceHeight = crop.height * scaleY

  // Draw the cropped image scaled to output size
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    outputSize,
    outputSize
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'))
          return
        }
        resolve(blob)
      },
      'image/jpeg',
      0.9
    )
  })
}

export function ImageCropper({ open, onClose, imageSrc, onCropComplete }: ImageCropperProps) {
  const [crop, setCrop] = useState<Crop>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>()
  const [saving, setSaving] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    setCrop(centerAspectCrop(width, height, 1))
  }, [])

  const handleSave = async () => {
    if (!imgRef.current || !completedCrop) return

    setSaving(true)
    try {
      const croppedBlob = await getCroppedImg(imgRef.current, completedCrop)
      await onCropComplete(croppedBlob)
      onClose()
    } catch (error) {
      console.error('Failed to crop image:', error)
      alert('Failed to crop image. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    if (!saving) {
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Crop Profile Photo</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <div className="flex flex-col items-center gap-4">
            {/* Cropper */}
            <div className="max-h-[400px] overflow-hidden rounded-lg bg-muted">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop
                className="max-h-[400px]"
              >
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="Crop preview"
                  onLoad={onImageLoad}
                  className="max-h-[400px] max-w-full"
                  style={{ display: 'block' }}
                />
              </ReactCrop>
            </div>

            {/* Preview */}
            {completedCrop && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Preview:</span>
                <div
                  className="w-16 h-16 rounded-full overflow-hidden bg-muted border-2 border-primary"
                  style={{
                    backgroundImage: `url(${imageSrc})`,
                    backgroundSize: `${(imgRef.current?.width || 0) / (completedCrop.width / 64)}px ${(imgRef.current?.height || 0) / (completedCrop.height / 64)}px`,
                    backgroundPosition: `-${(completedCrop.x / completedCrop.width) * 64}px -${(completedCrop.y / completedCrop.height) * 64}px`,
                  }}
                />
              </div>
            )}

            <p className="text-xs text-muted-foreground text-center">
              Drag to reposition. The image will be cropped to a square.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !completedCrop}>
            {saving ? (
              <>
                <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Saving...
              </>
            ) : (
              'Save Photo'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

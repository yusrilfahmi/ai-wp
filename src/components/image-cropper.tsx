import React, { useState, useCallback } from 'react'
import Cropper, { Point, Area } from 'react-easy-crop'
import { Loader2 } from 'lucide-react'

// Helper to create HTML Image
const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image()
    image.addEventListener('load', () => resolve(image))
    image.addEventListener('error', (error) => reject(error))
    image.setAttribute('crossOrigin', 'anonymous')
    image.src = url
  })

// Canvas extraction logic 
async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  targetWidth = 1280,
  targetHeight = 720
): Promise<Blob | null> {
  const image = await createImage(imageSrc)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    return null
  }

  // Set final size
  canvas.width = targetWidth
  canvas.height = targetHeight

  // Draw scaled image
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    targetWidth,
    targetHeight
  )

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob)
    }, 'image/jpeg', 0.9)
  })
}

interface ImageCropperProps {
  imageFile: File
  onCropComplete: (croppedBlob: Blob) => void
  onCancel: () => void
}

export function ImageCropper({ imageFile, onCropComplete, onCancel }: ImageCropperProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Convert File to Object URL
  const [imageSrc] = useState(() => URL.createObjectURL(imageFile))

  const handleCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  // Lock horizontal axis by forcing x = 0
  const handleCropChange = (location: Point) => {
    setCrop({ x: 0, y: location.y })
  }

  const handleApply = async () => {
    if (!croppedAreaPixels) return
    setIsProcessing(true)
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels, 1280, 720)
      if (croppedBlob) {
        onCropComplete(croppedBlob)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Crop Thumbnail (16:9 Vertical Pan)</h3>
          <p className="text-sm text-gray-500 mt-1">
            Drag image up or down. Zooming and horizontal panning is locked.
          </p>
        </div>
        
        <div className="relative w-full h-[60vh] bg-gray-100">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={16 / 9}
            onCropChange={handleCropChange}
            onCropComplete={handleCropComplete}
            onZoomChange={() => {}} // disable zoom via UI
            objectFit="horizontal-cover"
            restrictPosition={true}
          />
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
          <button 
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2 font-medium text-gray-700 hover:text-gray-900 border border-transparent hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleApply}
            disabled={isProcessing}
            className="primary-btn px-6 min-w-[120px]"
          >
            {isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Apply Crop'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

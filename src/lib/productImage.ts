import { supabase } from './supabase'

// Photos for products that the barcode databases do not know. The phone shrinks the picture first (a camera photo is several MB),
// then it goes into the "product-images" bucket under the home's own folder. The product keeps only the link (products.image_url).
const BUCKET = 'product-images'
const MAX_SIDE = 640

/** True when the link points at a file in our own bucket (so it is ours to delete; links from Open Food Facts are not). */
export const isOurImage = (url: string | null | undefined): url is string => !!url && url.includes(`/storage/v1/object/public/${BUCKET}/`)

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('unreadable'))
    }
    img.src = url
  })
}

/** Scales the picture down to at most 640 px on its longest side and saves it as a JPEG (white behind transparent parts). */
async function shrink(file: File): Promise<Blob> {
  const img = await loadImage(file) // the browser applies the photo's rotation (EXIF) when drawing
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('no canvas')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no blob'))), 'image/jpeg', 0.82))
}

export async function uploadProductImage(householdId: string, file: File): Promise<{ url: string | null; error: string | null }> {
  if (!file.type.startsWith('image/')) return { url: null, error: 'Please choose a picture.' }
  let blob: Blob
  try {
    blob = await shrink(file)
  } catch {
    return { url: null, error: 'Could not read that picture. Try a different one.' }
  }
  const path = `${householdId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
  if (error) return { url: null, error: 'Could not upload the picture. Check your internet and try again.' }
  return { url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl, error: null }
}

/** Deletes a picture we uploaded (best effort; a link from somewhere else is left alone). */
export async function removeProductImage(url: string | null | undefined): Promise<void> {
  if (!isOurImage(url)) return
  const path = decodeURIComponent(url.split(`/storage/v1/object/public/${BUCKET}/`)[1] ?? '')
  if (path) await supabase.storage.from(BUCKET).remove([path])
}

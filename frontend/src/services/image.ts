// Downscale on the phone before upload: max 1280 px on the long side, JPEG quality 0.85.
export const MAX_SIDE = 1280;
export const JPEG_QUALITY = 0.85;

export async function downscale(file: Blob): Promise<Blob> {
  // createImageBitmap honours EXIF orientation with this option on modern browsers.
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions).catch(() => null);
  if (!bmp) return file;
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', JPEG_QUALITY));
  return blob ?? file;
}

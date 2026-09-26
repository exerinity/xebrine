const MAX_COVER_EDGE = 1024;
const MAX_COVER_BYTES = 750 * 1024;
const MAX_SOURCE_BYTES = 32 * 1024 * 1024;

function imageDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.decoding = 'async';
    const release = () => {
      image.onload = null;
      image.onerror = null;
      image.removeAttribute('src');
      URL.revokeObjectURL(url);
    };
    image.onload = () => {
      const { naturalWidth: width, naturalHeight: height } = image;
      release();
      if (width > 0 && height > 0) resolve({ width, height });
      else reject(new Error('Cover image has no dimensions'));
    };
    image.onerror = () => {
      release();
      reject(new Error('Could not decode cover image'));
    };
    image.src = url;
  });
}

export async function optimizeCoverImage(blob: Blob): Promise<Blob> {
  if (blob.size > MAX_SOURCE_BYTES) throw new Error('Cover image is too large');
  const { width, height } = await imageDimensions(blob);
  const scale = Math.min(1, MAX_COVER_EDGE / Math.max(width, height));
  if (scale === 1 && blob.size <= MAX_COVER_BYTES) return blob;

  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const bitmap = await createImageBitmap(blob, {
    resizeWidth: targetWidth,
    resizeHeight: targetHeight,
    resizeQuality: 'high'
  });
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas is unavailable');
    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => result ? resolve(result) : reject(new Error('could not resize cover image')),
        'image/webp',
        0.85
      );
    });
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}

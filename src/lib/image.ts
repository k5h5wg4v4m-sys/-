/**
 * Сжатие фото в браузере перед загрузкой: до 1600 px по длинной стороне, JPEG до ~500 КБ.
 * Возвращает JPEG-файл. Бросает "bad_image", если файл не картинка или не читается.
 */
export async function compressImage(file: File, maxSide = 1600, maxBytes = 500 * 1024): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("bad_image");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("bad_image");
  }

  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("bad_image");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.85;
  let blob: Blob | null = null;
  while (quality >= 0.4) {
    blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (!blob) throw new Error("bad_image");
    if (blob.size <= maxBytes) break;
    quality -= 0.1;
  }
  return blob as Blob;
}

/** Путь файла в Storage: <user_id>/<uuid>.jpg */
export function storagePath(userId: string): string {
  return `${userId}/${crypto.randomUUID()}.jpg`;
}

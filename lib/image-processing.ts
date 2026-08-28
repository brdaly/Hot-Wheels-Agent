import sharp from "sharp";
import { isSupportedImage } from "./security";

export const IMAGE_PIPELINE_VERSION = "evidence-image-v1.0";
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;
export const MAX_IMAGE_DIMENSION = 2_048;
export const MAX_IMAGE_FILES = 4;
export const MAX_TOTAL_UPLOAD_BYTES = 24 * 1024 * 1024;

export async function normalizeEvidenceImage(file: File) {
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    throw new RangeError(`Each image must be between 1 byte and ${MAX_IMAGE_BYTES / 1024 / 1024} MB`);
  }
  const input = Buffer.from(await file.arrayBuffer());
  if (!isSupportedImage(input, file.type)) throw new TypeError("File signature does not match JPEG, PNG or WebP");
  const pipeline = sharp(input, {
    failOn: "warning",
    limitInputPixels: MAX_IMAGE_PIXELS,
    sequentialRead: true,
  });
  const metadata = await pipeline.metadata();
  if (!metadata.width || !metadata.height || !["jpeg", "png", "webp"].includes(metadata.format ?? "")) {
    throw new TypeError("Unsupported or undecodable image");
  }
  if (metadata.width * metadata.height > MAX_IMAGE_PIXELS) throw new RangeError("Image pixel dimensions are too large");
  const output = await pipeline
    .rotate()
    .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 86, chromaSubsampling: "4:2:0", mozjpeg: true })
    .toBuffer();
  return {
    dataUrl: `data:image/jpeg;base64,${output.toString("base64")}`,
    metadata: {
      originalBytes: file.size,
      normalizedBytes: output.byteLength,
      originalWidth: metadata.width,
      originalHeight: metadata.height,
      originalFormat: metadata.format,
      outputFormat: "jpeg",
      maxDimension: MAX_IMAGE_DIMENSION,
      metadataStripped: true,
      pipelineVersion: IMAGE_PIPELINE_VERSION,
    },
  };
}

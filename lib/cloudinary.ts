import {
  v2 as cloudinary,
  type UploadApiOptions,
  type UploadApiResponse,
} from "cloudinary"

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
  secure: true,
})

type CloudinaryUploadResult = {
  url: string
  publicId: string
}

function assertCloudinaryConfig() {
  const missing = [
    ["CLOUDINARY_NAME", process.env.CLOUDINARY_NAME],
    ["CLOUDINARY_API_KEY", process.env.CLOUDINARY_API_KEY],
    ["CLOUDINARY_SECRET_KEY", process.env.CLOUDINARY_SECRET_KEY],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    throw new Error(`Missing Cloudinary environment variables: ${missing.join(", ")}`)
  }
}

function uploadBuffer(
  buffer: Buffer,
  options: UploadApiOptions
): Promise<UploadApiResponse> {
  assertCloudinaryConfig()

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        reject(error)
        return
      }

      if (!result) {
        reject(new Error("Cloudinary upload completed without a result"))
        return
      }

      resolve(result)
    })

    stream.end(buffer)
  })
}

function toPublicIdPrefix(fileName: string) {
  return fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "upload"
}

export async function uploadFile(
  buffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<CloudinaryUploadResult> {
  const result = await uploadBuffer(buffer, {
    folder: "rubenius/documents",
    public_id: `${toPublicIdPrefix(fileName)}-${crypto.randomUUID()}`,
    resource_type: "auto",
    type: "upload",
    use_filename: true,
    filename_override: fileName,
    context: {
      original_filename: fileName,
      mime_type: mimeType,
    },
  })

  return {
    url: result.secure_url,
    publicId: result.public_id,
  }
}

export function generateSignature(paramsToSign: Record<string, string | number | boolean>) {
  assertCloudinaryConfig()
  return cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_SECRET_KEY!)
}

export function getCloudinaryName() {
  return process.env.CLOUDINARY_NAME
}

export function getCloudinaryApiKey() {
  return process.env.CLOUDINARY_API_KEY
}


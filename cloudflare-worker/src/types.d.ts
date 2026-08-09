// R2Bucket.createPresignedUrl exists at runtime but is not yet in @cloudflare/workers-types
interface R2PresignedUrlOptions {
  key: string
  method: 'GET' | 'PUT'
  expiresIn: number // seconds
}

interface R2Bucket {
  createPresignedUrl(options: R2PresignedUrlOptions): Promise<string>
}

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

interface R2Object {
  key: string
  size: number
  etag: string
}

async function main() {
  const outputPath = path.join(process.cwd(), 'content', 'r2-meta.json')

  try {
    const raw = execSync('npx wrangler r2 object list blog-downloads --json', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const objects: R2Object[] = JSON.parse(raw)
    const meta: Record<string, { size: number; etag: string }> = {}

    for (const obj of objects) {
      meta[obj.key] = { size: obj.size, etag: obj.etag }
    }

    fs.writeFileSync(outputPath, JSON.stringify(meta, null, 2))

    console.log(`[fetch-r2-meta] Wrote ${Object.keys(meta).length} entries to ${outputPath}`)
  } catch (err) {
    console.warn('[fetch-r2-meta] Failed to fetch R2 metadata (bucket may be empty or wrangler not configured):', (err as Error).message)
    // Write empty meta so build doesn't break
    fs.writeFileSync(outputPath, '{}')
  }
}

main()

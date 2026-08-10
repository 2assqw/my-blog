export interface Env {
  BLOG_DOWNLOADS: R2Bucket
  DB: D1Database
  TURNSTILE_SECRET_KEY: string
  UPLOAD_PASSWORD: string
}

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

function cors(headers?: HeadersInit): Headers {
  const h = new Headers(headers)
  h.set('Access-Control-Allow-Origin', '*')
  h.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  h.set('Access-Control-Allow-Headers', 'Content-Type')
  return h
}

async function verify(token: string, secret: string): Promise<boolean> {
  const body = new FormData()
  body.append('secret', secret)
  body.append('response', token)
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body,
  })
  const data = await res.json() as { success: boolean }
  return data.success
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors() })
    }

    // GET /dl/:slug/:fingerprint
    const dlMatch = url.pathname.match(/^\/dl\/([^/]+)\/([^/]+)$/)
    if (dlMatch) {
      const [, slug, fp] = dlMatch
      const filename = decodeURIComponent(fp)
      const r2Key = `downloads/${slug}/${filename}`

      try {
        const token = url.searchParams.get('token')
        if (!token) {
          return new Response('Verification required', { status: 403 })
        }
        if (!(await verify(token, env.TURNSTILE_SECRET_KEY))) {
          return new Response('Verification failed', { status: 403 })
        }
        const object = await env.BLOG_DOWNLOADS.get(r2Key)
        if (!object) return new Response('File not found', { status: 404 })
        await env.DB.prepare('INSERT INTO downloads (slug, r2_key) VALUES (?, ?)').bind(slug, r2Key).run()
        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('etag', object.httpEtag)
        headers.set('Content-Disposition', `attachment; filename="${filename}"`)
        return new Response(object.body, { status: 200, headers })
      } catch (e) {
        console.error('Download error:', e)
        return new Response('Internal error', { status: 500 })
      }
    }

    // GET /api/downloads/:slug/count
    const countMatch = url.pathname.match(/^\/api\/downloads\/([^/]+)\/count$/)
    if (countMatch) {
      const slug = countMatch[1]
      try {
        const result = await env.DB.prepare('SELECT COUNT(*) as total FROM downloads WHERE slug = ?')
          .bind(slug).first<{ total: number }>()
        return Response.json({ slug, total: result?.total || 0 }, { headers: cors() })
      } catch (e) {
        console.error('Count error:', e)
        return Response.json({ slug, total: 0 })
      }
    }

    // GET /api/storage
    if (url.pathname === '/api/storage') {
      try {
        const list = await env.BLOG_DOWNLOADS.list({ limit: 1000 })
        let totalSize = 0
        for (const obj of list.objects) totalSize += obj.size
        return Response.json({
          files: list.objects.length,
          usedBytes: totalSize,
          limitBytes: 10 * 1024 * 1024 * 1024,
        }, { headers: cors() })
      } catch (e) {
        console.error('Storage error:', e)
        return Response.json({ files: 0, usedBytes: 0, limitBytes: 10 * 1024 * 1024 * 1024 }, { headers: cors() })
      }
    }

    // POST /api/upload
    if (url.pathname === '/api/upload' && request.method === 'POST') {
      try {
        const password = request.headers.get('X-Upload-Password') || ''
        if (password !== env.UPLOAD_PASSWORD) {
          return new Response('Unauthorized', { status: 401, headers: cors() })
        }
        const contentLength = Number(request.headers.get('Content-Length') || 0)
        if (contentLength > MAX_FILE_SIZE) {
          return new Response('File too large', { status: 413, headers: cors() })
        }

        // Check remaining storage
        const list = await env.BLOG_DOWNLOADS.list({ limit: 1000 })
        let used = 0
        for (const obj of list.objects) used += obj.size
        if (used + contentLength > 10 * 1024 * 1024 * 1024) {
          return new Response('Storage full', { status: 507, headers: cors() })
        }

        const key = url.searchParams.get('key') || `uploads/${Date.now()}`
        await env.BLOG_DOWNLOADS.put(key, request.body, {
          httpMetadata: { contentType: request.headers.get('Content-Type') || 'application/octet-stream' },
        })

        return Response.json({ ok: true, r2Key: key }, { headers: cors() })
      } catch (e) {
        console.error('Upload error:', e)
        return new Response('Upload failed', { status: 500, headers: cors() })
      }
    }

    return new Response('Not found', { status: 404 })
  },
}

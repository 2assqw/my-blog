export interface Env {
  BLOG_DOWNLOADS: R2Bucket
  DB: D1Database
  TURNSTILE_SECRET_KEY: string
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

// r2Key convention: downloads/<slug>/<filename>
// URL format: /dl/<slug>/<url-encoded-filename>
// Worker reconstructs the full r2Key from URL parameters.

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // GET /dl/:slug/:fingerprint  (fingerprint = URL-encoded filename)
    const dlMatch = url.pathname.match(/^\/dl\/([^/]+)\/([^/]+)$/)
    if (dlMatch) {
      const [, slug, fp] = dlMatch
      const filename = decodeURIComponent(fp)
      const r2Key = `downloads/${slug}/${filename}`

      try {
        // Verify Turnstile token
        const token = url.searchParams.get('token')
        if (!token) {
          return new Response('Verification required', { status: 403 })
        }
        const valid = await verify(token, env.TURNSTILE_SECRET_KEY)
        if (!valid) {
          return new Response('Verification failed', { status: 403 })
        }

        // Get the object from R2
        const object = await env.BLOG_DOWNLOADS.get(r2Key)
        if (!object) {
          return new Response('File not found', { status: 404 })
        }

        // Record download
        await env.DB.prepare(
          'INSERT INTO downloads (slug, r2_key) VALUES (?, ?)'
        ).bind(slug, r2Key).run()

        // Return file directly
        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('etag', object.httpEtag)
        headers.set('Content-Disposition', `attachment; filename="${filename}"`)

        return new Response(object.body, {
          status: 200,
          headers,
        })
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
        const result = await env.DB.prepare(
          'SELECT COUNT(*) as total FROM downloads WHERE slug = ?'
        ).bind(slug).first<{ total: number }>()

        return Response.json({ slug, total: result?.total || 0 })
      } catch (e) {
        console.error('Count error:', e)
        return Response.json({ slug, total: 0 })
      }
    }

    return new Response('Not found', { status: 404 })
  },
}

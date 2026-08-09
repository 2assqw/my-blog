export interface Env {
  BLOG_DOWNLOADS: R2Bucket
  DB: D1Database
}

// r2Key convention: downloads/<slug>/<filename>
// URL format: /dl/<slug>/<url-encoded-filename>
// Worker reconstructs the full r2Key from URL parameters.

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // GET /dl/:slug/:fingerprint  (fingerprint = URL-encoded filename)
    const dlMatch = url.pathname.match(/^\/([^/]+)\/([^/]+)$/)
    if (dlMatch) {
      const [, slug, fp] = dlMatch
      const filename = decodeURIComponent(fp)
      const r2Key = `downloads/${slug}/${filename}`

      try {
        // Verify file exists
        const head = await env.BLOG_DOWNLOADS.head(r2Key)
        if (!head) {
          return new Response('File not found', { status: 404 })
        }

        // Record download
        await env.DB.prepare(
          'INSERT INTO downloads (slug, r2_key) VALUES (?, ?)'
        ).bind(slug, r2Key).run()

        // Generate presigned URL (5 min expiry)
        const presigned = await env.BLOG_DOWNLOADS.createPresignedUrl({
          key: r2Key,
          method: 'GET',
          expiresIn: 300,
        })

        return new Response(null, {
          status: 307,
          headers: {
            Location: presigned,
            'Cache-Control': 'no-cache',
          },
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

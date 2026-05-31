import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  trailingSlash: true,
}

export default nextConfig

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());

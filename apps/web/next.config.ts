import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Vinext's VPS runtime does not transform images; its compatibility route
  // redirects to the source asset. Render public editorial assets directly so
  // they cannot be downgraded to HTTP by a reverse-proxy scheme mismatch.
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

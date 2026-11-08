/** @type {import('next').NextConfig} */
const nextConfig = {
  // Static-friendly: all pages are prerendered at build time.
  // No special config needed — Vercel auto-detects Next.js.
  // ESLint's flat config is run explicitly by `npm run lint`. Next 15's
  // legacy build-time wrapper passes options that flat config rejects.
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

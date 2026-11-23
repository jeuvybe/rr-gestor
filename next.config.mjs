/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: ['standardwebhooks'],
  devIndicators: false,
};
export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Playwright is only used by the worker/submission runtime, never bundled into the client.
  experimental: {
    serverComponentsExternalPackages: ["playwright", "@prisma/client", "bcryptjs"],
  },
};

export default nextConfig;

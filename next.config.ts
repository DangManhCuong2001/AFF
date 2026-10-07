import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['ffmpeg-static'],
  outputFileTracingIncludes: {
    '/api/**/*': [
      './public/**/*',
      './src/assets/**/*',
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'ffmpeg-static',
  ],
  outputFileTracingIncludes: {
    '/api/**/*': [
      './public/fonts/**/*',
      './src/assets/fonts/**/*',
      './public/music/**/*',
    ],
  },
};

export default nextConfig;

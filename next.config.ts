import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'ffmpeg-static',
    '@remotion/bundler',
    '@remotion/renderer',
    'remotion',
    '@remotion/player',
    '@remotion/studio',
  ],
  outputFileTracingIncludes: {
    '/api/**/*': [
      './public/**/*',
      './src/assets/**/*',
    ],
  },
};

export default nextConfig;

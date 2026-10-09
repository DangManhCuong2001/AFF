import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'ffmpeg-static',
    '@remotion/bundler',
    '@remotion/renderer',
    'remotion',
    '@remotion/studio',
  ],
  outputFileTracingIncludes: {
    '/api/**/*': [
      './public/**/*',
      './src/assets/**/*',
      './node_modules/ffmpeg-static/ffmpeg',
    ],
  },
};

export default nextConfig;

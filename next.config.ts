import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // メモリ使用量削減: 静的生成のワーカー数を制限
    workerThreads: false,
    cpus: 1,
  },
};

export default nextConfig;

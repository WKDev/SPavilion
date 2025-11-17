/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Electron에서는 standalone 빌드가 필요하지 않음
  // standalone은 서버 배포용이므로 Electron에서는 제거
  // output: 'standalone',
  
  // Electron 환경에서 필요한 설정
  reactStrictMode: false, // Electron에서 호환성 문제 방지
  swcMinify: true,
  
  // WebRTC 관련 환경 변수는 런타임에 설정됨
  env: {
    NEXT_PUBLIC_WEBRTC_URL: process.env.NEXT_PUBLIC_WEBRTC_URL || 'http://localhost:8889',
  },
}

export default nextConfig

import { StreamViewer } from "@/components/dashboard/stream-viewer"
import { DevMan } from "@/components/device/dev-man"
import { UsageHist } from "@/components/dashboard/usage-hist"
import { StayRate } from "@/components/dashboard/stay-rate"
import { WeatherCard } from "@/components/dashboard/weather-card"

export default function DashboardPage() {
  return (
    // 전체 컨테이너: 화면 높이에 맞게 설정 (h-screen 또는 calc 사용)
    <div className="flex h-[100vh] flex-row gap-3 overflow-hidden">
      
      {/* 1. 왼쪽 & 중앙 메인 영역 (StreamViewer + UsageHist) */}
      <div className="flex flex-[7] flex-col gap-3 min-w-0">
        
        {/* 상단 메인: StreamViewer */}
        <div className="flex-1 min-h-0 bg-slate-900 rounded-lg overflow-hidden">
          <StreamViewer />
        </div>

        {/* 하단 도킹 영역: UsageHist (VS Code 터미널 느낌) */}
        <div className="h-1/3 min-h-[250px] border-t border-gray-200 dark:border-gray-800">
          <UsageHist />
        </div>
      </div>

      {/* 2. 우측 사이드바 (WeatherCard, StayRate, DevMan) */}
      <div className="flex flex-[3] flex-col gap-3 min-w-[300px] overflow-y-auto">
        <WeatherCard />
        <StayRate />
        <DevMan />
      </div>

    </div>
  );
}
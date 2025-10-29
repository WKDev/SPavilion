import { StreamViewer } from "@/components/dashboard/stream-viewer"
import { DevMan } from "@/components/dashboard/dev-man"
import { UsageHist } from "@/components/dashboard/usage-hist"
import { StayRate } from "@/components/dashboard/stay-rate"

export default function DashboardPage() {
  return (
    <div className="flex h-[calc(100vh-10rem)] flex-row gap-3">
      {/* Left Column (70%): StreamViewer + UsageHistory */}
      <div className="flex flex-[7] flex-col gap-3">
        <StreamViewer />
      </div>

      {/* Right Column (30%): StayRate + DevMan */}
      <div className="flex-[3] flex flex-col gap-3">
      <StayRate />
      <DevMan />
      <UsageHist />
      </div>
    </div>
  )
}

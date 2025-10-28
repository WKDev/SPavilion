import { StreamViewer } from "@/components/dashboard/stream-viewer"
import { DevMan } from "@/components/dashboard/dev-man"
import { UsageHist } from "@/components/dashboard/usage-hist"
import { StayRate } from "@/components/dashboard/stay-rate"

export default function DashboardPage() {
  return (
    <div className="flex h-full flex-row gap-3">
      {/* Left Column (70%): StreamViewer + UsageHistory */}
      <div className="flex flex-[7] flex-col gap-3">
        <div className="flex-[6]">
          <StreamViewer />
        </div>
        <div className="flex-[4]">
          <UsageHist />
        </div>
      </div>

      {/* Right Column (30%): StayRate + DevMan */}
      <div className="flex-[3] flex flex-col gap-3">
        <div className="flex-[5]">
          <StayRate />
        </div>
        <div className="flex-[5]">
          <DevMan />
        </div>
      </div>
    </div>
  )
}

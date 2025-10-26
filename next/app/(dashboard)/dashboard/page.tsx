import { StreamViewer } from "@/components/dashboard/stream-viewer"
import { DevMan } from "@/components/dashboard/dev-man"
import { UsageHist } from "@/components/dashboard/usage-hist"

export default function DashboardPage() {
  return (
    <div className="grid h-full grid-cols-10 gap-3">
      {/* Row 1 */}
      <div className="col-span-6">
        <StreamViewer />
      </div>
      <div className="col-span-4">
        <DevMan />
      </div>

      {/* Row 2 */}
      <div className="col-span-10">
        <UsageHist />
      </div>
    </div>
  )
}

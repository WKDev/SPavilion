"use client"

import { useState } from "react"
import type { HeatmapData } from "@/lib/api"
import { HeatmapVisualization } from "@/components/heatmap/heatmap-visualization"
import { Button } from "@/components/ui/button"

interface HeatmapChartProps {
  data: HeatmapData[]
}

export function HeatmapChart({ data }: HeatmapChartProps) {
  const [showCameraBoxes, setShowCameraBoxes] = useState(false)

  return (
    <div className="relative">
      {/* Toggle button for CameraBox overlay */}
      <div className="absolute top-2 right-2 z-10">
        <Button
          variant={showCameraBoxes ? "default" : "outline"}
          size="sm"
          onClick={() => setShowCameraBoxes(!showCameraBoxes)}
        >
          {showCameraBoxes ? "Hide Areas" : "Show Areas"}
        </Button>
      </div>
      <HeatmapVisualization data={data} mode="standalone" showCameraBoxes={showCameraBoxes} />
    </div>
  )
}

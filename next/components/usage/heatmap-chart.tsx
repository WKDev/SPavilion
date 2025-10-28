"use client"

import type { HeatmapData } from "@/lib/api"
import { HeatmapVisualization } from "@/components/heatmap/heatmap-visualization"

interface HeatmapChartProps {
  data: HeatmapData[]
}

export function HeatmapChart({ data }: HeatmapChartProps) {
  return <HeatmapVisualization data={data} mode="standalone" />
}

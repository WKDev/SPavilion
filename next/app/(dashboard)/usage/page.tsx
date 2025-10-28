"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Histogram } from "@/components/usage/histogram"
import { api, type HistogramData, type HeatmapData } from "@/lib/api"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HeatmapChart } from "@/components/usage/heatmap-chart"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useStore } from "@/lib/store"

export default function UsagePage() {
  const [histogramData, setHistogramData] = useState<HistogramData[]>([])
  const [heatmapData, setHeatmapData] = useState<HeatmapData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDevices, setSelectedDevices] = useState<string[]>(["heat", "fan", "btsp"])
  const timeRangeState = useStore((state) => state.timeRange)

  // Convert global time range state to { from, to } format with useMemo
  const timeRange = useMemo(() => {
    const fromDate = new Date(timeRangeState.fromDate)
    const [fromHour, fromMinute] = timeRangeState.fromTime.split(":").map(Number)
    fromDate.setHours(fromHour, fromMinute, 0, 0)

    const toDate = new Date(timeRangeState.toDate)
    const [toHour, toMinute] = timeRangeState.toTime.split(":").map(Number)
    toDate.setHours(toHour, toMinute, 59, 999)

    return { from: fromDate, to: toDate }
  }, [timeRangeState.fromDate, timeRangeState.toDate, timeRangeState.fromTime, timeRangeState.toTime])

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [histogram, heatmap] = await Promise.all([api.getUsageHistory(timeRange), api.getHeatmap(timeRange)])
        setHistogramData(histogram)
        setHeatmapData(heatmap)
      } catch (error) {
        console.error("[v0] Failed to fetch usage data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [timeRange])

  const filteredHistogramData = histogramData.filter((item) => selectedDevices.includes(item.device))

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-3xl font-bold">Usage Analytics</h1>
        <p className="text-muted-foreground">View device usage history and analytics</p>
      </div>


      <Tabs defaultValue="histogram" className="w-full">
        <TabsList>
          <TabsTrigger value="histogram">Histogram</TabsTrigger>
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
        </TabsList>

        <TabsContent value="histogram">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">Devices:</span>
                <ToggleGroup
                  type="multiple"
                  value={selectedDevices}
                  onValueChange={(value) => {
                    if (value.length > 0) {
                      setSelectedDevices(value)
                    }
                  }}
                >
                  <ToggleGroupItem value="heat">Heat</ToggleGroupItem>
                  <ToggleGroupItem value="fan">Fan</ToggleGroupItem>
                  <ToggleGroupItem value="btsp">BTSP</ToggleGroupItem>
                </ToggleGroup>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-[400px] items-center justify-center">
                  <p className="text-muted-foreground">Loading histogram data...</p>
                </div>
              ) : filteredHistogramData.length === 0 ? (
                <div className="flex h-[400px] items-center justify-center">
                  <p className="text-muted-foreground">No histogram data available for selected devices</p>
                </div>
              ) : (
                <Histogram 
                  data={filteredHistogramData} 
                  startDate={timeRange.from} 
                  endDate={timeRange.to} 
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="heatmap">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-4">
                <div className="text-sm font-medium">Devices:</div>
                {/* Placeholder for future device filter toggle group for heatmap */}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-[400px] items-center justify-center">
                  <p className="text-muted-foreground">Loading heatmap data...</p>
                </div>
              ) : heatmapData.length === 0 ? (
                <div className="flex h-[400px] items-center justify-center">
                  <p className="text-muted-foreground">No heatmap data available for this time range</p>
                </div>
              ) : (
                <HeatmapChart data={heatmapData} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

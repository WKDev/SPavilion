"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Histogram } from "@/components/usage/histogram"
import { api, type HistogramData } from "@/lib/api"
import { useStore } from "@/lib/store"

export function UsageHist() {
  const [data, setData] = useState<HistogramData[]>([])
  const [loading, setLoading] = useState(true)
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
        const histogramData = await api.getUsageHistory(timeRange)
        setData(histogramData)
      } catch (error) {
        console.error("[v0] Failed to fetch usage history:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [timeRange])

  return (
    <Card className="h-[400px]">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle>Usage History</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex h-[250px] items-center justify-center">
            <p className="text-muted-foreground">Loading usage data...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center">
            <p className="text-muted-foreground">No usage data available for this time range</p>
          </div>
        ) : (
          <Histogram data={data} startDate={timeRange.from} endDate={timeRange.to} />
        )}
      </CardContent>
    </Card>
  )
}

"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Histogram } from "@/components/usage/histogram"
import { api, type HistogramData } from "@/lib/api"
import { useStore } from "@/lib/store"

const REFRESH_INTERVAL = 60 * 1000 // 1 minute

export function UsageHist() {
  const [data, setData] = useState<HistogramData[]>([])
  const [loading, setLoading] = useState(true)
  const timeRangeState = useStore((state) => state.timeRange)
  const usageHistRefreshKey = useStore((state) => state.usageHistRefreshKey)

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

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const histogramData = await api.getUsageHistory(timeRange)
      setData(histogramData)
    } catch (error) {
      console.error("[v0] Failed to fetch usage history:", error)
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [timeRange])

  // Initial fetch and refresh on timeRange/key change
  useEffect(() => {
    fetchData()
  }, [fetchData, usageHistRefreshKey])

  // Periodic refresh every minute
  useEffect(() => {
    const interval = setInterval(() => {
      fetchData(false) // Don't show loading indicator for periodic refresh
    }, REFRESH_INTERVAL)

    return () => clearInterval(interval)
  }, [fetchData])

  return (
    <Card className="">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle>사용 이력</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center">
            <p className="text-muted-foreground">Loading usage data...</p>
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center">
            <p className="text-muted-foreground">No usage data available for this time range</p>
          </div>
        ) : (
          <Histogram data={data} startDate={timeRange.from} endDate={timeRange.to} />
        )}
      </CardContent>
    </Card>
  )
}

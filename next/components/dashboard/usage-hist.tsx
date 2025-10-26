"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TimeRangeSelector } from "@/components/usage/time-range-selector"
import { Histogram } from "@/components/usage/histogram"
import { api, type HistogramData } from "@/lib/api"

export function UsageHist() {
  const [data, setData] = useState<HistogramData[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState({
    from: new Date(Date.now() - 24 * 60 * 60 * 1000),
    to: new Date(),
  })

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

  const handleRangeChange = (from: Date, to: Date) => {
    setTimeRange({ from, to })
  }

  return (
    <Card className="h-[400px]">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <CardTitle>Usage History</CardTitle>
          <TimeRangeSelector onRangeChange={handleRangeChange} />
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
          <Histogram data={data} />
        )}
      </CardContent>
    </Card>
  )
}

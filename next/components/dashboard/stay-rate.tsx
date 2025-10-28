"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCameraAreaStore, useStore } from "@/lib/store"
import { getHeatmap } from "@/lib/api"
import type { HeatmapData } from "@/lib/types"
import type { CameraArea } from "@/lib/store"

interface AreaRank {
  nickname: string
  hits: number
  rank: number
}

/**
 * Check if a heatmap point (bbox center) falls within a camera area's box
 */
function isPointInArea(x: number, y: number, area: CameraArea): boolean {
  // Check if point is within any of the area's boxes
  return area.box.some((box) => {
    return x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2
  })
}

/**
 * Calculate hits for each camera area from heatmap data
 */
function calculateAreaHits(
  heatmapData: HeatmapData[],
  areas: CameraArea[]
): Map<string, number> {
  const areaHits = new Map<string, number>()

  // Initialize all areas with 0 hits
  areas.forEach((area) => {
    if (area.enabled) {
      areaHits.set(area.nickname, 0)
    }
  })

  // Count hits for each heatmap point
  heatmapData.forEach((point) => {
    areas.forEach((area) => {
      if (area.enabled && isPointInArea(point.x, point.y, area)) {
        const currentHits = areaHits.get(area.nickname) || 0
        areaHits.set(area.nickname, currentHits + point.value)
      }
    })
  })

  return areaHits
}

/**
 * Convert hit map to ranked list
 */
function rankAreas(areaHits: Map<string, number>): AreaRank[] {
  // Convert to array and sort by hits (descending)
  const sorted = Array.from(areaHits.entries())
    .map(([nickname, hits]) => ({ nickname, hits }))
    .sort((a, b) => b.hits - a.hits)

  // Assign ranks (handle ties)
  let currentRank = 1
  let previousHits = -1

  return sorted.map((item, index) => {
    if (item.hits !== previousHits) {
      currentRank = index + 1
    }
    previousHits = item.hits

    return {
      ...item,
      rank: currentRank,
    }
  })
}

export function StayRate() {
  const { areas } = useCameraAreaStore()
  const timeRangeState = useStore((state) => state.timeRange)
  const [rankedAreas, setRankedAreas] = useState<AreaRank[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date())

  // Convert global time range state to { from, to } format with useMemo to prevent infinite loops
  const timeRange = useMemo(() => {
    const fromDate = new Date(timeRangeState.fromDate)
    const [fromHour, fromMinute] = timeRangeState.fromTime.split(":").map(Number)
    fromDate.setHours(fromHour, fromMinute, 0, 0)

    const toDate = new Date(timeRangeState.toDate)
    const [toHour, toMinute] = timeRangeState.toTime.split(":").map(Number)
    toDate.setHours(toHour, toMinute, 59, 999)

    return { from: fromDate, to: toDate }
  }, [timeRangeState.fromDate, timeRangeState.toDate, timeRangeState.fromTime, timeRangeState.toTime])

  /**
   * Fetch heatmap data and calculate rankings
   */
  const fetchAndCalculate = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Fetch heatmap data for the time range
      const heatmapData = await getHeatmap(timeRange)

      // Calculate hits per area
      const areaHits = calculateAreaHits(heatmapData, areas)

      // Rank areas by hits
      const ranked = rankAreas(areaHits)

      setRankedAreas(ranked)
      setLastUpdateTime(new Date())
    } catch (err) {
      console.error("Failed to fetch heatmap data:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch data")
    } finally {
      setLoading(false)
    }
  }, [timeRange, areas])

  /**
   * Initial fetch and periodic refresh (every 10 minutes)
   */
  useEffect(() => {
    fetchAndCalculate()

    // Set up periodic refresh every 10 minutes (600,000ms)
    const intervalId = setInterval(() => {
      fetchAndCalculate()
    }, 10 * 60 * 1000)

    return () => clearInterval(intervalId)
  }, [fetchAndCalculate])

  /**
   * Re-fetch when time range changes
   */
  useEffect(() => {
    fetchAndCalculate()
  }, [fetchAndCalculate])

  /**
   * Empty state: No areas defined
   */
  if (areas.length === 0) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle>Stay Rate</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4">
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            No camera areas defined
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Stay Rate</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 overflow-hidden">
        {/* Ranked List */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Loading...
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center py-8 text-destructive">
              {error}
            </div>
          )}

          {!loading && !error && rankedAreas.length === 0 && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              No detections in this time range
            </div>
          )}

          {!loading && !error && rankedAreas.length > 0 && (
            <div className="space-y-2">
              {rankedAreas.map((area) => (
                <div
                  key={area.nickname}
                  className="flex items-center justify-between p-3 rounded-lg bg-accent/50 hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                      {area.rank}
                    </div>
                    <span className="font-medium">{area.nickname}</span>
                  </div>
                  <span className="text-muted-foreground text-sm">
                    {area.hits.toLocaleString()} hits
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Last Update Time */}
        {!loading && !error && rankedAreas.length > 0 && (
          <div className="text-xs text-muted-foreground text-right">
            Last updated: {lastUpdateTime.toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

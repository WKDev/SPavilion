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
  color: string
}

// Color map for surveillance areas (fallback for backwards compatibility)
const COLOR_MAP: Record<number, { stroke: string; fill: string; name: string }> = {
  1: { stroke: "#ef4444", fill: "rgba(239, 68, 68, 0.15)", name: "Red" },
  2: { stroke: "#22c55e", fill: "rgba(34, 197, 94, 0.15)", name: "Green" },
  3: { stroke: "#3b82f6", fill: "rgba(59, 130, 246, 0.15)", name: "Blue" },
  4: { stroke: "#a855f7", fill: "rgba(168, 85, 247, 0.15)", name: "Purple" },
  5: { stroke: "#f97316", fill: "rgba(249, 115, 22, 0.15)", name: "Orange" },
  6: { stroke: "#06b6d4", fill: "rgba(6, 182, 212, 0.15)", name: "Cyan" },
  7: { stroke: "#ec4899", fill: "rgba(236, 72, 153, 0.15)", name: "Magenta" },
  8: { stroke: "#eab308", fill: "rgba(234, 179, 8, 0.15)", name: "Yellow" },
  9: { stroke: "#f43f5e", fill: "rgba(244, 63, 94, 0.15)", name: "Pink" },
  10: { stroke: "#14b8a6", fill: "rgba(20, 184, 166, 0.15)", name: "Teal" },
}

/**
 * Check if a heatmap point (bbox center) falls within a camera area's box
 * Note: Both heatmap data and CameraBox use top-left origin (0,0) with FHD (1920x1080) resolution
 */
function isPointInArea(x: number, y: number, area: CameraArea, debug = false): boolean {
  // Check if point is within any of the area's boxes
  const result = area.box.some((box) => {
    const isInBox = x >= box.x1 && x <= box.x2 && y >= box.y1 && y <= box.y2
    if (debug && isInBox) {
      console.log(`[isPointInArea] Point (${x}, ${y}) IS IN box [${box.x1}, ${box.y1}, ${box.x2}, ${box.y2}] of area "${area.nickname}"`)
    }
    return isInBox
  })
  return result
}

/**
 * Calculate hits for each camera area from heatmap data
 */
function calculateAreaHits(
  heatmapData: HeatmapData[],
  areas: CameraArea[],
  debug = false
): Map<string, { hits: number; color: string }> {
  const areaHits = new Map<string, { hits: number; color: string }>()

  // Initialize all areas with 0 hits
  areas.forEach((area) => {
    if (area.enabled) {
      const customColor = area.color || COLOR_MAP[area.colorCode]?.stroke || "#ef4444"
      areaHits.set(area.nickname, { hits: 0, color: customColor })
    }
  })

  if (debug) {
    console.log(`[calculateAreaHits] Processing ${heatmapData.length} heatmap points`)
    console.log(`[calculateAreaHits] Enabled areas:`, areas.filter(a => a.enabled).map(a => ({
      nickname: a.nickname,
      boxes: a.box.map(b => `[${b.x1},${b.y1}]->[${b.x2},${b.y2}]`)
    })))
  }

  // Count hits for each heatmap point
  let totalPointsProcessed = 0
  let totalPointsMatched = 0

  heatmapData.forEach((point, idx) => {
    totalPointsProcessed++
    let pointMatched = false

    areas.forEach((area) => {
      if (area.enabled && isPointInArea(point.x, point.y, area, debug && idx < 10)) {
        const customColor = area.color || COLOR_MAP[area.colorCode]?.stroke || "#ef4444"
        const current = areaHits.get(area.nickname) || { hits: 0, color: customColor }
        areaHits.set(area.nickname, { hits: current.hits + point.value, color: customColor })
        pointMatched = true

        if (debug && idx < 10) {
          console.log(`[calculateAreaHits] Point #${idx} (${point.x}, ${point.y}) value=${point.value} → area "${area.nickname}" (new total: ${current.hits + point.value})`)
        }
      }
    })

    if (pointMatched) totalPointsMatched++
  })

  if (debug) {
    console.log(`[calculateAreaHits] Summary:`)
    console.log(`  - Total points: ${totalPointsProcessed}`)
    console.log(`  - Points matched to areas: ${totalPointsMatched}`)
    console.log(`  - Points NOT matched: ${totalPointsProcessed - totalPointsMatched}`)
    console.log(`  - Area hits:`, Object.fromEntries(areaHits))
  }

  return areaHits
}

/**
 * Convert hit map to ranked list
 */
function rankAreas(areaHits: Map<string, { hits: number; color: string }>): AreaRank[] {
  // Convert to array and sort by hits (descending)
  const sorted = Array.from(areaHits.entries())
    .map(([nickname, data]) => ({ nickname, hits: data.hits, color: data.color }))
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
  const [debugMode, setDebugMode] = useState(false) // Toggle for debug logging

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
      if (debugMode) {
        console.log(`[StayRate] Fetching heatmap data for time range:`, timeRange)
      }

      // Fetch heatmap data for the time range
      const heatmapData = await getHeatmap(timeRange)

      if (debugMode) {
        console.log(`[StayRate] Received ${heatmapData.length} heatmap data points`)
        console.log(`[StayRate] First 5 points:`, heatmapData.slice(0, 5))
        console.log(`[StayRate] Total hits:`, heatmapData.reduce((sum, d) => sum + d.value, 0))
      }

      // Calculate hits per area
      const areaHits = calculateAreaHits(heatmapData, areas, debugMode)

      // Rank areas by hits
      const ranked = rankAreas(areaHits)

      if (debugMode) {
        console.log(`[StayRate] Ranking results:`, ranked)
      }

      setRankedAreas(ranked)
      setLastUpdateTime(new Date())
    } catch (err) {
      console.error("Failed to fetch heatmap data:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch data")
    } finally {
      setLoading(false)
    }
  }, [timeRange, areas, debugMode])

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
      <Card className="flex flex-col h-[calc(100vh-45rem)]">
        <CardHeader>
          <CardTitle></CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-4">
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
          {'정의된 감시영역이 없습니다. 설정/ 감시영역 관리에서 감시영역을 설정해주세요.'}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col h-[calc(100vh-45rem)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>사용량 순위</CardTitle>
        <button
          onClick={() => setDebugMode(!debugMode)}
          className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/80 transition-colors"
          title="Toggle debug logging in browser console"
        >
          {debugMode ? "🐛 Debug ON" : "Debug OFF"}
        </button>
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
              {rankedAreas.map((area) => {
                return (
                  <div
                    key={area.nickname}
                    className="flex items-center justify-between p-3 rounded-lg bg-accent/50 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-semibold text-sm">
                        {area.rank}
                      </div>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: area.color }} />
                      <span className="font-medium">{area.nickname}</span>
                    </div>
                    <span className="text-muted-foreground text-sm">
                      {area.hits.toLocaleString()} hits
                    </span>
                  </div>
                )
              })}
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

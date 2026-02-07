"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Thermometer, Droplets, RefreshCw, CloudRain, Wind } from "lucide-react"

interface WeatherData {
  temperature: number | null
  humidity: number | null
  precipitation: string | null
  windSpeed: number | null
  baseDate: string
  baseTime: string
  location: {
    nx: number
    ny: number
  }
}

/**
 * 기상청 초단기실황 데이터를 표시하는 카드 컴포넌트
 * 온도와 습도를 표시하며, 10분마다 자동 갱신됩니다.
 */
export function WeatherCard() {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Prevent duplicate fetches (React Strict Mode, fast remounts)
  const isFetching = useRef(false)
  const hasFetched = useRef(false)

  const fetchWeather = useCallback(async (force = false) => {
    // Skip if already fetching or recently fetched (unless forced)
    if (isFetching.current) return
    if (!force && hasFetched.current) return

    isFetching.current = true

    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/weather')

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch weather')
      }

      const data: WeatherData = await response.json()
      setWeather(data)
      setLastUpdate(new Date())
      hasFetched.current = true
    } catch (err) {
      console.error('Weather fetch error:', err)
      setError(err instanceof Error ? err.message : '날씨 데이터를 불러올 수 없습니다')
    } finally {
      setLoading(false)
      isFetching.current = false
    }
  }, [])

  // Initial fetch and periodic refresh (every 10 minutes)
  useEffect(() => {
    fetchWeather()

    const interval = setInterval(() => {
      fetchWeather(true) // force refresh on interval
    }, 10 * 60 * 1000) // 10 minutes

    return () => clearInterval(interval)
  }, [fetchWeather])

  /**
   * 시간 포맷팅 (HHMM -> HH:MM)
   */
  const formatTime = (time: string) => {
    return `${time.slice(0, 2)}:${time.slice(2)}`
  }

  /**
   * 온도에 따른 색상 클래스
   */
  const getTemperatureColor = (temp: number | null) => {
    if (temp === null) return 'text-muted-foreground'
    if (temp <= 0) return 'text-blue-500'
    if (temp <= 10) return 'text-cyan-500'
    if (temp <= 20) return 'text-green-500'
    if (temp <= 30) return 'text-orange-500'
    return 'text-red-500'
  }

  /**
   * 습도에 따른 색상 클래스
   */
  const getHumidityColor = (humidity: number | null) => {
    if (humidity === null) return 'text-muted-foreground'
    if (humidity < 30) return 'text-yellow-500'
    if (humidity < 60) return 'text-green-500'
    return 'text-blue-500'
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">현재 날씨</CardTitle>
        <button
          onClick={() => fetchWeather(true)}
          disabled={loading}
          className="p-1 rounded hover:bg-accent transition-colors disabled:opacity-50"
          title="새로고침"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : loading && !weather ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : weather ? (
          <div className="space-y-3">
            {/* Temperature and Humidity Row */}
            <div className="flex items-center justify-around">
              {/* Temperature */}
              <div className="flex items-center gap-2">
                <Thermometer className={`h-5 w-5 ${getTemperatureColor(weather.temperature)}`} />
                <span className={`text-2xl font-bold ${getTemperatureColor(weather.temperature)}`}>
                  {weather.temperature !== null ? `${weather.temperature}°C` : '--'}
                </span>
              </div>

              {/* Humidity */}
              <div className="flex items-center gap-2">
                <Droplets className={`h-5 w-5 ${getHumidityColor(weather.humidity)}`} />
                <span className={`text-2xl font-bold ${getHumidityColor(weather.humidity)}`}>
                  {weather.humidity !== null ? `${weather.humidity}%` : '--'}
                </span>
              </div>
            </div>

            {/* Additional Info Row */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              {/* Precipitation */}
              {weather.precipitation && weather.precipitation !== '없음' && (
                <div className="flex items-center gap-1">
                  <CloudRain className="h-4 w-4" />
                  <span>{weather.precipitation}</span>
                </div>
              )}

              {/* Wind Speed */}
              {weather.windSpeed !== null && (
                <div className="flex items-center gap-1">
                  <Wind className="h-4 w-4" />
                  <span>{weather.windSpeed}m/s</span>
                </div>
              )}
            </div>

            {/* Update Time */}
            <div className="text-xs text-muted-foreground text-right">
              {weather.baseDate && weather.baseTime && (
                <span>기준: {formatTime(weather.baseTime)}</span>
              )}
              {lastUpdate && (
                <span className="ml-2">
                  (갱신: {lastUpdate.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })})
                </span>
              )}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

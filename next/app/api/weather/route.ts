/**
 * 기상청 초단기실황조회 API Route
 *
 * 기상청 OpenAPI를 통해 현재 기온과 습도를 조회합니다.
 * API 키를 서버 측에서 처리하여 클라이언트에 노출되지 않도록 합니다.
 */

import { NextResponse } from 'next/server'

// 초단기실황조회 API 엔드포인트
const KMA_API_URL = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst'

interface KMAResponse {
  response: {
    header: {
      resultCode: string
      resultMsg: string
    }
    body?: {
      dataType: string
      items: {
        item: Array<{
          baseDate: string
          baseTime: string
          category: string
          nx: number
          ny: number
          obsrValue: string
        }>
      }
      numOfRows: number
      pageNo: number
      totalCount: number
    }
  }
}

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

// 서버 측 메모리 캐시 (429 에러 방지)
const CACHE_DURATION_MS = 10 * 60 * 1000 // 10분
let cachedData: { data: WeatherData; timestamp: number } | null = null

/**
 * 현재 시간 기준 base_time 계산
 * 초단기실황은 매시 40분 이후 발표되므로, 현재 분이 40분 미만이면 1시간 전 데이터 사용
 */
function getBaseDateTime(): { baseDate: string; baseTime: string } {
  const now = new Date()

  // 40분 이전이면 1시간 전 데이터 사용
  if (now.getMinutes() < 40) {
    now.setHours(now.getHours() - 1)
  }

  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')

  return {
    baseDate: `${year}${month}${day}`,
    baseTime: `${hour}00`
  }
}

/**
 * 강수형태 코드를 문자열로 변환
 */
function getPrecipitationType(code: string): string {
  const types: Record<string, string> = {
    '0': '없음',
    '1': '비',
    '2': '비/눈',
    '3': '눈',
    '4': '소나기',
    '5': '빗방울',
    '6': '빗방울눈날림',
    '7': '눈날림'
  }
  return types[code] || '알 수 없음'
}

export async function GET() {
  try {
    // 캐시된 데이터가 있고 유효하면 바로 반환
    const now = Date.now()
    if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION_MS) {
      console.log('Weather API: returning cached data')
      return NextResponse.json(cachedData.data)
    }

    const serviceKey = process.env.KMA_API_KEY
    const nx = process.env.KMA_NX || '60'  // 기본값: 서울
    const ny = process.env.KMA_NY || '127'

    if (!serviceKey) {
      return NextResponse.json(
        { error: 'KMA_API_KEY is not configured' },
        { status: 500 }
      )
    }

    const { baseDate, baseTime } = getBaseDateTime()

    // API 요청 URL 구성
    const params = new URLSearchParams({
      serviceKey: serviceKey,
      numOfRows: '10',
      pageNo: '1',
      dataType: 'JSON',
      base_date: baseDate,
      base_time: baseTime,
      nx: nx,
      ny: ny
    })

    console.log('Weather API: fetching from KMA API')
    const response = await fetch(`${KMA_API_URL}?${params.toString()}`, {
      cache: 'no-store' // 서버 측 캐시를 직접 관리하므로 fetch 캐시 비활성화
    })

    if (!response.ok) {
      // 429 에러 시 캐시된 데이터가 있으면 반환
      if (response.status === 429 && cachedData) {
        console.log('Weather API: 429 error, returning stale cached data')
        return NextResponse.json(cachedData.data)
      }
      throw new Error(`KMA API request failed: ${response.status}`)
    }

    const data: KMAResponse = await response.json()

    // API 응답 검증
    if (data.response.header.resultCode !== '00') {
      throw new Error(`KMA API error: ${data.response.header.resultMsg}`)
    }

    if (!data.response.body?.items?.item) {
      throw new Error('No weather data available')
    }

    // 데이터 파싱
    const items = data.response.body.items.item
    const weatherData: WeatherData = {
      temperature: null,
      humidity: null,
      precipitation: null,
      windSpeed: null,
      baseDate,
      baseTime,
      location: {
        nx: parseInt(nx),
        ny: parseInt(ny)
      }
    }

    items.forEach((item) => {
      switch (item.category) {
        case 'T1H': // 기온
          weatherData.temperature = parseFloat(item.obsrValue)
          break
        case 'REH': // 습도
          weatherData.humidity = parseFloat(item.obsrValue)
          break
        case 'PTY': // 강수형태
          weatherData.precipitation = getPrecipitationType(item.obsrValue)
          break
        case 'WSD': // 풍속
          weatherData.windSpeed = parseFloat(item.obsrValue)
          break
      }
    })

    // 캐시 업데이트
    cachedData = { data: weatherData, timestamp: Date.now() }
    console.log('Weather API: cached new data')

    return NextResponse.json(weatherData)

  } catch (error) {
    console.error('Weather API error:', error)

    // 에러 시에도 캐시된 데이터가 있으면 반환 (graceful degradation)
    if (cachedData) {
      console.log('Weather API: error occurred, returning stale cached data')
      return NextResponse.json(cachedData.data)
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch weather data' },
      { status: 500 }
    )
  }
}

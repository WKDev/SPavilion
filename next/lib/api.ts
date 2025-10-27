/**
 * API 클라이언트
 * NestJS 백엔드와 통신하기 위한 API 함수들
 */

import type {
  Device,
  DeviceId,
  GetDevicesResponse,
  DeviceControlRequest,
  DeviceControlResponse,
  HeatmapQueryParams,
  HeatmapResponse,
  HeatmapData,
  HistogramData,
  ApiError,
} from "./types"
import { toApiDeviceKind, toUiDeviceId, DEVICE_NAMES } from "./device-mapper"

// API Base URL (환경 변수에서 로드)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api"

/**
 * API 에러 처리 헬퍼
 */
class ApiClientError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public error?: string
  ) {
    super(message)
    this.name = "ApiClientError"
  }
}

/**
 * Fetch 래퍼 - 에러 핸들링 포함
 */
async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${endpoint}`

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    })

    // HTTP 에러 처리
    if (!response.ok) {
      const errorData: ApiError = await response.json().catch(() => ({
        message: `HTTP ${response.status}: ${response.statusText}`,
      }))

      throw new ApiClientError(
        response.status,
        errorData.message || "API 요청 실패",
        errorData.error
      )
    }

    return await response.json()
  } catch (error) {
    // 네트워크 에러 또는 이미 ApiClientError인 경우
    if (error instanceof ApiClientError) {
      throw error
    }

    // 네트워크 에러
    throw new ApiClientError(
      0,
      `네트워크 에러: ${error instanceof Error ? error.message : "알 수 없는 에러"}`
    )
  }
}

// ========================================
// Device API (장치 관련 API)
// ========================================

/**
 * GET /api/devices
 * 현재 장치 상태 조회
 *
 * @returns 장치 목록 및 연결 상태
 * @throws {ApiClientError} API 호출 실패 시
 */
export async function getDevices(): Promise<Device[]> {
  const response = await fetchApi<GetDevicesResponse>("/devices")

  // API 응답을 UI 포맷으로 변환
  const devices: Device[] = Object.entries(response.devices).map(
    ([kind, isOn]) => {
      const deviceId = toUiDeviceId(kind as any)
      return {
        id: deviceId,
        name: DEVICE_NAMES[deviceId],
        status: response.connected ? "online" : "offline",
        isOn,
        progress: 0, // 진행률은 클라이언트에서 계산 (타이머 기반)
      }
    }
  )

  return devices
}

/**
 * POST /api/devices/control
 * 장치 제어 (토글, ON, OFF)
 *
 * @param deviceId - UI 장치 ID (예: "light-red")
 * @param action - 제어 명령 ("toggle" | "on" | "off")
 * @throws {ApiClientError} API 호출 실패 시
 */
export async function controlDevice(
  deviceId: DeviceId,
  action: "toggle" | "on" | "off"
): Promise<void> {
  const requestBody: DeviceControlRequest = {
    device_kind: toApiDeviceKind(deviceId),
    action,
  }

  await fetchApi<DeviceControlResponse>("/devices/control", {
    method: "POST",
    body: JSON.stringify(requestBody),
  })
}

// ========================================
// Heatmap API (히트맵 데이터)
// ========================================

/**
 * GET /api/heatmap
 * 히트맵 데이터 조회 (시간 범위 지정)
 *
 * @param timeRange - 시간 범위 (선택적)
 * @param timeRange.from - 시작 시간 (ISO8601)
 * @param timeRange.to - 종료 시간 (ISO8601)
 * @returns 히트맵 데이터 포인트 배열
 * @throws {ApiClientError} API 호출 실패 시
 */
export async function getHeatmap(timeRange?: {
  from: Date
  to: Date
}): Promise<HeatmapData[]> {
  // 쿼리 파라미터 생성
  const params = new URLSearchParams()
  if (timeRange?.from) {
    params.append("from", timeRange.from.toISOString())
  }
  if (timeRange?.to) {
    params.append("to", timeRange.to.toISOString())
  }

  const queryString = params.toString()
  const endpoint = `/heatmap${queryString ? `?${queryString}` : ""}`

  const response = await fetchApi<HeatmapResponse>(endpoint)

  // API 응답을 UI 히트맵 포맷으로 변환
  // gx, gy를 x, y 픽셀 좌표로 변환 (CELL_SIZE = 16 기준)
  const CELL_SIZE = 16
  const heatmapData: HeatmapData[] = response.data.map((point) => ({
    x: point.gx * CELL_SIZE,
    y: point.gy * CELL_SIZE,
    value: Number(point.hits),
  }))

  return heatmapData
}

/**
 * GET /api/heatmap (Usage History용)
 * 장치 사용 히스토리를 히스토그램 포맷으로 조회
 *
 * @param timeRange - 시간 범위
 * @returns 히스토그램 데이터 배열
 * @throws {ApiClientError} API 호출 실패 시
 *
 * DeviceUsage 테이블에서 ON 이벤트(rising edge)를 시간별로 집계하여 반환
 */
export async function getUsageHistory(timeRange: {
  from: Date
  to: Date
}): Promise<HistogramData[]> {
  const params = new URLSearchParams()
  params.append("from", timeRange.from.toISOString())
  params.append("to", timeRange.to.toISOString())

  const response = await fetchApi<{ success: boolean; data: HistogramData[] }>(
    `/devices/usage-history?${params.toString()}`
  )

  return response.data
}

// ========================================
// PLC Debug API (PLC 디버깅용)
// ========================================

/**
 * PLC Coil 데이터 조회 (주소 범위 지정)
 * @param start - 시작 주소 (기본값: 0)
 * @param count - 조회할 개수 (기본값: 100, 최대: 2000)
 * @returns Coil 배열과 메타데이터
 */
export async function getPLCCoils(
  start: number = 0,
  count: number = 100
): Promise<{ data: boolean[]; start: number; count: number }> {
  const params = new URLSearchParams()
  params.append('start', start.toString())
  params.append('count', count.toString())
  
  const response = await fetchApi<{ data: boolean[]; start: number; count: number }>(`/plc/coils?${params.toString()}`)
  return response
}

/**
 * PLC Coil 값 설정
 * @param address - Coil 주소 (0-999)
 * @param value - 설정할 값 (true/false)
 */
export async function setPLCCoil(
  address: number,
  value: boolean
): Promise<void> {
  await fetchApi<{ success: boolean; address: number; value: boolean }>(`/plc/coils/${address}`, {
    method: "POST",
    body: JSON.stringify({ value }),
  })
}

/**
 * PLC Register 데이터 조회 (주소 범위 지정)
 * @param start - 시작 주소 (기본값: 0)
 * @param count - 조회할 개수 (기본값: 100, 최대: 2000)
 * @returns Register 배열과 메타데이터
 */
export async function getPLCRegisters(
  start: number = 0,
  count: number = 100
): Promise<{ data: number[]; start: number; count: number }> {
  const params = new URLSearchParams()
  params.append('start', start.toString())
  params.append('count', count.toString())
  
  const response = await fetchApi<{ data: number[]; start: number; count: number }>(`/plc/registers?${params.toString()}`)
  return response
}

/**
 * PLC Register 값 설정
 * @param address - Register 주소 (0-999)
 * @param value - 설정할 값 (0-65535)
 */
export async function setPLCRegister(
  address: number,
  value: number
): Promise<void> {
  await fetchApi<{ success: boolean; address: number; value: number }>(`/plc/registers/${address}`, {
    method: "POST",
    body: JSON.stringify({ value }),
  })
}

// ========================================
// Export API Object (기존 코드 호환성)
// ========================================

/**
 * API 함수 객체 (기존 코드와 호환성 유지)
 */
export const api = {
  getDevices,
  controlDevice,
  getHeatmap,
  getUsageHistory,
  getPLCCoils,
  setPLCCoil,
  getPLCRegisters,
  setPLCRegister,
}

/**
 * Export ApiClientError for error handling
 */
export { ApiClientError }

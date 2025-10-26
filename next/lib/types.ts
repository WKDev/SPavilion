/**
 * API 타입 정의
 * NestJS 백엔드 API와 통신하기 위한 TypeScript 인터페이스
 */

// ========================================
// Device Types (장치 타입)
// ========================================

/**
 * 장치 종류 - NestJS Prisma enum과 일치
 */
export type DeviceKind =
  | "heat"
  | "fan"
  | "btsp"
  | "light_red"
  | "light_green"
  | "light_blue"
  | "light_white"
  | "display"

/**
 * UI에서 사용하는 장치 ID (하이픈 형식)
 */
export type DeviceId =
  | "heat"
  | "fan"
  | "btsp"
  | "light-red"
  | "light-green"
  | "light-blue"
  | "light-white"
  | "display"

/**
 * 장치 상태 (NestJS ModbusService.DeviceState)
 */
export interface DeviceState {
  heat: boolean
  fan: boolean
  btsp: boolean
  light_red: boolean
  light_green: boolean
  light_blue: boolean
  light_white: boolean
  display: boolean
}

/**
 * UI용 장치 정보
 */
export interface Device {
  id: DeviceId
  name: string
  status: "online" | "offline"
  isOn: boolean
  progress: number // 타이머 진행률 (0-100)
}

// ========================================
// API Request/Response Types
// ========================================

/**
 * GET /api/devices - 장치 상태 조회
 */
export interface GetDevicesResponse {
  connected: boolean
  devices: DeviceState
}

/**
 * POST /api/devices/control - 장치 제어
 */
export interface DeviceControlRequest {
  device_kind: DeviceKind
  action: "toggle" | "on" | "off"
}

export interface DeviceControlResponse {
  success: boolean
  message: string
}

/**
 * POST /api/devices/usage - 장치 사용 로그
 */
export interface DeviceUsageRequest {
  device_kind: DeviceKind
  action: string
  value?: boolean
}

export interface DeviceUsageResponse {
  success: boolean
  id: string | number
}

/**
 * GET /api/heatmap - 히트맵 데이터 조회
 */
export interface HeatmapQueryParams {
  from?: string // ISO8601 datetime
  to?: string // ISO8601 datetime
}

export interface HeatmapDataPoint {
  hourTs: string // ISO8601 datetime
  gx: number
  gy: number
  hits: number
}

export interface HeatmapResponse {
  from: string
  to: string
  data: HeatmapDataPoint[]
}

/**
 * POST /api/bbox_history - 바운딩 박스 히스토리
 */
export interface BboxHistoryRequest {
  bboxes: number[][] // [[x, y, w, h], ...]
  frame_count?: number
  camera_id?: string
}

export interface BboxHistoryResponse {
  success: boolean
  id: string | number
}

// ========================================
// UI Data Types
// ========================================

/**
 * 히트맵 시각화용 데이터
 */
export interface HeatmapData {
  x: number
  y: number
  value: number
}

/**
 * 히스토그램 시각화용 데이터
 */
export interface HistogramData {
  timestamp: string
  value: number
  device: string
}

// ========================================
// Error Types
// ========================================

/**
 * API 에러 응답
 */
export interface ApiError {
  message: string
  statusCode?: number
  error?: string
}

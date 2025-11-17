/**
 * Device ID 매핑 유틸리티
 *
 * UI에서 사용하는 하이픈 형식(light-red)과
 * 백엔드 API에서 사용하는 언더스코어 형식(light_red)을 상호 변환
 */

import { DeviceId, DeviceKind } from "./types"

/**
 * UI DeviceId를 API DeviceKind로 변환
 * @param deviceId - UI에서 사용하는 device ID (예: "light-red")
 * @returns API에서 사용하는 device kind (예: "light_red")
 *
 * @example
 * toApiDeviceKind("light-red") // "light_red"
 * toApiDeviceKind("heat") // "heat"
 */
export function toApiDeviceKind(deviceId: DeviceId): DeviceKind {
  return deviceId.replace(/-/g, "_") as DeviceKind
}

/**
 * API DeviceKind를 UI DeviceId로 변환
 * @param deviceKind - API에서 받은 device kind (예: "light_red")
 * @returns UI에서 사용하는 device ID (예: "light-red")
 *
 * @example
 * toUiDeviceId("light_red") // "light-red"
 * toUiDeviceId("heat") // "heat"
 */
export function toUiDeviceId(deviceKind: DeviceKind): DeviceId {
  return deviceKind.replace(/_/g, "-") as DeviceId
}

/**
 * 장치 이름 매핑 (표시용)
 */
export const DEVICE_NAMES: Record<DeviceId, string> = {
  heat: "Heat",
  fan: "Fan",
  btsp: "BTSP",
  "light-red": "Red Light",
  "light-green": "Green Light",
  "light-blue": "Blue Light",
  "light-white": "White Light",
  display: "Display",
}

/**
 * 타이머 기반 장치인지 확인
 * @param deviceId - 장치 ID
 * @returns 타이머 기반 장치 여부
 *
 * @description
 * - heat, fan: 10분 자동 꺼짐
 * - btsp, lights: 1시간 자동 꺼짐
 * - display: 수동 토글 (타이머 없음)
 */
export function isTimerDevice(deviceId: DeviceId): boolean {
  return deviceId !== "display"
}

/**
 * 장치의 타이머 시간(밀리초) 반환
 * @param deviceId - 장치 ID
 * @returns 타이머 시간 (밀리초), 타이머가 없으면 null
 */
export function getDeviceTimerDuration(deviceId: DeviceId): number | null {
  switch (deviceId) {
    case "heat":
    case "fan":
      return 10 * 60 * 1000 // 10분
    case "btsp":
    case "light-red":
    case "light-green":
    case "light-blue":
    case "light-white":
      return 60 * 60 * 1000 // 1시간
    case "display":
      return null // 타이머 없음
    default:
      return null
  }
}

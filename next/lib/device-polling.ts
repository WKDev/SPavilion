/**
 * Device Polling Service
 * 실시간 장치 상태 폴링 서비스
 *
 * NestJS 백엔드의 GET /api/devices를 주기적으로 호출하여
 * 장치 상태를 업데이트합니다.
 */

import { api } from "./api"
import type { Device } from "./types"

/**
 * 장치 폴링 서비스 클래스
 */
export class DevicePollingService {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private pollingInterval = 1000 // 1초 기본값 (NestJS는 100ms마다 PLC 폴링)

  /**
   * @param onUpdate - 장치 상태 업데이트 콜백
   * @param onError - 에러 발생 시 콜백 (선택적)
   */
  constructor(
    private onUpdate: (devices: Device[]) => void,
    private onError?: (error: Error) => void
  ) {}

  /**
   * 폴링 시작
   * @param interval - 폴링 간격 (밀리초, 기본값 1000ms)
   */
  start(interval = 1000) {
    if (this.isRunning) {
      console.warn("DevicePollingService: 이미 실행 중입니다.")
      return
    }

    this.pollingInterval = interval
    this.isRunning = true

    // 초기 데이터 조회
    this.poll()

    // 주기적 폴링 시작
    this.intervalId = setInterval(() => {
      this.poll()
    }, this.pollingInterval)

    console.log(`DevicePollingService: 폴링 시작 (${interval}ms 간격)`)
  }

  /**
   * 폴링 중지
   */
  stop() {
    if (!this.isRunning) {
      return
    }

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.isRunning = false
    console.log("DevicePollingService: 폴링 중지")
  }

  /**
   * 장치 상태 조회 (단일 폴링)
   */
  private async poll() {
    try {
      const devices = await api.getDevices()
      this.onUpdate(devices)
    } catch (error) {
      console.error("DevicePollingService: 폴링 에러", error)

      if (this.onError) {
        this.onError(error as Error)
      }
    }
  }

  /**
   * 폴링 활성 여부 확인
   */
  isActive(): boolean {
    return this.isRunning
  }

  /**
   * 폴링 간격 변경
   * @param interval - 새로운 폴링 간격 (밀리초)
   */
  setInterval(interval: number) {
    this.pollingInterval = interval

    if (this.isRunning) {
      // 재시작하여 새로운 간격 적용
      this.stop()
      this.start(interval)
    }
  }
}

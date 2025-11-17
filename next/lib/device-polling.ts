/**
 * Global Polling Service
 * 실시간 장치 및 PLC 상태 폴링 서비스
 *
 * NestJS 백엔드의 GET /api/plc/all-status 를 주기적으로 호출하여
 * 모든 관련 상태를 업데이트합니다.
 */

import { api, AllDeviceStatus } from "./api"

const DEFAULT_POLLING_INTERVAL_MS = 25; // 기본 폴링 간격을 1000ms로 변경

/**
 * 글로벌 폴링 서비스 클래스
 */
export class GlobalPollingService {
  private timeoutId: NodeJS.Timeout | null = null; // intervalId -> timeoutId
  private isRunning = false
  private pollingInterval = DEFAULT_POLLING_INTERVAL_MS; // 기본값 사용
  private coilRange = { start: 0, count: 40 }
  private registerRange = { start: 0, count: 40 }

  /**
   * @param onUpdate - 상태 업데이트 콜백
   * @param onError - 에러 발생 시 콜백 (선택적)
   */
  constructor(
    private onUpdate: (status: AllDeviceStatus, coilStart: number, registerStart: number) => void,
    private onError?: (error: Error) => void
  ) {}

  /**
   * 폴링 시작
   * @param interval - 폴링 간격 (밀리초, 기본값 1000ms)
   */
  start(interval = DEFAULT_POLLING_INTERVAL_MS) {
    if (this.isRunning) {
      // 이미 실행 중이면 간격만 업데이트할 수 있도록 처리
      if (this.pollingInterval !== interval) {
        this.setInterval(interval)
      }
      return
    }

    this.pollingInterval = interval
    this.isRunning = true

    // 즉시 첫 폴링 시작
    this.poll();

    console.log(`GlobalPollingService: 폴링 시작 (${interval}ms 간격)`)
  }

  /**
   * 폴링 중지
   */
  stop() {
    if (!this.isRunning) {
      return
    }

    if (this.timeoutId) {
      clearTimeout(this.timeoutId); // clearInterval -> clearTimeout
      this.timeoutId = null
    }

    this.isRunning = false
    console.log("GlobalPollingService: 폴링 중지")
  }

  /**
   * 상태 조회 (단일 폴링)
   */
  private async poll() {
    if (!this.isRunning) {
      return;
    }
    
    try {
      const status = await api.getPLCAllStatus(this.coilRange, this.registerRange)
      // console.log("GlobalPollingService: Polled PLC Status", status); // 너무 자주 로깅되므로 주석 처리 권장
      this.onUpdate(status, this.coilRange.start, this.registerRange.start)
    } catch (error) {
      console.error("GlobalPollingService: 폴링 에러", error)

      if (this.onError) {
        this.onError(error as Error)
      }
    } finally {
      // 이전 요청이 완료된 후, 다음 폴링을 스케줄링
      if (this.isRunning) {
        this.timeoutId = setTimeout(() => this.poll(), this.pollingInterval);
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

  // Public methods to allow runtime range changes from components like PLCDebug
  setCoilRange(start: number, count: number) {
    this.coilRange = { start, count };
    // No need to poll immediately, background polling will handle it.
    // Instead, we notify the backend of the new range.
    api.updatePollingRanges({ coilStart: start, coilCount: count }).catch(err => {
      console.error("Failed to update coil polling range:", err);
      // Optionally handle the error in the UI
    });
  }

  setRegisterRange(start: number, count: number){
    this.registerRange = { start, count };
    // No need to poll immediately, background polling will handle it.
    // Instead, we notify the backend of the new range.
    api.updatePollingRanges({ registerStart: start, registerCount: count }).catch(err => {
      console.error("Failed to update register polling range:", err);
      // Optionally handle the error in the UI
    });
  }
}

// Real-time PLC polling service

import { api } from "./api"

export class PLCPollingService {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private pollingInterval = 1000 // 1 second default
  private coilRange = { start: 0, count: 100 }
  private registerRange = { start: 0, count: 100 }
  private momentarySwitchQueue: Set<string> = new Set() // Track momentary switches in progress

  constructor(
    private onUpdate: (coils: boolean[], registers: number[], coilRange: { start: number; count: number }, registerRange: { start: number; count: number }) => void
  ) {}

  start(interval = 1000) {
    if (this.isRunning) {
      return
    }

    this.pollingInterval = interval
    this.isRunning = true

    // Initial fetch
    this.poll()

    // Set up interval
    this.intervalId = setInterval(() => {
      this.poll()
    }, this.pollingInterval)
  }

  stop() {
    if (!this.isRunning) {
      return
    }

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.isRunning = false
  }

  setCoilRange(start: number, count: number) {
    this.coilRange = { start, count }
  }

  setRegisterRange(start: number, count: number) {
    this.registerRange = { start, count }
  }

  private async poll() {
    try {
      const [coilResponse, registerResponse] = await Promise.all([
        api.getPLCCoils(this.coilRange.start, this.coilRange.count),
        api.getPLCRegisters(this.registerRange.start, this.registerRange.count)
      ])

      this.onUpdate(
        coilResponse.data, 
        registerResponse.data,
        this.coilRange,
        this.registerRange
      )
    } catch (error) {
      // In production, this would log to a monitoring service
      console.error('PLC polling error:', error)
    }
  }

  isActive(): boolean {
    return this.isRunning
  }

  setInterval(interval: number) {
    this.pollingInterval = interval
    if (this.isRunning) {
      this.stop()
      this.start(interval)
    }
  }

  /**
   * Execute momentary switch for rising edge detection
   * Sends momentary pulse: true immediately, then false after 100ms
   * @param deviceKind - Device kind (heat, fan, btsp, light_red, light_green, light_blue, light_white, display)
   */
  async momentarySwitch(deviceKind: string): Promise<void> {
    // Prevent duplicate momentary switches for the same device
    if (this.momentarySwitchQueue.has(deviceKind)) {
      console.warn(`Momentary switch for ${deviceKind} already in progress, skipping`)
      return
    }

    this.momentarySwitchQueue.add(deviceKind)

    try {
      console.log(`[PLCPolling] Executing momentary switch for ${deviceKind}`)
      await api.momentarySwitch(deviceKind)
      console.log(`[PLCPolling] Momentary switch completed for ${deviceKind}`)
    } catch (error) {
      console.error(`[PLCPolling] Momentary switch failed for ${deviceKind}:`, error)
      throw error
    } finally {
      // Remove from queue after completion
      this.momentarySwitchQueue.delete(deviceKind)
    }
  }

  /**
   * Check if momentary switch is in progress for a device
   * @param deviceKind - Device kind to check
   * @returns true if momentary switch is in progress
   */
  isMomentarySwitchInProgress(deviceKind: string): boolean {
    return this.momentarySwitchQueue.has(deviceKind)
  }
}

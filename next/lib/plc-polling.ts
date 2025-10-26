// Real-time PLC polling service

import { api } from "./api"

export class PLCPollingService {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private pollingInterval = 1000 // 1 second default
  private coilRange = { start: 0, count: 100 }
  private registerRange = { start: 0, count: 100 }

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
}

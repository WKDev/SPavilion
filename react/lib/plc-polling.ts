// Real-time PLC polling service

import { api } from "./api"

export class PLCPollingService {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private pollingInterval = 1000 // 1 second default

  constructor(private onUpdate: (coils: boolean[], registers: number[]) => void) {}

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

  private async poll() {
    try {
      const [coils, registers] = await Promise.all([api.getPLCCoils(), api.getPLCRegisters()])

      this.onUpdate(coils, registers)
    } catch (error) {
      // In production, this would log to a monitoring service
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

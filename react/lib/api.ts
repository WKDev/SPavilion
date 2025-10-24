const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api"

const MOCK_DEVICES: Device[] = [
  { id: "heat", name: "Heat", status: "online", isOn: true, progress: 45 },
  { id: "fan", name: "Fan", status: "online", isOn: false, progress: 0 },
  { id: "btsp", name: "BTSP", status: "online", isOn: true, progress: 78 },
  { id: "light-red", name: "Red Light", status: "online", isOn: false, progress: 0 },
  { id: "light-green", name: "Green Light", status: "online", isOn: true, progress: 92 },
  { id: "light-blue", name: "Blue Light", status: "offline", isOn: false, progress: 0 },
  { id: "light-white", name: "White Light", status: "online", isOn: true, progress: 63 },
]

const MOCK_HEATMAP: HeatmapData[] = Array.from({ length: 100 }, (_, i) => ({
  x: (i % 10) * 10,
  y: Math.floor(i / 10) * 10,
  value: Math.random() * 100,
}))

const MOCK_HISTOGRAM: HistogramData[] = Array.from({ length: 24 }, (_, i) => {
  const timestamp = new Date(Date.now() - (23 - i) * 3600000).toISOString()
  return [
    { timestamp, value: Math.random() * 100, device: "heat" },
    { timestamp, value: Math.random() * 80, device: "fan" },
    { timestamp, value: Math.random() * 60, device: "btsp" },
  ]
}).flat()

const MOCK_COILS = Array.from({ length: 1000 }, () => Math.random() > 0.5)
const MOCK_REGISTERS = Array.from({ length: 1000 }, () => Math.floor(Math.random() * 65536))

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface Device {
  id: string
  name: string
  status: "online" | "offline"
  isOn: boolean
  progress: number
}

export interface HeatmapData {
  x: number
  y: number
  value: number
}

export interface HistogramData {
  timestamp: string
  value: number
  device: string
}

export const api = {
  async getDevices(): Promise<Device[]> {
    await delay(300)
    return MOCK_DEVICES
  },

  async controlDevice(deviceId: string, command: "on" | "off"): Promise<void> {
    await delay(200)
    const device = MOCK_DEVICES.find((d) => d.id === deviceId)
    if (device) {
      device.isOn = command === "on"
    }
  },

  async getHeatmap(timeRange?: { from: Date; to: Date }): Promise<HeatmapData[]> {
    await delay(300)
    return MOCK_HEATMAP
  },

  async getUsageHistory(timeRange: { from: Date; to: Date }): Promise<HistogramData[]> {
    await delay(300)
    return MOCK_HISTOGRAM
  },

  async getPLCCoils(): Promise<boolean[]> {
    await delay(200)
    return MOCK_COILS
  },

  async setPLCCoil(address: number, value: boolean): Promise<void> {
    await delay(200)
    MOCK_COILS[address] = value
  },

  async getPLCRegisters(): Promise<number[]> {
    await delay(200)
    return MOCK_REGISTERS
  },

  async setPLCRegister(address: number, value: number): Promise<void> {
    await delay(200)
    MOCK_REGISTERS[address] = value
  },
}

import { create } from "zustand"
import { persist } from "zustand/middleware"

export interface DeviceState {
  heat: { isOn: boolean; progress: number }
  fan: { isOn: boolean; progress: number }
  btsp: { isOn: boolean; progress: number }
  "light-red": { isOn: boolean; progress: number }
  "light-green": { isOn: boolean; progress: number }
  "light-blue": { isOn: boolean; progress: number }
  "light-white": { isOn: boolean; progress: number }
}

export interface AreaBox {
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface CameraArea {
  nickname: string
  box: AreaBox[]
  colorCode: number // Kept for backwards compatibility, use color instead
  color: string // RGB hex value (e.g., "#ef4444")
  enabled: boolean
  visible: boolean
}

export interface PLCState {
  coils: boolean[]
  registers: number[]
}

export type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d" | "custom"

export interface TimeRangeState {
  selectedRange: TimeRange
  fromDate: Date
  toDate: Date
  fromTime: string
  toTime: string
  customRangeLabel: string
}

interface AppState {
  devices: DeviceState
  plc: PLCState
  isPolling: boolean
  timeRange: TimeRangeState
  updateDevice: (device: keyof DeviceState, state: { isOn: boolean; progress: number }) => void
  updateCoil: (index: number, value: boolean) => void
  updateRegister: (index: number, value: number) => void
  setPolling: (polling: boolean) => void
  setTimeRange: (range: TimeRange) => void
  setCustomTimeRange: (from: Date, to: Date, fromTime: string, toTime: string, label: string) => void
}

export const useStore = create<AppState>((set) => {
  // Initialize with last 24 hours as default
  const now = new Date()
  const from = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  return {
    devices: {
      heat: { isOn: false, progress: 0 },
      fan: { isOn: false, progress: 0 },
      btsp: { isOn: false, progress: 0 },
      "light-red": { isOn: false, progress: 0 },
      "light-green": { isOn: false, progress: 0 },
      "light-blue": { isOn: false, progress: 0 },
      "light-white": { isOn: false, progress: 0 },
    },
    plc: {
      coils: Array.from({ length: 1000 }, () => false),
      registers: Array.from({ length: 1000 }, () => 0),
    },
    timeRange: {
      selectedRange: "24h",
      fromDate: from,
      toDate: now,
      fromTime: "00:00",
      toTime: "23:59",
      customRangeLabel: "",
    },

    isPolling: false,
    updateDevice: (device, state) =>
      set((prev) => ({
        devices: {
          ...prev.devices,
          [device]: state,
        },
      })),
    updateCoil: (index, value) =>
      set((prev) => {
        const newCoils = [...prev.plc.coils]
        newCoils[index] = value
        return { plc: { ...prev.plc, coils: newCoils } }
      }),
    updateRegister: (index, value) =>
      set((prev) => {
        const newRegisters = [...prev.plc.registers]
        newRegisters[index] = value
        return { plc: { ...prev.plc, registers: newRegisters } }
      }),
    setPolling: (polling) => set({ isPolling: polling }),
    setTimeRange: (range) => {
      const now = new Date()
      let from = new Date()
      let fromTime = "00:00"
      let toTime = "23:59"

      switch (range) {
        case "1h":
          from = new Date(now.getTime() - 60 * 60 * 1000)
          fromTime = `${String(from.getHours()).padStart(2, '0')}:${String(from.getMinutes()).padStart(2, '0')}`
          toTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
          break
        case "6h":
          from = new Date(now.getTime() - 6 * 60 * 60 * 1000)
          fromTime = `${String(from.getHours()).padStart(2, '0')}:${String(from.getMinutes()).padStart(2, '0')}`
          toTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
          break
        case "24h":
          from = new Date(now)
          from.setHours(0, 0, 0, 0) // Set to midnight today
          fromTime = "00:00"
          toTime = "23:59"
          break
        case "7d":
          from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
          fromTime = "00:00"
          toTime = "23:59"
          break
        case "30d":
          from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          fromTime = "00:00"
          toTime = "23:59"
          break
        case "custom":
          // Don't update dates for custom range (handled by setCustomTimeRange)
          set((prev) => ({
            timeRange: {
              ...prev.timeRange,
              selectedRange: range,
            },
          }))
          return
      }

      set((prev) => ({
        timeRange: {
          ...prev.timeRange,
          selectedRange: range,
          fromDate: from,
          toDate: now,
          fromTime,
          toTime,
          customRangeLabel: "",
        },
      }))
    },
    setCustomTimeRange: (from, to, fromTime, toTime, label) =>
      set((prev) => ({
        timeRange: {
          ...prev.timeRange,
          selectedRange: "custom",
          fromDate: from,
          toDate: to,
          fromTime,
          toTime,
          customRangeLabel: label,
        },
      })),
  }
})

interface CameraAreaState {
  areas: CameraArea[]
  addArea: (area: CameraArea) => void
  updateArea: (index: number, area: CameraArea) => void
  removeArea: (index: number) => void
}

export const useCameraAreaStore = create<CameraAreaState>()(
  persist(
    (set) => ({
      areas: [],
      addArea: (area) =>
        set((state) => ({
          areas: [...state.areas, area],
        })),
      updateArea: (index, area) =>
        set((state) => ({
          areas: state.areas.map((a, i) => (i === index ? area : a)),
        })),
      removeArea: (index) =>
        set((state) => ({
          areas: state.areas.filter((_, i) => i !== index),
        })),
    }),
    {
      name: "camera-area-storage",
    }
  )
)

// Shortcut interface for custom PLC buttons
export interface Shortcut {
  id: string
  buttonTitle: string
  stateType: "coil" | "register"
  statusAddr: number  // Address to read current state from (e.g., 0x00-0x07)
  commandAddr: number // Address to write commands to (e.g., 0x10-0x17)
  stateValue: number  // Max value for timer (used for register type)
}

interface ShortcutState {
  shortcuts: Shortcut[]
  addShortcut: (shortcut: Omit<Shortcut, "id">) => void
  updateShortcut: (id: string, shortcut: Omit<Shortcut, "id">) => void
  removeShortcut: (id: string) => void
}

export const useShortcutStore = create<ShortcutState>()(
  persist(
    (set) => ({
      shortcuts: [],
      addShortcut: (shortcut) =>
        set((state) => ({
          shortcuts: [
            ...state.shortcuts,
            { ...shortcut, id: `shortcut-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` },
          ],
        })),
      updateShortcut: (id, shortcut) =>
        set((state) => ({
          shortcuts: state.shortcuts.map((s) => (s.id === id ? { ...shortcut, id } : s)),
        })),
      removeShortcut: (id) =>
        set((state) => ({
          shortcuts: state.shortcuts.filter((s) => s.id !== id),
        })),
    }),
    {
      name: "shortcut-storage",
    }
  )
)

// DevMan Button interface for custom device control buttons
export interface DevManButton {
  id: string
  buttonTitle: string
  deviceKey?: keyof DeviceState // For legacy device state (heat, fan, etc.)
  stateType: "legacy" | "coil" | "register"
  statusAddr?: number  // Address to read current state from (for coil/register types)
  commandAddr?: number // Address to write commands to (for coil/register types)
  stateValue?: number  // Max value for timer (used for register type)
}

interface DevManButtonState {
  buttons: DevManButton[]
  addButton: (button: Omit<DevManButton, "id">) => void
  updateButton: (id: string, button: Omit<DevManButton, "id">) => void
  removeButton: (id: string) => void
}

export const useDevManButtonStore = create<DevManButtonState>()(
  persist(
    (set) => ({
      buttons: [],
      addButton: (button) =>
        set((state) => ({
          buttons: [
            ...state.buttons,
            { ...button, id: `devman-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` },
          ],
        })),
      updateButton: (id, button) =>
        set((state) => ({
          buttons: state.buttons.map((b) => (b.id === id ? { ...button, id } : b)),
        })),
      removeButton: (id) =>
        set((state) => ({
          buttons: state.buttons.filter((b) => b.id !== id),
        })),
    }),
    {
      name: "devman-button-storage",
    }
  )
)

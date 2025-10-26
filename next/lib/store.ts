import { create } from "zustand"

export interface DeviceState {
  heat: { isOn: boolean; progress: number }
  fan: { isOn: boolean; progress: number }
  btsp: { isOn: boolean; progress: number }
  "light-red": { isOn: boolean; progress: number }
  "light-green": { isOn: boolean; progress: number }
  "light-blue": { isOn: boolean; progress: number }
  "light-white": { isOn: boolean; progress: number }
}

export interface PLCState {
  coils: boolean[]
  registers: number[]
}

interface AppState {
  devices: DeviceState
  plc: PLCState
  isPolling: boolean
  updateDevice: (device: keyof DeviceState, state: { isOn: boolean; progress: number }) => void
  updateCoil: (index: number, value: boolean) => void
  updateRegister: (index: number, value: number) => void
  setPolling: (polling: boolean) => void
}

export const useStore = create<AppState>((set) => ({
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
}))

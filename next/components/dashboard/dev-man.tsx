"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TMButton } from "@/components/device/tm-button"
import { useStore } from "@/lib/store"
import { api, ApiClientError } from "@/lib/api"

export function DevMan() {
  const { devices, updateDevice } = useStore()

  /**
   * 장치 토글 핸들러
   * API 호출 (NestJS → Modbus → PLC)
   */
  const handleToggle = async (deviceKey: keyof typeof devices) => {
    const device = devices[deviceKey]
    const newState = !device.isOn

    // Optimistic update (즉각적인 UI 반영)
    updateDevice(deviceKey, { ...device, isOn: newState })

    // API 호출: POST /api/devices/control
    try {
      await api.controlDevice(deviceKey, newState ? "on" : "off")
    } catch (error) {
      // 에러 발생 시 이전 상태로 복원
      updateDevice(deviceKey, device)

      // 에러 로깅
      if (error instanceof ApiClientError) {
        console.error(`장치 제어 실패 [${error.statusCode}]:`, error.message)
      } else {
        console.error("장치 제어 실패:", error)
      }

      // TODO: Toast 메시지로 사용자에게 알림
      // toast.error(`${deviceKey} 제어 실패`)
    }
  }

  return (
    <Card className="h-[400px] flex flex-col">
      <CardHeader>
        <CardTitle>Device Control</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 overflow-y-auto">
        <TMButton
          title="Heat"
          isOn={devices.heat.isOn}
          progress={devices.heat.progress}
          onToggle={() => handleToggle("heat")}
        />
        <TMButton
          title="Fan"
          isOn={devices.fan.isOn}
          progress={devices.fan.progress}
          onToggle={() => handleToggle("fan")}
        />
        <TMButton
          title="BTSP"
          isOn={devices.btsp.isOn}
          progress={devices.btsp.progress}
          onToggle={() => handleToggle("btsp")}
        />
        <TMButton
          title="Red Light"
          isOn={devices["light-red"].isOn}
          progress={devices["light-red"].progress}
          onToggle={() => handleToggle("light-red")}
        />
        <TMButton
          title="Green Light"
          isOn={devices["light-green"].isOn}
          progress={devices["light-green"].progress}
          onToggle={() => handleToggle("light-green")}
        />
        <TMButton
          title="Blue Light"
          isOn={devices["light-blue"].isOn}
          progress={devices["light-blue"].progress}
          onToggle={() => handleToggle("light-blue")}
        />
        <TMButton
          title="White Light"
          isOn={devices["light-white"].isOn}
          progress={devices["light-white"].progress}
          onToggle={() => handleToggle("light-white")}
        />
      </CardContent>
    </Card>
  )
}

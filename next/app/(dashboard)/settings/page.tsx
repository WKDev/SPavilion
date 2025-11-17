"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PLCSettings } from "@/components/settings/plc-settings"
import { CameraSettings } from "@/components/settings/camera-settings"
import { GeneralSettings } from "@/components/settings/general-settings"
import { Settings, Camera, Database } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="space-y-3">

      <Tabs defaultValue="plc" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="general" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            일반
          </TabsTrigger>
          <TabsTrigger value="plc" className="flex items-center gap-2">
            
            <Settings className="h-4 w-4" />
            PLC 연결설정
          </TabsTrigger>
          <TabsTrigger value="camera" className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            카메라 감시범위 설정
          </TabsTrigger>

        </TabsList>

        <TabsContent value="general" className="mt-4">
          <GeneralSettings />
        </TabsContent>

        <TabsContent value="plc" className="mt-4">
          <PLCSettings />
        </TabsContent>

        <TabsContent value="camera" className="mt-4">
          <CameraSettings />
        </TabsContent>


      </Tabs>
    </div>
  )
}

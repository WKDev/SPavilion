"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PLCSettings } from "@/components/settings/plc-settings"
import { CameraSettings } from "@/components/settings/camera-settings"
import { GeneralSettings } from "@/components/settings/general-settings"
import { Settings, Camera, Database } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Configure your system preferences and monitor resources</p>
      </div>

      <Tabs defaultValue="plc" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="plc" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            PLC Settings
          </TabsTrigger>
          <TabsTrigger value="camera" className="flex items-center gap-2">
            <Camera className="h-4 w-4" />
            Camera Settings
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            General Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plc" className="mt-4">
          <PLCSettings />
        </TabsContent>

        <TabsContent value="camera" className="mt-4">
          <CameraSettings />
        </TabsContent>

        <TabsContent value="general" className="mt-4">
          <GeneralSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}

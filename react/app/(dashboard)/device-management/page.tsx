"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DeviceList } from "@/components/device/device-list"
import { PLCDebug } from "@/components/device/plc-debug"

export default function DeviceManagementPage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-3xl font-bold">Device Management</h1>
        <p className="text-muted-foreground">Manage and control your PLC devices</p>
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <DeviceList />
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <PLCDebug />
        </TabsContent>
      </Tabs>
    </div>
  )
}

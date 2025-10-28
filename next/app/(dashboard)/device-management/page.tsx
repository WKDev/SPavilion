"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ShortcutsManager } from "@/components/device/shortcuts-manager"
import { PLCDebug } from "@/components/device/plc-debug"

export default function DeviceManagementPage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-3xl font-bold">Device Management</h1>
        <p className="text-muted-foreground">Manage and control your PLC devices</p>
      </div>

      <Tabs defaultValue="shortcuts" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="shortcuts" className="space-y-4">
          <ShortcutsManager />
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <PLCDebug />
        </TabsContent>
      </Tabs>
    </div>
  )
}

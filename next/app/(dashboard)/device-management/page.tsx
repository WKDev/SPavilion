"use client"
import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ShortcutsDisplay } from "@/components/device/shortcuts-display"
import { ShortcutsManager } from "@/components/device/shortcuts-manager"
import { PLCDebug } from "@/components/device/plc-debug"
import { Settings } from "lucide-react"

export default function DeviceManagementPage() {

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-3xl font-bold">Device Management</h1>
        <p className="text-muted-foreground">Manage and control your PLC devices</p>
      </div>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="basic">기본</TabsTrigger>
          <TabsTrigger value="debug">세부 설정</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <ShortcutsDisplay />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="debug" className="space-y-4">
          <PLCDebug />
        </TabsContent>
      </Tabs>
    </div>
  )
}

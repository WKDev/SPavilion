"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, XCircle, Loader2, Cpu, HardDrive, MemoryStick, Database, Trash2, RefreshCw } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface SystemInfo {
  cpu: {
    usage: number
    cores: number
  }
  memory: {
    total: number
    used: number
    free: number
    percentage: number
  }
  disk: {
    total: number
    used: number
    free: number
    percentage: number
  }
}

interface TableStats {
  name: string
  displayName: string
  rowCount: number
  diskSize: number
  description: string
}

export function GeneralSettings() {
  // API Settings State
  const [apiUrl, setApiUrl] = useState(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api")
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null)

  // System Monitor State
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null)
  const [loadingSystem, setLoadingSystem] = useState(true)

  // Database Management State
  const [tableStats, setTableStats] = useState<TableStats[]>([])
  const [loadingDb, setLoadingDb] = useState(true)
  const [clearing, setClearing] = useState<string | null>(null)

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch(`${apiUrl}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      })

      if (response.ok) {
        setTestResult("success")
      } else {
        setTestResult("error")
      }
    } catch (error) {
      console.error("Connection test failed:", error)
      setTestResult("error")
    } finally {
      setTesting(false)
    }
  }

  const fetchSystemInfo = async () => {
    try {
      const response = await fetch("/api/system/info")
      if (response.ok) {
        const data = await response.json()
        setSystemInfo(data)
      }
    } catch (error) {
      console.error("Failed to fetch system info:", error)
    } finally {
      setLoadingSystem(false)
    }
  }

  const fetchTableStats = async () => {
    try {
      const response = await fetch("/api/database/stats")
      if (response.ok) {
        const data = await response.json()
        setTableStats(data.tables || [])
      }
    } catch (error) {
      console.error("Failed to fetch table stats:", error)
    } finally {
      setLoadingDb(false)
    }
  }

  useEffect(() => {
    fetchSystemInfo()
    fetchTableStats()

    const interval = setInterval(fetchSystemInfo, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleClearTable = async (tableName: string) => {
    setClearing(tableName)
    try {
      const response = await fetch(`/api/database/clear/${tableName}`, {
        method: "DELETE",
      })

      if (response.ok) {
        await fetchTableStats()
      } else {
        console.error("Failed to clear table:", tableName)
      }
    } catch (error) {
      console.error("Error clearing table:", error)
    } finally {
      setClearing(null)
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num)
  }

  return (
    <div className="space-y-6">
      {/* API Settings */}
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">API Configuration</h3>
          <p className="text-sm text-muted-foreground">Configure backend API endpoint for data management</p>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-url">API Base URL</Label>
            <Input
              id="api-url"
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="http://localhost:3000/api"
            />
            <p className="text-xs text-muted-foreground">Backend server API endpoint</p>
          </div>

          <Button
            variant="outline"
            className="w-full bg-transparent"
            onClick={handleTestConnection}
            disabled={testing}
          >
            {testing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing Connection...
              </>
            ) : (
              "Test Connection"
            )}
          </Button>

          {testResult && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg border ${
                testResult === "success"
                  ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-300"
                  : "bg-red-50 border-red-200 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-300"
              }`}
            >
              {testResult === "success" ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm">Connection successful</span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  <span className="text-sm">Connection failed</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* System Resources */}
      <div className="space-y-4 border-t pt-6">
        <div>
          <h3 className="text-lg font-medium">System Resources</h3>
          <p className="text-sm text-muted-foreground">Monitor CPU, memory, and disk usage</p>
        </div>

        {loadingSystem ? (
          <p className="text-sm text-muted-foreground">Loading system information...</p>
        ) : !systemInfo ? (
          <p className="text-sm text-muted-foreground">System information unavailable</p>
        ) : (
          <div className="space-y-6">
            {/* CPU Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">CPU Usage</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {systemInfo.cpu.usage.toFixed(1)}% ({systemInfo.cpu.cores} cores)
                </span>
              </div>
              <Progress value={systemInfo.cpu.usage} className="h-2" />
            </div>

            {/* Memory Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MemoryStick className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Memory Usage</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatBytes(systemInfo.memory.used)} / {formatBytes(systemInfo.memory.total)} (
                  {systemInfo.memory.percentage.toFixed(1)}%)
                </span>
              </div>
              <Progress value={systemInfo.memory.percentage} className="h-2" />
              <p className="text-xs text-muted-foreground">Free: {formatBytes(systemInfo.memory.free)}</p>
            </div>

            {/* Disk Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Disk Usage</span>
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatBytes(systemInfo.disk.used)} / {formatBytes(systemInfo.disk.total)} (
                  {systemInfo.disk.percentage.toFixed(1)}%)
                </span>
              </div>
              <Progress value={systemInfo.disk.percentage} className="h-2" />
              <p className="text-xs text-muted-foreground">Free: {formatBytes(systemInfo.disk.free)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Database Management */}
      <div className="space-y-4 border-t pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">Database Management</h3>
            <p className="text-sm text-muted-foreground">View and manage database disk usage</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchTableStats}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>

        {loadingDb ? (
          <p className="text-sm text-muted-foreground">Loading database statistics...</p>
        ) : tableStats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No database statistics available</p>
        ) : (
          <div className="space-y-3">
            {tableStats.map((table) => (
              <div
                key={table.name}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1">
                  <Database className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-medium">{table.displayName}</h4>
                      <span className="text-xs text-muted-foreground font-mono">({table.name})</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{table.description}</p>
                    <div className="flex gap-4 mt-2">
                      <div className="text-xs">
                        <span className="text-muted-foreground">Rows: </span>
                        <span className="font-medium">{formatNumber(table.rowCount)}</span>
                      </div>
                      <div className="text-xs">
                        <span className="text-muted-foreground">Size: </span>
                        <span className="font-medium">{formatBytes(table.diskSize)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      disabled={clearing === table.name}
                    >
                      {clearing === table.name ? (
                        <>
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Clearing...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Clear Data
                        </>
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear {table.displayName}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action will permanently delete all {formatNumber(table.rowCount)} rows from the{" "}
                        <strong>{table.name}</strong> table. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleClearTable(table.name)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Clear Data
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

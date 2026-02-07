'use client'

import { useCallback } from 'react'
import { useMidnightRefresh } from '@/hooks/use-midnight-refresh'
import { useStore } from '@/lib/store'
import { toast } from '@/hooks/use-toast'

interface MidnightRefreshProviderProps {
  children: React.ReactNode
}

/**
 * 자정에 날짜가 변경되면 자동으로 timeRange를 오늘로 갱신하는 Provider
 * 1분마다 날짜 변경을 체크하고, 변경 시 Toast 알림 표시 (10초 후 자동 닫힘)
 */
export function MidnightRefreshProvider({ children }: MidnightRefreshProviderProps) {
  const setTodayRange = useStore((state) => state.setTodayRange)

  const handleDateChange = useCallback(() => {
    // 오늘 범위로 갱신
    setTodayRange()

    // Toast 알림 표시 (10초 후 자동 닫힘)
    const { dismiss } = toast({
      title: '날짜가 변경되었습니다',
      description: '오늘 기준으로 데이터를 갱신했습니다.',
    })

    // 10초 후 자동 닫힘
    setTimeout(() => {
      dismiss()
    }, 10000)
  }, [setTodayRange])

  useMidnightRefresh(handleDateChange)

  return <>{children}</>
}

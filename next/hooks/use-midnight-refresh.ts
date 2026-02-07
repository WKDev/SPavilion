'use client'

import { useEffect, useRef, useCallback } from 'react'

/**
 * 1분마다 날짜 변경을 감지하는 훅
 * 마지막 체크 시점의 날짜와 현재 날짜가 다르면 콜백 실행
 */
export function useMidnightRefresh(onDateChange: () => void) {
  const lastDateRef = useRef<string>(getDateString(new Date()))
  const callbackRef = useRef(onDateChange)

  // 콜백이 변경되어도 interval을 재생성하지 않도록 ref 사용
  useEffect(() => {
    callbackRef.current = onDateChange
  }, [onDateChange])

  useEffect(() => {
    const checkDateChange = () => {
      const currentDate = getDateString(new Date())

      if (lastDateRef.current !== currentDate) {
        // 날짜가 변경됨
        lastDateRef.current = currentDate
        callbackRef.current()
      }
    }

    // 1분마다 체크
    const intervalId = setInterval(checkDateChange, 60 * 1000)

    return () => {
      clearInterval(intervalId)
    }
  }, [])
}

/**
 * Date 객체에서 YYYY-MM-DD 형식의 문자열 반환
 */
function getDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

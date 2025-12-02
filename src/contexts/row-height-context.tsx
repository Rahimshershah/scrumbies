'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type RowHeight = 'compact' | 'normal' | 'comfortable'

interface RowHeightContextType {
  rowHeight: RowHeight
  setRowHeight: (height: RowHeight) => void
  getRowHeightClass: () => string
}

const RowHeightContext = createContext<RowHeightContextType | undefined>(undefined)

const ROW_HEIGHT_CLASSES: Record<RowHeight, string> = {
  compact: 'py-1.5',      // 6px top/bottom = 12px total
  normal: 'py-2',         // 8px top/bottom = 16px total (current default)
  comfortable: 'py-3',    // 12px top/bottom = 24px total
}

export function RowHeightProvider({ children }: { children: ReactNode }) {
  const [rowHeight, setRowHeightState] = useState<RowHeight>('normal')

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('scrumbies_row_height') as RowHeight | null
    if (saved && ['compact', 'normal', 'comfortable'].includes(saved)) {
      setRowHeightState(saved)
    }
  }, [])

  const setRowHeight = (height: RowHeight) => {
    setRowHeightState(height)
    localStorage.setItem('scrumbies_row_height', height)
  }

  const getRowHeightClass = () => ROW_HEIGHT_CLASSES[rowHeight]

  return (
    <RowHeightContext.Provider value={{ rowHeight, setRowHeight, getRowHeightClass }}>
      {children}
    </RowHeightContext.Provider>
  )
}

export function useRowHeight() {
  const context = useContext(RowHeightContext)
  if (context === undefined) {
    throw new Error('useRowHeight must be used within a RowHeightProvider')
  }
  return context
}



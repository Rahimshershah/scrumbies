'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type RowHeight = 'compact' | 'normal' | 'comfortable'

interface RowHeightContextType {
  rowHeight: RowHeight
  setRowHeight: (height: RowHeight) => void
  getRowHeightClass: () => string
  getTextSize: (baseSize: 'xs' | 'sm' | 'base' | 'lg') => string
  getAvatarSize: (baseSize: number) => string
  getIconSize: (baseSize: number) => string
  getScale: () => number
}

const RowHeightContext = createContext<RowHeightContextType | undefined>(undefined)

const ROW_HEIGHT_CLASSES: Record<RowHeight, string> = {
  compact: 'py-1',        // 4px top/bottom = 8px total (reduced by ~50%)
  normal: 'py-2',         // 8px top/bottom = 16px total (default)
  comfortable: 'py-3',    // 12px top/bottom = 24px total
}

// Scale factors: compact reduces by 25% (0.75x), normal is 1x, comfortable increases by 20% (1.2x)
const SCALE_FACTORS: Record<RowHeight, number> = {
  compact: 0.75,      // 25% reduction (more than 20% requirement)
  normal: 1.0,
  comfortable: 1.2,
}

// Text size mappings
const TEXT_SIZE_MAP: Record<'xs' | 'sm' | 'base' | 'lg', Record<RowHeight, string>> = {
  xs: {
    compact: 'text-[10px]',    // ~20% smaller than text-xs (12px)
    normal: 'text-xs',         // 12px
    comfortable: 'text-xs',    // Keep same for xs
  },
  sm: {
    compact: 'text-[11px]',    // ~20% smaller than text-sm (14px)
    normal: 'text-sm',         // 14px
    comfortable: 'text-base',  // 16px
  },
  base: {
    compact: 'text-sm',        // 14px (reduced from 16px)
    normal: 'text-base',       // 16px
    comfortable: 'text-lg',    // 18px
  },
  lg: {
    compact: 'text-base',      // 16px (reduced from 18px)
    normal: 'text-lg',         // 18px
    comfortable: 'text-xl',   // 20px
  },
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

  const getTextSize = (baseSize: 'xs' | 'sm' | 'base' | 'lg') => {
    return TEXT_SIZE_MAP[baseSize][rowHeight]
  }

  const getAvatarSize = (baseSize: number) => {
    const scaled = Math.round(baseSize * SCALE_FACTORS[rowHeight])
    // Map common sizes to Tailwind classes
    const sizeMap: Record<number, string> = {
      3: 'w-3 h-3',
      4: 'w-4 h-4',
      5: 'w-5 h-5',
      6: 'w-6 h-6',
      7: 'w-7 h-7',
      8: 'w-8 h-8',
      9: 'w-9 h-9',
      10: 'w-10 h-10',
    }
    // Find closest match or use arbitrary value
    if (sizeMap[scaled]) {
      return sizeMap[scaled]
    }
    // Use arbitrary Tailwind value for non-standard sizes
    return `w-[${scaled * 0.25}rem] h-[${scaled * 0.25}rem]`
  }

  const getIconSize = (baseSize: number) => {
    const scaled = baseSize * SCALE_FACTORS[rowHeight]
    // Round to nearest 0.5 for Tailwind compatibility
    const rounded = Math.round(scaled * 2) / 2
    
    // Map common sizes to Tailwind classes
    if (rounded <= 2.5) return 'w-2.5 h-2.5'
    if (rounded <= 3) return 'w-3 h-3'
    if (rounded <= 3.5) return 'w-3.5 h-3.5'
    if (rounded <= 4) return 'w-4 h-4'
    if (rounded <= 5) return 'w-5 h-5'
    // Use arbitrary value for sizes outside standard Tailwind scale
    return `w-[${rounded * 0.25}rem] h-[${rounded * 0.25}rem]`
  }

  const getScale = () => SCALE_FACTORS[rowHeight]

  return (
    <RowHeightContext.Provider value={{ 
      rowHeight, 
      setRowHeight, 
      getRowHeightClass,
      getTextSize,
      getAvatarSize,
      getIconSize,
      getScale,
    }}>
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




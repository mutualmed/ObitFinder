import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

export const supabase = createBrowserClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    global: {
      fetch: (url, options = {}) => {
        // Add 15 second timeout to all fetch requests
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000)
        
        return fetch(url, {
          ...options,
          signal: controller.signal,
        }).finally(() => clearTimeout(timeoutId))
      }
    }
  }
)

// Helper function to wrap Supabase queries with timeout
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 10000
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Query timeout')), timeoutMs)
  })
  return Promise.race([promise, timeout])
}

// Pipeline stages
export const PIPELINE_STAGES = ['New', 'Attempted', 'In Progress', 'Scheduled', 'Won', 'Lost'] as const
export type PipelineStage = typeof PIPELINE_STAGES[number]

export const STAGE_CONFIG: Record<PipelineStage, { color: string; bgColor: string; icon: string }> = {
  'New': { color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200', icon: '🔵' },
  'Attempted': { color: 'text-yellow-600', bgColor: 'bg-yellow-50 border-yellow-200', icon: '🟡' },
  'In Progress': { color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200', icon: '🟠' },
  'Scheduled': { color: 'text-purple-600', bgColor: 'bg-purple-50 border-purple-200', icon: '📅' },
  'Won': { color: 'text-green-600', bgColor: 'bg-green-50 border-green-200', icon: '🟢' },
  'Lost': { color: 'text-red-600', bgColor: 'bg-red-50 border-red-200', icon: '🔴' },
}

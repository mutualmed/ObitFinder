import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient<Database>(supabaseUrl, supabaseKey)

// Pipeline stages
export const PIPELINE_STAGES = ['New', 'Attempted', 'In Progress', 'Won', 'Lost'] as const
export type PipelineStage = typeof PIPELINE_STAGES[number]

export const STAGE_CONFIG: Record<PipelineStage, { color: string; bgColor: string; icon: string }> = {
  'New': { color: 'text-blue-600', bgColor: 'bg-blue-50 border-blue-200', icon: '🔵' },
  'Attempted': { color: 'text-yellow-600', bgColor: 'bg-yellow-50 border-yellow-200', icon: '🟡' },
  'In Progress': { color: 'text-orange-600', bgColor: 'bg-orange-50 border-orange-200', icon: '🟠' },
  'Won': { color: 'text-green-600', bgColor: 'bg-green-50 border-green-200', icon: '🟢' },
  'Lost': { color: 'text-red-600', bgColor: 'bg-red-50 border-red-200', icon: '🔴' },
}

"use client"

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, UserCheck, Clock, Trophy, XCircle, TrendingUp, MapPin, Building } from 'lucide-react'
import { supabase, PIPELINE_STAGES, STAGE_CONFIG } from '@/lib/supabase'
import type { DashboardStats } from '@/lib/types'

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalCasos: 0,
    totalContatos: 0,
    byStatus: {},
    byCity: [],
    byState: [],
    recentActivity: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      // Total casos
      const { count: casosCount } = await supabase
        .from('casos')
        .select('*', { count: 'exact', head: true })

      // Total contatos
      const { count: contatosCount } = await supabase
        .from('contatos')
        .select('*', { count: 'exact', head: true })

      // Counts by status
      const byStatus: Record<string, number> = {}
      for (const stage of PIPELINE_STAGES) {
        const { count } = await supabase
          .from('contatos')
          .select('*', { count: 'exact', head: true })
          .eq('status', stage)
        byStatus[stage] = count || 0
      }

      // Top cities
      const { data: cityData } = await supabase
        .from('casos')
        .select('cidade')
        .not('cidade', 'is', null)
        .limit(1000)

      const cityCounts: Record<string, number> = {}
      cityData?.forEach(c => {
        if (c.cidade) {
          cityCounts[c.cidade] = (cityCounts[c.cidade] || 0) + 1
        }
      })
      const byCity = Object.entries(cityCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([city, count]) => ({ city, count }))

      // Top states
      const { data: stateData } = await supabase
        .from('casos')
        .select('estado')
        .not('estado', 'is', null)
        .limit(1000)

      const stateCounts: Record<string, number> = {}
      stateData?.forEach(s => {
        if (s.estado) {
          stateCounts[s.estado] = (stateCounts[s.estado] || 0) + 1
        }
      })
      const byState = Object.entries(stateCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([state, count]) => ({ state, count }))

      // Recent activity (last 7 days)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const { count: recentCount } = await supabase
        .from('contatos')
        .select('*', { count: 'exact', head: true })
        .gte('status_updated_at', weekAgo.toISOString())

      setStats({
        totalCasos: casosCount || 0,
        totalContatos: contatosCount || 0,
        byStatus,
        byCity,
        byState,
        recentActivity: recentCount || 0
      })
    } catch (err) {
      console.error('Error fetching stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const statusIcons: Record<string, any> = {
    'New': Users,
    'Attempted': Clock,
    'In Progress': TrendingUp,
    'Won': Trophy,
    'Lost': XCircle
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Falecidos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalCasos.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">Casos registrados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contatos</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalContatos.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">Familiares no pipeline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <Trophy className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.totalContatos > 0 
                ? ((stats.byStatus['Won'] || 0) / stats.totalContatos * 100).toFixed(1)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Ganhos do total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atividade Recente</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.recentActivity.toLocaleString('pt-BR')}</div>
            <p className="text-xs text-muted-foreground">Atualizações nos últimos 7 dias</p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Status Cards */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Pipeline por Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {PIPELINE_STAGES.map((stage) => {
            const Icon = statusIcons[stage] || Users
            const config = STAGE_CONFIG[stage]
            const count = stats.byStatus[stage] || 0
            const percentage = stats.totalContatos > 0 
              ? ((count / stats.totalContatos) * 100).toFixed(1) 
              : '0'

            return (
              <Card key={stage} className={`${config.bgColor} border`}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className={`text-sm font-medium ${config.color}`}>
                    {stage}
                  </CardTitle>
                  <Icon className={`h-4 w-4 ${config.color}`} />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${config.color}`}>
                    {count.toLocaleString('pt-BR')}
                  </div>
                  <p className="text-xs text-muted-foreground">{percentage}% do total</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Geographic Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Cities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Top 10 Cidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.byCity.map((item, index) => (
                <div key={item.city} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500 w-6">{index + 1}.</span>
                    <span className="text-sm font-medium truncate max-w-[200px]">{item.city}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-100 rounded-full h-2">
                      <div 
                        className="bg-blue-500 h-2 rounded-full" 
                        style={{ width: `${(item.count / stats.byCity[0]?.count) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-12 text-right">
                      {item.count.toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              ))}
              {stats.byCity.length === 0 && (
                <p className="text-gray-400 text-sm">Nenhum dado disponível</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top States */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Casos por Estado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.byState.map((item, index) => (
                <div key={item.state} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-500 w-6">{index + 1}.</span>
                    <span className="text-sm font-medium">{item.state}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-100 rounded-full h-2">
                      <div 
                        className="bg-green-500 h-2 rounded-full" 
                        style={{ width: `${(item.count / stats.byState[0]?.count) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-12 text-right">
                      {item.count.toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              ))}
              {stats.byState.length === 0 && (
                <p className="text-gray-400 text-sm">Nenhum dado disponível</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

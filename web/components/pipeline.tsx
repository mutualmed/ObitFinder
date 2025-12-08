"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ContactCard } from './contact-card'
import { ContactDetailModal } from './contact-detail'
import { FiltersPanel } from './filters'
import { supabase, PIPELINE_STAGES, STAGE_CONFIG, type PipelineStage } from '@/lib/supabase'
import type { ContactCard as ContactCardType, Filters } from '@/lib/types'
import { ChevronDown, RefreshCw } from 'lucide-react'

const CARDS_PER_LOAD = 15

export function Pipeline() {
  const [cardsByStage, setCardsByStage] = useState<Record<string, ContactCardType[]>>({})
  const [countsByStage, setCountsByStage] = useState<Record<string, number>>({})
  const [loadedByStage, setLoadedByStage] = useState<Record<string, number>>({})
  const [loadingStages, setLoadingStages] = useState<Record<string, boolean>>({})
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const [filters, setFilters] = useState<Filters>({
    search: '',
    cpf: '',
    cidade: '',
    estado: '',
    dateFrom: '',
    dateTo: '',
    status: ''
  })

  const [estados, setEstados] = useState<string[]>([])
  const [cidades, setCidades] = useState<string[]>([])

  // Initialize loaded counts
  useEffect(() => {
    const initial: Record<string, number> = {}
    PIPELINE_STAGES.forEach(stage => {
      initial[stage] = CARDS_PER_LOAD
    })
    setLoadedByStage(initial)
  }, [])

  // Fetch filter options
  useEffect(() => {
    const fetchFilterOptions = async () => {
      // Fetch unique estados
      const { data: estadoData } = await supabase
        .from('casos')
        .select('estado')
        .not('estado', 'is', null)

      const uniqueEstados = [...new Set(estadoData?.map(e => e.estado).filter(Boolean))]
      setEstados(uniqueEstados.sort() as string[])
    }
    fetchFilterOptions()
  }, [])

  // Fetch cards for each stage
  const fetchStageCards = useCallback(async (stage: PipelineStage, limit: number) => {
    setLoadingStages(prev => ({ ...prev, [stage]: true }))

    try {
      let query = supabase
        .from('relacionamentos')
        .select(`
          id, tipo_parentesco, caso_id,
          contatos!inner(id, nome, cpf, telefone_1, telefone_2, telefone_3, telefone_4, status, notes),
          casos(id, nome, cpf, cidade, estado, data_obito)
        `)
        .eq('contatos.status', stage)
        .limit(limit)

      // Apply filters
      if (filters.search) {
        query = query.or(`contatos.nome.ilike.%${filters.search}%,casos.nome.ilike.%${filters.search}%`)
      }
      if (filters.cpf) {
        query = query.or(`contatos.cpf.ilike.%${filters.cpf}%,casos.cpf.ilike.%${filters.cpf}%`)
      }
      if (filters.cidade) {
        query = query.ilike('casos.cidade', `%${filters.cidade}%`)
      }
      if (filters.estado) {
        query = query.eq('casos.estado', filters.estado)
      }
      if (filters.dateFrom) {
        query = query.gte('casos.data_obito', filters.dateFrom)
      }
      if (filters.dateTo) {
        query = query.lte('casos.data_obito', filters.dateTo)
      }

      const { data, error } = await query

      if (error) throw error

      const cards: ContactCardType[] = []
      const seenIds = new Set<string>()

      for (const rel of data || []) {
        const contato = rel.contatos as any
        const caso = rel.casos as any

        if (!contato || seenIds.has(contato.id)) continue
        seenIds.add(contato.id)

        const phones = [contato.telefone_1, contato.telefone_2, contato.telefone_3, contato.telefone_4]
          .filter(Boolean)

        cards.push({
          contato_id: contato.id,
          contato_nome: contato.nome || 'Sem nome',
          contato_cpf: contato.cpf,
          phone_display: phones[0] || '',
          all_phones: phones,
          status: contato.status || 'New',
          notes: contato.notes,
          caso_id: caso?.id || null,
          caso_nome: caso?.nome || 'Desconhecido',
          caso_cpf: caso?.cpf,
          caso_cidade: caso?.cidade,
          caso_estado: caso?.estado,
          caso_data_obito: caso?.data_obito?.split('T')[0] || null,
          tipo_parentesco: rel.tipo_parentesco
        })
      }

      setCardsByStage(prev => ({ ...prev, [stage]: cards }))

      // Get total count for this stage
      const { count } = await supabase
        .from('contatos')
        .select('*', { count: 'exact', head: true })
        .eq('status', stage)

      setCountsByStage(prev => ({ ...prev, [stage]: count || 0 }))

    } catch (err) {
      console.error(`Error fetching ${stage} cards:`, err)
    } finally {
      setLoadingStages(prev => ({ ...prev, [stage]: false }))
    }
  }, [filters])

  // Fetch all stages on mount and when filters change
  useEffect(() => {
    PIPELINE_STAGES.forEach(stage => {
      fetchStageCards(stage, loadedByStage[stage] || CARDS_PER_LOAD)
    })
  }, [filters, refreshKey])

  const loadMore = (stage: PipelineStage) => {
    const newLimit = (loadedByStage[stage] || CARDS_PER_LOAD) + CARDS_PER_LOAD
    setLoadedByStage(prev => ({ ...prev, [stage]: newLimit }))
    fetchStageCards(stage, newLimit)
  }

  const handleCardClick = (contactId: string) => {
    setSelectedContactId(contactId)
    setIsDetailOpen(true)
  }

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  const handleDetailUpdate = () => {
    // Refresh the pipeline after an update
    setRefreshKey(prev => prev + 1)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <FiltersPanel 
        filters={filters} 
        onFiltersChange={setFilters}
        estados={estados}
        cidades={cidades}
      />

      {/* Refresh Button */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {PIPELINE_STAGES.map((stage) => {
          const config = STAGE_CONFIG[stage]
          const cards = cardsByStage[stage] || []
          const totalCount = countsByStage[stage] || 0
          const isLoading = loadingStages[stage]
          const hasMore = cards.length < totalCount

          return (
            <div key={stage} className="flex flex-col">
              {/* Column Header */}
              <Card className={`${config.bgColor} border mb-3`}>
                <CardHeader className="py-3 px-4">
                  <CardTitle className={`text-sm font-semibold flex items-center justify-between ${config.color}`}>
                    <span className="flex items-center gap-2">
                      {config.icon} {stage}
                    </span>
                    <span className="bg-white rounded-full px-2 py-0.5 text-xs">
                      {totalCount.toLocaleString('pt-BR')}
                    </span>
                  </CardTitle>
                </CardHeader>
              </Card>

              {/* Cards */}
              <div className="space-y-3 pipeline-column overflow-y-auto pr-1">
                {isLoading && cards.length === 0 ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400" />
                  </div>
                ) : cards.length === 0 ? (
                  <Card className="bg-gray-50">
                    <CardContent className="py-8 text-center text-gray-400 text-sm">
                      Nenhum contato
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {cards.map((card) => (
                      <ContactCard
                        key={card.contato_id}
                        contact={card}
                        onClick={() => handleCardClick(card.contato_id)}
                      />
                    ))}

                    {/* Load More Button */}
                    {hasMore && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-gray-500"
                        onClick={() => loadMore(stage)}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" />
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-1" />
                            Carregar mais ({totalCount - cards.length})
                          </>
                        )}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Contact Detail Modal */}
      <ContactDetailModal
        contactId={selectedContactId}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onUpdate={handleDetailUpdate}
      />
    </div>
  )
}

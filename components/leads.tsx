"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ContactCard } from './contact-card'
import { ContactDetailModal } from './contact-detail'
import { FiltersPanel } from './filters'
import { supabase } from '@/lib/supabase'
import type { ContactCard as ContactCardType, Filters } from '@/lib/types'
import { ChevronDown, RefreshCw } from 'lucide-react'

const CARDS_PER_LOAD = 20

export function Leads() {
  const [cards, setCards] = useState<ContactCardType[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loadedCount, setLoadedCount] = useState(CARDS_PER_LOAD)
  const [loading, setLoading] = useState(false)
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const [filters, setFilters] = useState<Filters>({
    contactName: '',
    contactCpf: '',
    caseName: '',
    caseCpf: '',
    cidade: '',
    estado: '',
    dateFrom: '',
    dateTo: '',
    status: '',
    campaignId: ''
  })

  const [estados, setEstados] = useState<string[]>([])
  const [cidades, setCidades] = useState<string[]>([])

  // Fetch filter options
  useEffect(() => {
    const fetchFilterOptions = async () => {
      const { data: estadoData } = await (supabase
        .from('casos') as any)
        .select('estado')
        .not('estado', 'is', null)

      const uniqueEstados = Array.from(new Set(estadoData?.map((e: any) => e.estado).filter(Boolean)))
      setEstados(uniqueEstados.sort() as string[])
    }
    fetchFilterOptions()
  }, [])

  // Fetch cards
  const fetchCards = useCallback(async (limit: number) => {
    setLoading(true)

    try {
      // Check if we have any case-related filters
      const hasCaseFilters = filters.caseName || filters.caseCpf || filters.cidade || filters.estado || filters.dateFrom || filters.dateTo
      const caseModifier = hasCaseFilters ? '!inner' : ''
      const campaignJoin = filters.campaignId ? ', campaign_leads!inner(campaign_id)' : ''

      let query = (supabase
        .from('relacionamentos') as any)
        .select(`
          id, tipo_parentesco, caso_id,
          contatos!inner(id, nome, cpf, telefone_1, telefone_2, telefone_3, telefone_4, status, notes, scheduled_for${campaignJoin}),
          casos${caseModifier}(id, nome, cpf, cidade, estado, data_obito)
        `)
        .limit(limit)

      // Apply filters
      if (filters.campaignId) {
        query = query.eq('contatos.campaign_leads.campaign_id', filters.campaignId)
      }
      if (filters.contactName) {
        query = query.ilike('contatos.nome', `%${filters.contactName}%`)
      }
      if (filters.contactCpf) {
        query = query.ilike('contatos.cpf', `%${filters.contactCpf}%`)
      }
      if (filters.caseName) {
        query = query.ilike('casos.nome', `%${filters.caseName}%`)
      }
      if (filters.caseCpf) {
        query = query.ilike('casos.cpf', `%${filters.caseCpf}%`)
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
      if (filters.status && filters.status !== 'ALL') {
        query = query.eq('contatos.status', filters.status)
      }

      const { data, error } = await query

      if (error) throw error

      const newCards: ContactCardType[] = []
      const seenIds = new Set<string>()

      for (const rel of (data as any[]) || []) {
        const contato = rel.contatos
        const caso = rel.casos

        if (!contato || seenIds.has(contato.id)) continue
        seenIds.add(contato.id)

        const phones = [contato.telefone_1, contato.telefone_2, contato.telefone_3, contato.telefone_4]
          .filter(Boolean)

        newCards.push({
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
          tipo_parentesco: rel.tipo_parentesco,
          scheduled_for: contato.scheduled_for || null
        })
      }

      setCards(newCards)
      
      // We need a separate count query because the main query limits results
      let countQuery = supabase
        .from('contatos')
        .select('*', { count: 'exact', head: true })
      
      // Apply same filters to count... this is tricky because of the joins. 
      // For simplicity in this iteration, we might just count the loaded vs total in a simpler way or rely on the query above if we weren't limiting.
      // Actually, Supabase returns count if we ask for it, but with limit it returns the total matching count if we use { count: 'exact' }
      
      // Let's re-run the query with count='exact' but we need to respect the limit for data
      // The previous query call didn't include count param correctly in the select builder chain for count + data
      
      // Correct approach:
      // We can't easily get total count with complex joins and filters in one go without a separate query usually, 
      // but let's try to trust the user will scroll.
      // For now, let's just use the length of data to decide if we show load more? No, that's not enough.
      
      // Let's fetch count separately with same filters
      // This is complicated because the filters are on joined tables.
      // Simplified: Just use a large limit or accept that "Load More" shows up until we get less than limit.
      
      if (data.length < limit) {
         setTotalCount(data.length)
      } else {
         setTotalCount(limit + 1) // Hack to show load more
      }

    } catch (err) {
      console.error('Error fetching leads:', err)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchCards(loadedCount)
  }, [filters, refreshKey, loadedCount, fetchCards])

  const loadMore = () => {
    setLoadedCount(prev => prev + CARDS_PER_LOAD)
  }

  const handleCardClick = (contactId: string) => {
    setSelectedContactId(contactId)
    setIsDetailOpen(true)
  }

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1)
  }

  const handleDetailUpdate = () => {
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
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-700">Todos os Leads</h2>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {loading && cards.length === 0 ? (
          <div className="col-span-full flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : cards.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            Nenhum lead encontrado
          </div>
        ) : (
          cards.map((card) => (
            <ContactCard
              key={card.contato_id}
              contact={card}
              onClick={() => handleCardClick(card.contato_id)}
            />
          ))
        )}
      </div>

      {/* Load More */}
      {cards.length >= loadedCount && (
        <div className="flex justify-center pt-4">
          <Button
            variant="ghost"
            onClick={loadMore}
            disabled={loading}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600" />
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-1" />
                Carregar mais
              </>
            )}
          </Button>
        </div>
      )}

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

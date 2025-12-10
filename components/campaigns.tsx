"use client"

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { supabase, PIPELINE_STAGES } from '@/lib/supabase'
import { useAuth } from '@/components/auth-provider'
import type { Campaign, CampaignFilters, CampaignStatus, ContactCard as ContactCardType, Filters } from '@/lib/types'
import { CAMPAIGN_PLATFORMS } from '@/lib/types'
import { 
  Plus, 
  RefreshCw, 
  Filter, 
  X, 
  Calendar,
  Search,
  Megaphone,
  Edit2,
  Users,
  MessageCircle,
  Phone,
  Mail,
  Globe,
  Trash2,
  ChevronDown,
  CheckSquare,
  Square
} from 'lucide-react'

const LEADS_PER_PAGE = 50

const STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string; bgColor: string }> = {
  'active': { label: 'Ativa', color: 'text-green-700', bgColor: 'bg-green-100' },
  'paused': { label: 'Pausada', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  'completed': { label: 'Concluída', color: 'text-gray-700', bgColor: 'bg-gray-100' },
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  'Whatsapp': <MessageCircle className="h-3 w-3" />,
  'Meta': <Globe className="h-3 w-3" />,
  'Calls': <Phone className="h-3 w-3" />,
  'Emails': <Mail className="h-3 w-3" />,
}

interface CampaignWithCount extends Campaign {
  leads_count: number
}

export function Campaigns() {
  const { profile } = useAuth()
  const [campaigns, setCampaigns] = useState<CampaignWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active' as CampaignStatus,
    platforms: [] as string[],
    selectedLeads: [] as string[],
  })
  const [customPlatform, setCustomPlatform] = useState('')
  
  // Lead selection
  const [availableLeads, setAvailableLeads] = useState<ContactCardType[]>([])
  const [loadingLeads, setLoadingLeads] = useState(false)
  const [leadsPage, setLeadsPage] = useState(1)
  const [hasMoreLeads, setHasMoreLeads] = useState(true)
  const [totalLeadsCount, setTotalLeadsCount] = useState(0)
  const [estados, setEstados] = useState<string[]>([])
  
  // Lead filters (for modal)
  const [leadFilters, setLeadFilters] = useState<Filters>({
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
  const [isLeadFiltersExpanded, setIsLeadFiltersExpanded] = useState(true)
  
  // Filters
  const [filters, setFilters] = useState<CampaignFilters>({
    name: '',
    status: '',
    platform: '',
    dateFrom: '',
    dateTo: '',
  })
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(true)
  
  const canManageCampaigns = profile?.role && ['Admin', 'Empresa', 'Supervisor'].includes(profile.role)

  // Fetch campaigns
  const fetchCampaigns = useCallback(async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('campaigns')
        .select('*, campaign_leads(count)')
        .order('created_at', { ascending: false })

      // Apply filters
      if (filters.name) {
        query = query.ilike('name', `%${filters.name}%`)
      }
      if (filters.status) {
        query = query.eq('status', filters.status)
      }
      if (filters.platform) {
        query = query.contains('platforms', [filters.platform])
      }
      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom)
      }
      if (filters.dateTo) {
        query = query.lte('created_at', filters.dateTo + 'T23:59:59')
      }

      const { data, error } = await query

      if (error) throw error

      const campaignsWithCount = (data || []).map((c: any) => ({
        ...c,
        leads_count: c.campaign_leads?.[0]?.count || 0,
      }))

      setCampaigns(campaignsWithCount)
    } catch (err) {
      console.error('Error fetching campaigns:', err)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns, refreshKey])

  // Fetch estados for filter dropdown
  useEffect(() => {
    const fetchEstados = async () => {
      const { data } = await supabase
        .from('casos')
        .select('estado')
        .not('estado', 'is', null)
      
      const uniqueEstados = Array.from(new Set(data?.map((e: any) => e.estado).filter(Boolean)))
      setEstados(uniqueEstados.sort() as string[])
    }
    fetchEstados()
  }, [])

  // Fetch leads for selection with filters and pagination
  const fetchAvailableLeads = useCallback(async (page: number = 1, append: boolean = false) => {
    setLoadingLeads(true)
    try {
      const limit = LEADS_PER_PAGE
      const offset = (page - 1) * limit
      
      // Check if we have any case-related filters
      const hasCaseFilters = leadFilters.caseName || leadFilters.caseCpf || leadFilters.cidade || leadFilters.estado || leadFilters.dateFrom || leadFilters.dateTo
      const caseModifier = hasCaseFilters ? '!inner' : ''

      let query = supabase
        .from('relacionamentos')
        .select(`
          contatos!inner(id, nome, cpf, telefone_1, status, scheduled_for),
          casos${caseModifier}(id, nome, cpf, cidade, estado, data_obito)
        `)
        .range(offset, offset + limit - 1)

      // Apply contact filters
      if (leadFilters.contactName) {
        query = query.ilike('contatos.nome', `%${leadFilters.contactName}%`)
      }
      if (leadFilters.contactCpf) {
        query = query.ilike('contatos.cpf', `%${leadFilters.contactCpf}%`)
      }
      if (leadFilters.status && leadFilters.status !== 'ALL') {
        query = query.eq('contatos.status', leadFilters.status)
      }
      
      // Apply case filters
      if (leadFilters.caseName) {
        query = query.ilike('casos.nome', `%${leadFilters.caseName}%`)
      }
      if (leadFilters.caseCpf) {
        query = query.ilike('casos.cpf', `%${leadFilters.caseCpf}%`)
      }
      if (leadFilters.cidade) {
        query = query.ilike('casos.cidade', `%${leadFilters.cidade}%`)
      }
      if (leadFilters.estado) {
        query = query.eq('casos.estado', leadFilters.estado)
      }
      if (leadFilters.dateFrom) {
        query = query.gte('casos.data_obito', leadFilters.dateFrom)
      }
      if (leadFilters.dateTo) {
        query = query.lte('casos.data_obito', leadFilters.dateTo)
      }

      const { data, error } = await query

      if (error) throw error

      const leads: ContactCardType[] = []
      const seenIds = new Set<string>(append ? availableLeads.map(l => l.contato_id) : [])

      for (const rel of (data as any[]) || []) {
        const contato = rel.contatos
        const caso = rel.casos
        if (!contato || seenIds.has(contato.id)) continue
        seenIds.add(contato.id)

        leads.push({
          contato_id: contato.id,
          contato_nome: contato.nome || 'Sem nome',
          contato_cpf: contato.cpf,
          phone_display: contato.telefone_1 || '',
          all_phones: [contato.telefone_1].filter(Boolean),
          status: contato.status || 'New',
          notes: null,
          caso_id: caso?.id || null,
          caso_nome: caso?.nome || '',
          caso_cpf: caso?.cpf || null,
          caso_cidade: caso?.cidade,
          caso_estado: caso?.estado,
          caso_data_obito: caso?.data_obito?.split('T')[0] || null,
          tipo_parentesco: null,
          scheduled_for: contato.scheduled_for || null,
        })
      }

      if (append) {
        setAvailableLeads(prev => [...prev, ...leads])
      } else {
        setAvailableLeads(leads)
      }
      
      setHasMoreLeads(leads.length >= limit)
      setTotalLeadsCount(prev => append ? prev : (leads.length < limit ? leads.length : leads.length + 1))
    } catch (err) {
      console.error('Error fetching leads:', err)
    } finally {
      setLoadingLeads(false)
    }
  }, [leadFilters, availableLeads])

  // Reset and fetch leads when filters change
  useEffect(() => {
    if (isModalOpen) {
      setLeadsPage(1)
      fetchAvailableLeads(1, false)
    }
  }, [leadFilters, isModalOpen])

  // Load more leads
  const loadMoreLeads = () => {
    const nextPage = leadsPage + 1
    setLeadsPage(nextPage)
    fetchAvailableLeads(nextPage, true)
  }

  // Select/Deselect all shown leads
  const selectAllShown = () => {
    const shownIds = availableLeads.map(l => l.contato_id)
    setFormData(prev => ({
      ...prev,
      selectedLeads: Array.from(new Set([...prev.selectedLeads, ...shownIds]))
    }))
  }

  const deselectAllShown = () => {
    const shownIds = new Set(availableLeads.map(l => l.contato_id))
    setFormData(prev => ({
      ...prev,
      selectedLeads: prev.selectedLeads.filter(id => !shownIds.has(id))
    }))
  }

  const clearLeadSelection = () => {
    setFormData(prev => ({ ...prev, selectedLeads: [] }))
  }

  const clearLeadFilters = () => {
    setLeadFilters({
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
  }

  const hasActiveLeadFilters = Object.values(leadFilters).some(v => v !== '')

  // Open modal for new campaign
  const handleAddCampaign = () => {
    setEditingCampaign(null)
    setFormData({
      name: '',
      description: '',
      status: 'active',
      platforms: [],
      selectedLeads: [],
    })
    setCustomPlatform('')
    clearLeadFilters()
    setLeadsPage(1)
    setIsModalOpen(true)
  }

  // Open modal for editing
  const handleEditCampaign = async (campaign: Campaign) => {
    setEditingCampaign(campaign)
    
    // Fetch current leads for this campaign
    const { data: campaignLeads } = await (supabase
      .from('campaign_leads') as any)
      .select('contato_id')
      .eq('campaign_id', campaign.id)
    
    setFormData({
      name: campaign.name,
      description: campaign.description || '',
      status: campaign.status,
      platforms: campaign.platforms,
      selectedLeads: campaignLeads?.map((l: any) => l.contato_id) || [],
    })
    setCustomPlatform('')
    clearLeadFilters()
    setLeadsPage(1)
    setIsModalOpen(true)
  }

  // Save campaign
  const handleSave = async () => {
    if (!formData.name.trim()) return
    
    setIsSaving(true)
    try {
      if (editingCampaign) {
        // Update existing campaign
        const { error } = await (supabase
          .from('campaigns') as any)
          .update({
            name: formData.name,
            description: formData.description || null,
            status: formData.status,
            platforms: formData.platforms,
          })
          .eq('id', editingCampaign.id)

        if (error) throw error

        // Update campaign leads
        await (supabase
          .from('campaign_leads') as any)
          .delete()
          .eq('campaign_id', editingCampaign.id)

        if (formData.selectedLeads.length > 0) {
          await (supabase
            .from('campaign_leads') as any)
            .insert(
              formData.selectedLeads.map(contato_id => ({
                campaign_id: editingCampaign.id,
                contato_id,
              }))
            )
        }
      } else {
        // Create new campaign
        const { data: newCampaign, error } = await (supabase
          .from('campaigns') as any)
          .insert({
            name: formData.name,
            description: formData.description || null,
            status: formData.status,
            platforms: formData.platforms,
            created_by: profile?.id,
          })
          .select()
          .single()

        if (error) throw error

        // Add leads to campaign
        if (newCampaign && formData.selectedLeads.length > 0) {
          await (supabase
            .from('campaign_leads') as any)
            .insert(
              formData.selectedLeads.map(contato_id => ({
                campaign_id: newCampaign.id,
                contato_id,
              }))
            )
        }
      }

      setIsModalOpen(false)
      setRefreshKey(prev => prev + 1)
    } catch (err) {
      console.error('Error saving campaign:', err)
    } finally {
      setIsSaving(false)
    }
  }

  // Toggle platform selection
  const togglePlatform = (platform: string) => {
    setFormData(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform],
    }))
  }

  // Add custom platform
  const addCustomPlatform = () => {
    if (customPlatform.trim() && !formData.platforms.includes(customPlatform.trim())) {
      setFormData(prev => ({
        ...prev,
        platforms: [...prev.platforms, customPlatform.trim()],
      }))
      setCustomPlatform('')
    }
  }

  // Toggle lead selection
  const toggleLead = (leadId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedLeads: prev.selectedLeads.includes(leadId)
        ? prev.selectedLeads.filter(id => id !== leadId)
        : [...prev.selectedLeads, leadId],
    }))
  }

  const clearFilters = () => {
    setFilters({
      name: '',
      status: '',
      platform: '',
      dateFrom: '',
      dateTo: '',
    })
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  return (
    <div className="space-y-4">
      {/* Filters Panel */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-gray-500" />
              <h3 className="font-semibold text-gray-700">Filtros</h3>
              {hasActiveFilters && (
                <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded-full">
                  Ativos
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              >
                {isFiltersExpanded ? 'Ocultar' : 'Mostrar'}
              </Button>
            </div>
          </div>

          {isFiltersExpanded && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600">Nome da Campanha</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar..."
                    value={filters.name}
                    onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600">Status</label>
                <Select 
                  value={filters.status || "ALL"} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === "ALL" ? "" : value as CampaignStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos os status</SelectItem>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="paused">Pausada</SelectItem>
                    <SelectItem value="completed">Concluída</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600">Plataforma</label>
                <Select 
                  value={filters.platform || "ALL"} 
                  onValueChange={(value) => setFilters(prev => ({ ...prev, platform: value === "ALL" ? "" : value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todas as plataformas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas as plataformas</SelectItem>
                    {CAMPAIGN_PLATFORMS.map((platform) => (
                      <SelectItem key={platform} value={platform}>
                        {platform}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600">Data (De)</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-600">Data (Até)</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Header with actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-700">Campanhas Ativas</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setRefreshKey(prev => prev + 1)}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          {canManageCampaigns && (
            <Button size="sm" onClick={handleAddCampaign}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Campanha
            </Button>
          )}
        </div>
      </div>

      {/* Campaigns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Megaphone className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Nenhuma campanha encontrada</p>
            {canManageCampaigns && (
              <Button className="mt-4" onClick={handleAddCampaign}>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeira campanha
              </Button>
            )}
          </div>
        ) : (
          campaigns.map((campaign) => (
            <Card key={campaign.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Megaphone className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-base">{campaign.name}</CardTitle>
                  </div>
                  <Badge className={`${STATUS_CONFIG[campaign.status].bgColor} ${STATUS_CONFIG[campaign.status].color} border-0`}>
                    {STATUS_CONFIG[campaign.status].label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {campaign.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{campaign.description}</p>
                )}
                
                {/* Platforms */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {campaign.platforms.map((platform) => (
                    <Badge key={platform} variant="outline" className="text-xs flex items-center gap-1">
                      {PLATFORM_ICONS[platform] || <Globe className="h-3 w-3" />}
                      {platform}
                    </Badge>
                  ))}
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{campaign.leads_count} leads</span>
                  </div>
                  <span>{new Date(campaign.created_at).toLocaleDateString('pt-BR')}</span>
                </div>

                {/* Actions */}
                {canManageCampaigns && (
                  <div className="mt-4 pt-3 border-t flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => handleEditCampaign(campaign)}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Editar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit Campaign Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCampaign ? 'Editar Campanha' : 'Nova Campanha'}
            </DialogTitle>
            <DialogDescription>
              {editingCampaign 
                ? 'Atualize os detalhes da campanha' 
                : 'Preencha os detalhes para criar uma nova campanha'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Name */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome da Campanha *</label>
              <Input
                placeholder="Ex: Black Friday 2024"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Descrição</label>
              <Textarea
                placeholder="Descreva o objetivo da campanha..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value as CampaignStatus }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativa</SelectItem>
                  <SelectItem value="paused">Pausada</SelectItem>
                  <SelectItem value="completed">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Platforms */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Plataformas</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {CAMPAIGN_PLATFORMS.map((platform) => (
                  <Badge
                    key={platform}
                    variant={formData.platforms.includes(platform) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => togglePlatform(platform)}
                  >
                    {PLATFORM_ICONS[platform]}
                    <span className="ml-1">{platform}</span>
                  </Badge>
                ))}
                {formData.platforms
                  .filter(p => !CAMPAIGN_PLATFORMS.includes(p as any))
                  .map((platform) => (
                    <Badge
                      key={platform}
                      variant="default"
                      className="cursor-pointer"
                      onClick={() => togglePlatform(platform)}
                    >
                      <Globe className="h-3 w-3" />
                      <span className="ml-1">{platform}</span>
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Adicionar plataforma personalizada..."
                  value={customPlatform}
                  onChange={(e) => setCustomPlatform(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomPlatform())}
                  className="flex-1"
                />
                <Button variant="outline" onClick={addCustomPlatform} disabled={!customPlatform.trim()}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Lead Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Leads ({formData.selectedLeads.length} selecionados de {availableLeads.length} carregados)
                </label>
                {formData.selectedLeads.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearLeadSelection} className="text-xs h-7">
                    <X className="h-3 w-3 mr-1" />
                    Limpar seleção
                  </Button>
                )}
              </div>

              {/* Lead Filters */}
              <Card className="border-dashed">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">Filtrar Leads</span>
                      {hasActiveLeadFilters && (
                        <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">Ativos</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {hasActiveLeadFilters && (
                        <Button variant="ghost" size="sm" onClick={clearLeadFilters} className="text-xs h-7">
                          <X className="h-3 w-3 mr-1" />
                          Limpar
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setIsLeadFiltersExpanded(!isLeadFiltersExpanded)} className="text-xs h-7">
                        {isLeadFiltersExpanded ? 'Ocultar' : 'Mostrar'}
                      </Button>
                    </div>
                  </div>

                  {isLeadFiltersExpanded && (
                    <div className="space-y-4">
                      {/* Seção Parente */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-900 mb-2 border-b pb-1">Parente</h4>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <label className="text-xs text-gray-600">Nome do Parente</label>
                            <Input
                              placeholder="Nome..."
                              value={leadFilters.contactName}
                              onChange={(e) => setLeadFilters(prev => ({ ...prev, contactName: e.target.value }))}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-600">CPF do Parente</label>
                            <Input
                              placeholder="CPF..."
                              value={leadFilters.contactCpf}
                              onChange={(e) => setLeadFilters(prev => ({ ...prev, contactCpf: e.target.value }))}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-600">Status</label>
                            <Select 
                              value={leadFilters.status || "ALL"} 
                              onValueChange={(value) => setLeadFilters(prev => ({ ...prev, status: value === "ALL" ? "" : value }))}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Todos" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ALL">Todos</SelectItem>
                                {PIPELINE_STAGES.map((stage) => (
                                  <SelectItem key={stage} value={stage}>{stage}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      {/* Seção Falecido */}
                      <div>
                        <h4 className="text-xs font-semibold text-gray-900 mb-2 border-b pb-1">Falecido</h4>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <label className="text-xs text-gray-600">Nome do Falecido</label>
                            <Input
                              placeholder="Nome..."
                              value={leadFilters.caseName}
                              onChange={(e) => setLeadFilters(prev => ({ ...prev, caseName: e.target.value }))}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-600">CPF do Falecido</label>
                            <Input
                              placeholder="CPF..."
                              value={leadFilters.caseCpf}
                              onChange={(e) => setLeadFilters(prev => ({ ...prev, caseCpf: e.target.value }))}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-600">Estado</label>
                            <Select 
                              value={leadFilters.estado || "ALL"} 
                              onValueChange={(value) => setLeadFilters(prev => ({ ...prev, estado: value === "ALL" ? "" : value }))}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Todos" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ALL">Todos os estados</SelectItem>
                                {estados.map((estado) => (
                                  <SelectItem key={estado} value={estado}>{estado}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-600">Cidade</label>
                            <Input
                              placeholder="Cidade..."
                              value={leadFilters.cidade}
                              onChange={(e) => setLeadFilters(prev => ({ ...prev, cidade: e.target.value }))}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-600">Óbito (De)</label>
                            <Input
                              type="date"
                              value={leadFilters.dateFrom}
                              onChange={(e) => setLeadFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs text-gray-600">Óbito (Até)</label>
                            <Input
                              type="date"
                              value={leadFilters.dateTo}
                              onChange={(e) => setLeadFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Select All / Deselect Actions */}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={selectAllShown} className="text-xs h-7">
                  <CheckSquare className="h-3 w-3 mr-1" />
                  Selecionar todos ({availableLeads.length})
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAllShown} className="text-xs h-7">
                  <Square className="h-3 w-3 mr-1" />
                  Desmarcar todos
                </Button>
              </div>

              {/* Lead List */}
              <div className="border rounded-md">
                <div className="max-h-64 overflow-y-auto">
                  {loadingLeads && availableLeads.length === 0 ? (
                    <div className="flex justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                    </div>
                  ) : availableLeads.length === 0 ? (
                    <div className="text-center py-8">
                      <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Nenhum lead encontrado</p>
                      <p className="text-xs text-gray-400">Ajuste os filtros para encontrar leads</p>
                    </div>
                  ) : (
                    availableLeads.map((lead) => (
                      <div
                        key={lead.contato_id}
                        className={`flex items-center justify-between p-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0 ${
                          formData.selectedLeads.includes(lead.contato_id) ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => toggleLead(lead.contato_id)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{lead.contato_nome}</p>
                            <Badge variant="outline" className="text-xs shrink-0">{lead.status}</Badge>
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {lead.caso_nome && <span className="font-medium">Falecido: {lead.caso_nome}</span>}
                            {lead.caso_cidade && lead.caso_estado && ` • ${lead.caso_cidade}, ${lead.caso_estado}`}
                            {lead.caso_data_obito && ` • ${lead.caso_data_obito}`}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.selectedLeads.includes(lead.contato_id)}
                          onChange={() => {}}
                          className="h-4 w-4 text-blue-600 rounded shrink-0 ml-2"
                        />
                      </div>
                    ))
                  )}
                </div>
                
                {/* Load More */}
                {hasMoreLeads && availableLeads.length > 0 && (
                  <div className="border-t p-2 bg-gray-50">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={loadMoreLeads}
                      disabled={loadingLeads}
                      className="w-full text-xs h-8"
                    >
                      {loadingLeads ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600" />
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4 mr-1" />
                          Carregar mais leads
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving || !formData.name.trim()}>
              {isSaving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : editingCampaign ? (
                'Salvar Alterações'
              ) : (
                'Criar Campanha'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

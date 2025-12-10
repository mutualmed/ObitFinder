"use client"

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Phone, User, MapPin, Calendar, FileText, Upload, 
  Trophy, XCircle, Clock, CheckCircle, Users, AlertTriangle, CalendarClock
} from 'lucide-react'
import { supabase, PIPELINE_STAGES, type PipelineStage } from '@/lib/supabase'
import { formatPhone, formatCPF, formatDate } from '@/lib/utils'
import type { ContactDetails, RelativeInfo } from '@/lib/types'

interface ContactDetailProps {
  contactId: string | null
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

export function ContactDetailModal({ contactId, isOpen, onClose, onUpdate }: ContactDetailProps) {
  const [details, setDetails] = useState<ContactDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [scheduledFor, setScheduledFor] = useState('')
  const [originalScheduledFor, setOriginalScheduledFor] = useState('')
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)

  useEffect(() => {
    if (contactId && isOpen) {
      fetchContactDetails()
    }
  }, [contactId, isOpen])

  const fetchContactDetails = async () => {
    if (!contactId) return
    setLoading(true)

    try {
      // Fetch contact info
      const { data: contact } = await supabase
        .from('contatos')
        .select('*')
        .eq('id', contactId)
        .single()

      if (!contact) {
        setLoading(false)
        return
      }

      setNotes(contact.notes || '')
      const schedDate = contact.scheduled_for ? contact.scheduled_for.split('T')[0] : ''
      setScheduledFor(schedDate)
      setOriginalScheduledFor(schedDate)
      setPendingStatus(null)

      // Fetch related caso via relacionamentos
      const { data: relData } = await supabase
        .from('relacionamentos')
        .select('tipo_parentesco, caso_id, casos(*)')
        .eq('contato_id', contactId)
        .single()

      const caso = relData?.casos as any || null
      const parentesco = relData?.tipo_parentesco || null
      const casoId = relData?.caso_id

      // Fetch OTHER relatives of the same deceased
      let otherRelatives: RelativeInfo[] = []
      if (casoId) {
        const { data: otherRels } = await supabase
          .from('relacionamentos')
          .select('tipo_parentesco, contatos(id, nome, cpf, telefone_1, status)')
          .eq('caso_id', casoId)
          .neq('contato_id', contactId)

        otherRelatives = (otherRels || []).map((rel: any) => ({
          contato_id: rel.contatos?.id,
          nome: rel.contatos?.nome,
          cpf: rel.contatos?.cpf,
          telefone_1: rel.contatos?.telefone_1,
          tipo_parentesco: rel.tipo_parentesco,
          status: rel.contatos?.status
        })).filter((r: RelativeInfo) => r.contato_id)
      }

      setDetails({
        contact,
        caso,
        parentesco,
        otherRelatives
      })
    } catch (err) {
      console.error('Error fetching contact details:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === 'Scheduled') {
      setPendingStatus(newStatus)
    } else {
      setPendingStatus(null)
      updateStatus(newStatus, null)
    }
  }

  const confirmScheduled = () => {
    if (!scheduledFor) {
      alert('Por favor, selecione uma data para o agendamento.')
      return
    }
    updateStatus('Scheduled', scheduledFor)
    setPendingStatus(null)
  }

  const updateScheduledDate = async () => {
    if (!contactId || !scheduledFor) return
    setSaving(true)

    try {
      await supabase
        .from('contatos')
        .update({ scheduled_for: scheduledFor })
        .eq('id', contactId)

      setOriginalScheduledFor(scheduledFor)
      onUpdate()
      fetchContactDetails()
    } catch (err) {
      console.error('Error updating scheduled date:', err)
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (newStatus: string, scheduleDate: string | null) => {
    if (!contactId || !details) return
    setSaving(true)

    try {
      // Update the contact status
      const updateData: { status: string; status_updated_at: string; scheduled_for?: string | null } = { 
        status: newStatus, 
        status_updated_at: new Date().toISOString() 
      }
      
      if (newStatus === 'Scheduled' && scheduleDate) {
        updateData.scheduled_for = scheduleDate
      } else if (newStatus !== 'Scheduled') {
        updateData.scheduled_for = null
      }
      
      await supabase
        .from('contatos')
        .update(updateData)
        .eq('id', contactId)

      // If Won, trigger the One-Win-Close-All logic
      if (newStatus === 'Won' && details.caso?.id) {
        const { data: allRels } = await supabase
          .from('relacionamentos')
          .select('contato_id')
          .eq('caso_id', details.caso.id)
          .neq('contato_id', contactId)

        // Close all other relatives
        for (const rel of allRels || []) {
          const { data: otherContact } = await supabase
            .from('contatos')
            .select('status, notes')
            .eq('id', rel.contato_id)
            .single()

          if (otherContact && !['Won', 'Lost'].includes(otherContact.status || '')) {
            await supabase
              .from('contatos')
              .update({
                status: 'Lost',
                notes: (otherContact.notes || '') + `\n[Auto-fechado: Outro familiar ganhou em ${new Date().toLocaleDateString('pt-BR')}]`,
                status_updated_at: new Date().toISOString()
              })
              .eq('id', rel.contato_id)
          }
        }
      }

      onUpdate()
      fetchContactDetails()
    } catch (err) {
      console.error('Error updating status:', err)
    } finally {
      setSaving(false)
    }
  }

  const saveNotes = async () => {
    if (!contactId) return
    setSaving(true)

    try {
      await supabase
        .from('contatos')
        .update({ notes })
        .eq('id', contactId)

      onUpdate()
    } catch (err) {
      console.error('Error saving notes:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !details?.caso?.id) return

    try {
      const fileName = `${details.caso.id}/${Date.now()}_${file.name}`
      const { error } = await supabase.storage
        .from('case_files')
        .upload(fileName, file)

      if (error) throw error
      alert('Arquivo enviado com sucesso!')
    } catch (err) {
      console.error('Upload error:', err)
      alert('Erro ao enviar arquivo')
    }
  }

  if (!isOpen) return null

  const contact = details?.contact
  const caso = details?.caso
  const currentStatus = contact?.status || 'New'

  const statusBadgeVariant = {
    'New': 'new',
    'Attempted': 'attempted',
    'In Progress': 'inProgress',
    'Scheduled': 'scheduled',
    'Won': 'won',
    'Lost': 'lost'
  }[currentStatus] || 'default'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <User className="h-6 w-6" />
            {loading ? 'Carregando...' : contact?.nome || 'Detalhes do Contato'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : details ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Contact Info */}
            <div className="space-y-4">
              {/* Status and Actions */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Status</CardTitle>
                    <Badge variant={statusBadgeVariant as any} className="text-sm">
                      {currentStatus}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={pendingStatus || currentStatus} onValueChange={handleStatusChange} disabled={saving}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PIPELINE_STAGES.map((stage) => (
                        <SelectItem key={stage} value={stage}>
                          {stage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {/* Date picker for Scheduled status */}
                  {(pendingStatus === 'Scheduled' || currentStatus === 'Scheduled') && (
                    <div className="space-y-2 p-3 bg-purple-50 rounded-lg border border-purple-200">
                      <Label className="flex items-center gap-2 text-purple-700">
                        <CalendarClock className="h-4 w-4" />
                        Data para contato
                      </Label>
                      <Input
                        type="date"
                        value={scheduledFor}
                        onChange={(e) => setScheduledFor(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="bg-white"
                      />
                      {pendingStatus === 'Scheduled' ? (
                        <Button 
                          size="sm" 
                          onClick={confirmScheduled}
                          disabled={saving || !scheduledFor}
                          className="w-full bg-purple-600 hover:bg-purple-700"
                        >
                          <CalendarClock className="h-4 w-4 mr-1" />
                          Confirmar Agendamento
                        </Button>
                      ) : currentStatus === 'Scheduled' && scheduledFor !== originalScheduledFor && (
                        <Button 
                          size="sm" 
                          onClick={() => updateScheduledDate()}
                          disabled={saving || !scheduledFor}
                          className="w-full bg-purple-600 hover:bg-purple-700"
                        >
                          <CalendarClock className="h-4 w-4 mr-1" />
                          Atualizar Data
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button 
                      variant="success" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => updateStatus('Won', null)}
                      disabled={saving || currentStatus === 'Won'}
                    >
                      <Trophy className="h-4 w-4 mr-1" />
                      Ganho
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => updateStatus('Lost', null)}
                      disabled={saving || currentStatus === 'Lost'}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Perdido
                    </Button>
                  </div>

                  {currentStatus !== 'Won' && currentStatus !== 'Lost' && details.otherRelatives.length > 0 && (
                    <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                      <p className="text-sm text-yellow-700">
                        Ao marcar como <strong>Ganho</strong>, os outros {details.otherRelatives.length} familiar(es) 
                        serão automaticamente fechados.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Contact Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    Informações do Contato
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-500">Nome</p>
                    <p className="font-medium">{contact?.nome || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">CPF</p>
                    <p className="font-medium">{formatCPF(contact?.cpf)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Telefones</p>
                    <div className="space-y-1">
                      {[contact?.telefone_1, contact?.telefone_2, contact?.telefone_3, contact?.telefone_4]
                        .filter(Boolean)
                        .map((phone, i) => (
                          <p key={i} className="font-medium font-mono">
                            {formatPhone(phone)}
                          </p>
                        ))}
                      {![contact?.telefone_1, contact?.telefone_2, contact?.telefone_3, contact?.telefone_4].some(Boolean) && (
                        <p className="text-gray-400">Nenhum telefone cadastrado</p>
                      )}
                    </div>
                  </div>
                  {details.parentesco && (
                    <div>
                      <p className="text-sm text-gray-500">Parentesco</p>
                      <p className="font-medium">{details.parentesco}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Notes */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Notas / Registro de Chamadas
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Adicione notas sobre o contato..."
                    rows={4}
                  />
                  <Button onClick={saveNotes} disabled={saving} className="w-full">
                    {saving ? 'Salvando...' : 'Salvar Notas'}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Deceased Info & Other Relatives */}
            <div className="space-y-4">
              {/* Deceased Info */}
              {caso && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Informações do Falecido
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <p className="text-sm text-gray-500">Nome</p>
                      <p className="font-medium">{caso.nome || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">CPF</p>
                      <p className="font-medium">{formatCPF(caso.cpf)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-sm text-gray-500">Data Óbito</p>
                        <p className="font-medium">{formatDate(caso.data_obito)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Idade</p>
                        <p className="font-medium">{caso.idade || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-sm text-gray-500">Cidade</p>
                        <p className="font-medium">{caso.cidade || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Estado</p>
                        <p className="font-medium">{caso.estado || 'N/A'}</p>
                      </div>
                    </div>
                    {caso.profissao && (
                      <div>
                        <p className="text-sm text-gray-500">Profissão</p>
                        <p className="font-medium">{caso.profissao}</p>
                      </div>
                    )}
                    {caso.link_fonte && (
                      <a 
                        href={caso.link_fonte} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-sm"
                      >
                        Ver fonte original →
                      </a>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Other Relatives */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Outros Familiares ({details.otherRelatives.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {details.otherRelatives.length === 0 ? (
                    <p className="text-gray-400 text-sm">Nenhum outro familiar cadastrado</p>
                  ) : (
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {details.otherRelatives.map((rel) => (
                        <div 
                          key={rel.contato_id} 
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-sm">{rel.nome || 'Sem nome'}</p>
                            <p className="text-xs text-gray-500">
                              {rel.tipo_parentesco || 'Parentesco não informado'}
                            </p>
                            {rel.telefone_1 && (
                              <p className="text-xs text-gray-400 font-mono">
                                {formatPhone(rel.telefone_1)}
                              </p>
                            )}
                          </div>
                          <Badge variant={
                            {
                              'New': 'new',
                              'Attempted': 'attempted',
                              'In Progress': 'inProgress',
                              'Won': 'won',
                              'Lost': 'lost'
                            }[rel.status || 'New'] as any
                          }>
                            {rel.status || 'New'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* File Upload */}
              {caso && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Upload className="h-5 w-5" />
                      Documentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-3 text-gray-400" />
                        <p className="text-sm text-gray-500">
                          Clique para enviar arquivo
                        </p>
                        <p className="text-xs text-gray-400">
                          PDF, PNG, JPG (Max. 10MB)
                        </p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".pdf,.png,.jpg,.jpeg"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            Contato não encontrado
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

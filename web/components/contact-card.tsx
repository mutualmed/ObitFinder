"use client"

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Phone, User, MapPin } from 'lucide-react'
import type { ContactCard as ContactCardType } from '@/lib/types'
import { formatPhone, formatCPF } from '@/lib/utils'
import { STAGE_CONFIG, type PipelineStage } from '@/lib/supabase'

interface ContactCardProps {
  contact: ContactCardType
  onClick: () => void
}

export function ContactCard({ contact, onClick }: ContactCardProps) {
  const stageConfig = STAGE_CONFIG[contact.status as PipelineStage] || STAGE_CONFIG['New']
  
  const badgeVariant = {
    'New': 'new',
    'Attempted': 'attempted',
    'In Progress': 'inProgress',
    'Won': 'won',
    'Lost': 'lost'
  }[contact.status] || 'default'

  return (
    <Card 
      className="contact-card cursor-pointer hover:border-blue-300 transition-all"
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Header with name and status */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 truncate">
              {contact.contato_nome || 'Sem nome'}
            </h4>
            {contact.contato_cpf && (
              <p className="text-xs text-gray-500 mt-0.5">
                CPF: {formatCPF(contact.contato_cpf)}
              </p>
            )}
          </div>
          <Badge variant={badgeVariant as any} className="ml-2 shrink-0">
            {contact.status}
          </Badge>
        </div>

        {/* Phone */}
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
          <Phone className="h-4 w-4 shrink-0" />
          <span className="truncate">{formatPhone(contact.phone_display) || 'Sem telefone'}</span>
        </div>

        {/* Deceased info */}
        <div className="border-t pt-3 mt-3">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <User className="h-4 w-4 shrink-0" />
            <span className="truncate font-medium">{contact.caso_nome || 'Falecido desconhecido'}</span>
          </div>
          
          {contact.tipo_parentesco && (
            <p className="text-xs text-gray-400 ml-6 mb-1">
              Parentesco: {contact.tipo_parentesco}
            </p>
          )}

          {(contact.caso_cidade || contact.caso_estado) && (
            <div className="flex items-center gap-2 text-xs text-gray-400 ml-6">
              <MapPin className="h-3 w-3" />
              <span>
                {[contact.caso_cidade, contact.caso_estado].filter(Boolean).join(', ')}
              </span>
            </div>
          )}

          {contact.caso_data_obito && (
            <p className="text-xs text-gray-400 ml-6 mt-1">
              Óbito: {contact.caso_data_obito}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export type UserRole = 'Admin' | 'Empresa' | 'Supervisor' | 'Operador'

export interface Profile {
  id: string
  role: UserRole
  full_name: string | null
  created_at: string
  updated_at: string
}

export interface Caso {
  id: string
  nome: string | null
  cpf: string | null
  data_obito: string | null
  data_nascimento: string | null
  idade: string | null
  genero: string | null
  profissao: string | null
  cidade: string | null
  estado: string | null
  local_obito: string | null
  detalhes_sepultamento: string | null
  link_fonte: string | null
  outras_info: string | null
  created_at: string | null
  hora_obito: string | null
  endereco_tipo: string | null
  endereco_logradouro: string | null
  endereco_numero: string | null
  endereco_complemento: string | null
  endereco_bairro: string | null
  endereco_cidade_enriq: string | null
  endereco_uf_enriq: string | null
  endereco_cep: string | null
}

export interface Contato {
  id: string
  nome: string | null
  cpf: string | null
  telefone_1: string | null
  telefone_2: string | null
  telefone_3: string | null
  telefone_4: string | null
  origem_dado: string | null
  created_at: string | null
  contacted: boolean | null
  notes: string | null
  status: string | null
  status_updated_at: string | null
  scheduled_for: string | null
}

export interface Relacionamento {
  id: string
  caso_id: string | null
  contato_id: string | null
  tipo_parentesco: string | null
}

// Campaign types
export type CampaignStatus = 'active' | 'paused' | 'completed'

export const CAMPAIGN_PLATFORMS = ['Whatsapp', 'Meta', 'Calls', 'Emails'] as const
export type CampaignPlatform = typeof CAMPAIGN_PLATFORMS[number] | string

export interface Campaign {
  id: string
  name: string
  description: string | null
  status: CampaignStatus
  platforms: string[]
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CampaignLead {
  id: string
  campaign_id: string
  contato_id: string
  added_at: string
}

export interface CampaignWithLeads extends Campaign {
  leads_count: number
}

export interface CampaignFilters {
  name: string
  status: CampaignStatus | ''
  platform: string
  dateFrom: string
  dateTo: string
}

// Database interface (must be after all table types are defined)
export interface Database {
  public: {
    Tables: {
      casos: {
        Row: Caso
        Insert: Partial<Caso>
        Update: Partial<Caso>
      }
      contatos: {
        Row: Contato
        Insert: Partial<Contato>
        Update: Partial<Contato>
      }
      relacionamentos: {
        Row: Relacionamento
        Insert: Partial<Relacionamento>
        Update: Partial<Relacionamento>
      }
      profiles: {
        Row: Profile
        Insert: Partial<Profile>
        Update: Partial<Profile>
      }
      campaigns: {
        Row: Campaign
        Insert: Partial<Campaign>
        Update: Partial<Campaign>
      }
      campaign_leads: {
        Row: CampaignLead
        Insert: Partial<CampaignLead>
        Update: Partial<CampaignLead>
      }
    }
  }
}

// Extended types for UI
export interface ContactCard {
  contato_id: string
  contato_nome: string
  contato_cpf: string | null
  phone_display: string
  all_phones: string[]
  status: string
  notes: string | null
  caso_id: string | null
  caso_nome: string
  caso_cpf: string | null
  caso_cidade: string | null
  caso_estado: string | null
  caso_data_obito: string | null
  tipo_parentesco: string | null
  scheduled_for: string | null
}

export interface ContactDetails {
  contact: Contato
  caso: Caso | null
  parentesco: string | null
  otherRelatives: RelativeInfo[]
}

export interface RelativeInfo {
  contato_id: string
  nome: string | null
  cpf: string | null
  telefone_1: string | null
  tipo_parentesco: string | null
  status: string | null
}

export interface DashboardStats {
  totalCasos: number
  totalContatos: number
  byStatus: Record<string, number>
  byCity: { city: string; count: number }[]
  byState: { state: string; count: number }[]
  recentActivity: number
}

export interface Filters {
  contactName: string
  contactCpf: string
  caseName: string
  caseCpf: string
  cidade: string
  estado: string
  dateFrom: string
  dateTo: string
  status: string
}


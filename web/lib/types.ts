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
    }
  }
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
}

export interface Relacionamento {
  id: string
  caso_id: string | null
  contato_id: string | null
  tipo_parentesco: string | null
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

import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR')
  } catch {
    return dateString
  }
}

export function formatCPF(cpf: string | null): string {
  if (!cpf) return 'N/A'
  // Format as XXX.XXX.XXX-XX
  const cleaned = cpf.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  }
  return cpf
}

export function formatPhone(phone: string | null): string {
  if (!phone) return ''
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }
  return phone
}

export function aggregatePhones(contact: { 
  telefone_1?: string | null
  telefone_2?: string | null
  telefone_3?: string | null
  telefone_4?: string | null 
}): string[] {
  const phones = [
    contact.telefone_1,
    contact.telefone_2,
    contact.telefone_3,
    contact.telefone_4,
  ]
  return phones.filter((p): p is string => !!p && p.trim() !== '')
}

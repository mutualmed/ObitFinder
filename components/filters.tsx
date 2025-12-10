"use client"

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Search, X, Filter, Calendar } from 'lucide-react'
import type { Filters } from '@/lib/types'
import { PIPELINE_STAGES } from '@/lib/supabase'

interface FiltersProps {
  filters: Filters
  onFiltersChange: (filters: Filters) => void
  estados: string[]
  cidades: string[]
}

export function FiltersPanel({ filters, onFiltersChange, estados, cidades }: FiltersProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const updateFilter = (key: keyof Filters, value: string) => {
    onFiltersChange({ ...filters, [key]: value })  }

  const clearFilters = () => {
    onFiltersChange({
      contactName: '',
      contactCpf: '',
      caseName: '',
      caseCpf: '',
      cidade: '',
      estado: '',
      dateFrom: '',
      dateTo: '',
      status: ''
    })
  }

  const hasActiveFilters = Object.values(filters).some(v => v !== '')

  return (
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
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Ocultar' : 'Mostrar'}
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="space-y-6">
            {/* Seção Parente */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3 border-b pb-1">Parente</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Contact Name */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">Nome do Parente</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por nome..."
                      value={filters.contactName}
                      onChange={(e) => updateFilter('contactName', e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Contact CPF */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">CPF do Parente</label>
                  <Input
                    placeholder="000.000.000-00"
                    value={filters.contactCpf}
                    onChange={(e) => updateFilter('contactCpf', e.target.value)}
                  />
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">Status</label>
                  <Select 
                    value={filters.status || "ALL"} 
                    onValueChange={(value) => updateFilter('status', value === "ALL" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos os status</SelectItem>
                      {PIPELINE_STAGES.map((stage) => (
                        <SelectItem key={stage} value={stage}>
                          {stage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Seção Falecido */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3 border-b pb-1">Falecido</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {/* Case Name */}
                <div className="space-y-2 xl:col-span-2">
                  <label className="text-sm font-medium text-gray-600">Nome do Falecido</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Buscar por nome..."
                      value={filters.caseName}
                      onChange={(e) => updateFilter('caseName', e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Case CPF */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">CPF do Falecido</label>
                  <Input
                    placeholder="000.000.000-00"
                    value={filters.caseCpf}
                    onChange={(e) => updateFilter('caseCpf', e.target.value)}
                  />
                </div>

                {/* Estado Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">Estado</label>
                  <Select 
                    value={filters.estado || "ALL"} 
                    onValueChange={(value) => updateFilter('estado', value === "ALL" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os estados" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos os estados</SelectItem>
                      {estados.map((estado) => (
                        <SelectItem key={estado} value={estado}>
                          {estado}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Cidade Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">Cidade</label>
                  <Input
                    placeholder="Buscar cidade..."
                    value={filters.cidade}
                    onChange={(e) => updateFilter('cidade', e.target.value)}
                  />
                </div>

                {/* Date From */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">Data Óbito (De)</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => updateFilter('dateFrom', e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Date To */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-600">Data Óbito (Até)</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => updateFilter('dateTo', e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

"use client"

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dashboard } from '@/components/dashboard'
import { Pipeline } from '@/components/pipeline'
import { Leads } from '@/components/leads'
import { LayoutDashboard, Kanban, Settings, Users, ListFilter } from 'lucide-react'

export default function Home() {
  const [activeTab, setActiveTab] = useState('pipeline')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">ObitFinder</h1>
                <p className="text-xs text-gray-500">Pipeline CRM</p>
              </div>
            </div>

            {/* Nav Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="hidden md:block">
              <TabsList className="bg-gray-100">
                <TabsTrigger value="dashboard" className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="pipeline" className="flex items-center gap-2">
                  <Kanban className="h-4 w-4" />
                  Pipeline
                </TabsTrigger>
                <TabsTrigger value="leads" className="flex items-center gap-2">
                  <ListFilter className="h-4 w-4" />
                  Leads
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Right side actions */}
            <div className="flex items-center gap-4">
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <Settings className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden border-t border-gray-100 px-4 py-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full bg-gray-100">
              <TabsTrigger value="dashboard" className="flex-1 flex items-center justify-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="pipeline" className="flex-1 flex items-center justify-center gap-2">
                <Kanban className="h-4 w-4" />
                Pipeline
              </TabsTrigger>
              <TabsTrigger value="leads" className="flex-1 flex items-center justify-center gap-2">
                <ListFilter className="h-4 w-4" />
                Leads
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsContent value="dashboard" className="mt-0">
            <Dashboard />
          </TabsContent>
          <TabsContent value="pipeline" className="mt-0">
            <Pipeline />
          </TabsContent>
          <TabsContent value="leads" className="mt-0">
            <Leads />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 mt-8">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            ObitFinder CRM © {new Date().getFullYear()} - Sistema de Gestão de Leads
          </p>
        </div>
      </footer>
    </div>
  )
}

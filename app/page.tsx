"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dashboard } from '@/components/dashboard'
import { Pipeline } from '@/components/pipeline'
import { Leads } from '@/components/leads'
import { Campaigns } from '@/components/campaigns'
import { useAuth } from '@/components/auth-provider'
import { LayoutDashboard, Kanban, Settings, Users, ListFilter, LogOut, User, Megaphone } from 'lucide-react'

export default function Home() {
  const [activeTab, setActiveTab] = useState('pipeline')
  const { profile, signOut, isLoading, user } = useAuth()
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
    router.refresh()
  }

  // Show loading while auth is being checked
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!user) {
    router.push('/login')
    return null
  }

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
                <TabsTrigger value="campaigns" className="flex items-center gap-2">
                  <Megaphone className="h-4 w-4" />
                  Campanhas
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                    <Settings className="h-5 w-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium">{profile?.full_name || 'User'}</p>
                    <p className="text-xs text-gray-500">{profile?.role}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-red-600 focus:text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Mobile tabs */}
        <div className="md:hidden border-t border-gray-100 px-4 py-2">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full bg-gray-100">
              <TabsTrigger value="dashboard" className="flex-1 flex items-center justify-center gap-1 text-xs">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </TabsTrigger>
              <TabsTrigger value="campaigns" className="flex-1 flex items-center justify-center gap-1 text-xs">
                <Megaphone className="h-4 w-4" />
                Campanhas
              </TabsTrigger>
              <TabsTrigger value="pipeline" className="flex-1 flex items-center justify-center gap-1 text-xs">
                <Kanban className="h-4 w-4" />
                Pipeline
              </TabsTrigger>
              <TabsTrigger value="leads" className="flex-1 flex items-center justify-center gap-1 text-xs">
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
          <TabsContent value="campaigns" className="mt-0">
            <Campaigns />
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

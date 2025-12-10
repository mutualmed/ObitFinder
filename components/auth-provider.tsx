"use client"

import { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react'
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js'
import { Profile } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type AuthContextType = {
  session: Session | null
  user: User | null
  profile: Profile | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  
  // Create supabase client once
  const supabase = useMemo(() => createClient(), [])

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await (supabase
        .from('profiles') as any)
        .select('*')
        .eq('id', userId)
        .single()
      
      if (error) {
        console.error('Error fetching profile:', error)
        return null
      }
      return data as Profile
    } catch (err) {
      console.error('Error fetching profile:', err)
      return null
    }
  }

  useEffect(() => {
    const getSession = async () => {
      // Add timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        console.log('Session check timeout - redirecting to login')
        setSession(null)
        setUser(null)
        setProfile(null)
        setIsLoading(false)
        router.push('/login')
      }, 10000) // 10 second timeout
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        clearTimeout(timeoutId)
        
        if (error) {
          console.error('Session error:', error)
          // Clear stale state and redirect to login
          setSession(null)
          setUser(null)
          setProfile(null)
          setIsLoading(false)
          router.push('/login')
          return
        }
        
        setSession(session)
        setUser(session?.user ?? null)
        
        if (session?.user) {
          const profileData = await fetchProfile(session.user.id)
          setProfile(profileData)
        }
        
        setIsLoading(false)
      } catch (err) {
        clearTimeout(timeoutId)
        console.error('Error getting session:', err)
        setSession(null)
        setUser(null)
        setProfile(null)
        setIsLoading(false)
        router.push('/login')
      }
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      console.log('Auth state changed:', event)
      
      // Handle token refresh errors
      if (event === 'TOKEN_REFRESHED' && !session) {
        console.log('Token refresh failed, redirecting to login')
        setSession(null)
        setUser(null)
        setProfile(null)
        router.push('/login')
        return
      }
      
      // Handle sign out
      if (event === 'SIGNED_OUT') {
        setSession(null)
        setUser(null)
        setProfile(null)
        router.push('/login')
        return
      }
      
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        const profileData = await fetchProfile(session.user.id)
        setProfile(profileData)
      } else {
        setProfile(null)
      }
      
      setIsLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

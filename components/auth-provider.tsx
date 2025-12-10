"use client"

import { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react'
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js'
import { Profile } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'

// Session will be considered stale after 30 minutes of inactivity
const SESSION_STALE_TIME = 30 * 60 * 1000 // 30 minutes

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
  const lastActivityRef = useRef<number>(Date.now())
  const isRefreshingRef = useRef<boolean>(false)
  
  // Create supabase client once
  const supabase = useMemo(() => createClient(), [])
  
  // Update last activity timestamp on user interaction
  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now()
    }
    
    window.addEventListener('click', updateActivity)
    window.addEventListener('keydown', updateActivity)
    window.addEventListener('scroll', updateActivity)
    window.addEventListener('touchstart', updateActivity)
    
    return () => {
      window.removeEventListener('click', updateActivity)
      window.removeEventListener('keydown', updateActivity)
      window.removeEventListener('scroll', updateActivity)
      window.removeEventListener('touchstart', updateActivity)
    }
  }, [])
  
  // Handle visibility change - refresh session when user returns
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && !isRefreshingRef.current) {
        const timeSinceActivity = Date.now() - lastActivityRef.current
        
        // If user has been away for more than the stale time, refresh session
        if (timeSinceActivity > SESSION_STALE_TIME) {
          console.log('Session may be stale, refreshing...')
          isRefreshingRef.current = true
          
          try {
            const { data, error } = await supabase.auth.refreshSession()
            
            if (error || !data.session) {
              console.log('Session refresh failed')
              setSession(null)
              setUser(null)
              setProfile(null)
            } else {
              console.log('Session refreshed successfully')
              setSession(data.session)
              setUser(data.session.user)
              lastActivityRef.current = Date.now()
            }
          } catch (err) {
            console.error('Error refreshing session:', err)
            setSession(null)
            setUser(null)
            setProfile(null)
          } finally {
            isRefreshingRef.current = false
          }
        }
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [supabase])

  const fetchProfile = async (userId: string) => {
    try {
      // Add timeout to profile fetch to prevent hanging
      const fetchPromise = (supabase
        .from('profiles') as any)
        .select('*')
        .eq('id', userId)
        .single()
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
      )
      
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any
      
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
    let mounted = true
    
    // Safety timeout to ensure loading state doesn't get stuck
    const loadingTimeout = setTimeout(() => {
      if (mounted && isLoading) {
        console.warn('Auth loading timed out - forcing completion')
        setIsLoading(false)
        if (!session) {
           // If we timed out and have no session, we might want to ensure we're clear
           setSession(null)
           setUser(null)
           setProfile(null)
        }
      }
    }, 8000) // 8 seconds max loading time

    const getSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (!mounted) return

        if (error) {
          console.error('Session error:', error)
          setSession(null)
          setUser(null)
          setProfile(null)
        } else {
          setSession(session)
          setUser(session?.user ?? null)
          
          if (session?.user) {
            const profileData = await fetchProfile(session.user.id)
            if (mounted) setProfile(profileData)
          }
        }
      } catch (err) {
        console.error('Error getting session:', err)
        if (mounted) {
          setSession(null)
          setUser(null)
          setProfile(null)
        }
      } finally {
        if (mounted) setIsLoading(false)
        clearTimeout(loadingTimeout)
      }
    }

    getSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (!mounted) return
      console.log('Auth state changed:', event)
      
      setSession(session)
      setUser(session?.user ?? null)
      
      if (session?.user) {
        const profileData = await fetchProfile(session.user.id)
        if (mounted) setProfile(profileData)
      } else {
        if (mounted) setProfile(null)
      }
      
      if (mounted) setIsLoading(false)
    })

    return () => {
      mounted = false
      clearTimeout(loadingTimeout)
      subscription.unsubscribe()
    }
  }, [supabase])

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

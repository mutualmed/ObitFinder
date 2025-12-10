"use client"

import { createContext, useContext, useEffect, useState, useMemo, useRef } from 'react'
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js'
import { Profile } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()
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
              console.log('Session refresh failed, redirecting to login')
              setSession(null)
              setUser(null)
              setProfile(null)
              router.push('/login')
              return
            }
            
            console.log('Session refreshed successfully')
            setSession(data.session)
            setUser(data.session.user)
            lastActivityRef.current = Date.now()
          } catch (err) {
            console.error('Error refreshing session:', err)
            router.push('/login')
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
  }, [supabase, router])

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

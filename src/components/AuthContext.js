import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email, password, bakeryName, ownerName) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (!error && data.user) {
      await supabase.from('bakery_profile').insert({
        user_id: data.user.id,
        bakery_name: bakeryName || 'My Bakery',
        owner_name: ownerName || '',
        currency: 'UGX',
        target_margin: 40,
        labor_threshold: 35
      })
      // Create trial subscription
      const trialExpiry = new Date()
      trialExpiry.setDate(trialExpiry.getDate() + 7)
      await supabase.from('subscriptions').insert({
        user_id: data.user.id,
        email,
        status: 'trial',
        expires_at: trialExpiry.toISOString()
      })
    }
    return { data, error }
  }

  const signIn = async (email, password) => {
    return await supabase.auth.signInWithPassword({ email, password })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

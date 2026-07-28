import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { auth, googleProvider } from '../lib/auth'

interface AuthContextValue {
  user: User | null
  loading: boolean
  authError: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })
  }, [])

  async function signIn() {
    setAuthError(null)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Could not sign in.')
    }
  }

  async function signOut() {
    await firebaseSignOut(auth)
  }

  const value = useMemo(
    () => ({ user, loading, authError, signIn, signOut }),
    [user, loading, authError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

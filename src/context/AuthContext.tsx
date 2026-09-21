import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { FirestoreCollections } from '../lib/firestoreCollections'

type UserProfile = {
  nome: string
}

type AuthContextValue = {
  user: User | null
  profile: UserProfile | null
  loading: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })
    return unsubscribeAuth
  }, [])

  useEffect(() => {
    if (!user) {
      setProfile(null)
      return
    }
    const userDoc = doc(db, FirestoreCollections.USERS, user.uid)
    const unsubscribeProfile = onSnapshot(userDoc, (snapshot) => {
      const data = snapshot.data()
      setProfile(data ? { nome: data.nome ?? '' } : null)
    })
    return unsubscribeProfile
  }, [user])

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

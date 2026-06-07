import React from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from './firebase';

export interface SessionUser {
  uid: string;
  displayName?: string | null;
  email?: string | null;
  photoURL?: string | null;
}

const DEV_USER: SessionUser = {
  uid: 'local-dev',
  displayName: 'Local Dev',
  email: null,
  photoURL: null,
};

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  error: string | null;
  isAuthEnabled: boolean;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = React.createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<SessionUser | null>(isFirebaseConfigured ? null : DEV_USER);
  const [loading, setLoading] = React.useState(isFirebaseConfigured);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setUser(DEV_USER);
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, (u: User | null) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const signIn = React.useCallback(async () => {
    if (!isFirebaseConfigured || !auth || !googleProvider) return;
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: any) {
      // User dismissing the popup is not an error worth surfacing.
      if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/cancelled-popup-request') return;
      setError(e?.message || String(e));
    }
  }, []);

  const signOutUser = React.useCallback(async () => {
    if (!isFirebaseConfigured || !auth) return;
    await signOut(auth);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, isAuthEnabled: isFirebaseConfigured, signIn, signOutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

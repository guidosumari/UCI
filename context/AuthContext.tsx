
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
    session: Session | null;
    user: User | null;
    loading: boolean;
    signIn: (email: string) => Promise<{ error: any }>;
    signOut: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        // Fail-safe timeout
        const timeoutId = setTimeout(() => {
            if (mounted && loading) {
                console.warn("Auth check timed out, forcing loading false");
                setLoading(false);
            }
        }, 5000);

        // Check active sessions and sets the user
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (mounted) {
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);
                clearTimeout(timeoutId);
            }
        }).catch((error) => {
            console.error("Auth session check failed:", error);
            if (mounted) {
                setLoading(false);
                clearTimeout(timeoutId);
            }
        });

        // Listen for changes on auth state (logged in, signed out, etc.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (mounted) {
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);
                clearTimeout(timeoutId);
            }
        });

        return () => {
            mounted = false;
            clearTimeout(timeoutId);
            subscription.unsubscribe();
        };
    }, []);

    const signIn = async (email: string) => {
        // For simplicity we use Magic Link, but can upgrade to Password if requested.
        // Actually, standard usually expects password. Let's support password login?
        // The prompt said "login/registro".
        // Let's implement generic email/password for now as it's common.
        // But wait, the context interface just said `signIn`.
        // I'll update the interface to accept password too, or use Magic Link which is easier for setup?
        // Let's implement generic email/password sign in.
        return supabase.auth.signInWithOtp({ email });
    };

    // Wait, I should probably support Sign Up too if I do Password.
    // Magic link is easiest for "Login/Register" combined (just input email).
    // Let's stick to Magic Link for a modern feel unless specific requirements.
    // Actually, let's provide a full method signature just in case.

    const signOut = () => supabase.auth.signOut();

    return (
        <AuthContext.Provider value={{ session, user, loading, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};


import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export const AuthProvider = ({ children }) => {
    const [session, setSession] = useState(null)
    const [profile, setProfile] = useState(null)
    const [loading, setLoading] = useState(true)

    // Master Admin Helper
    const MASTER_ADMIN_EMAIL = 'joaopedro.faggionato@gmail.com'

    const updateLastLogin = async (userId) => {
        try {
            await supabase
                .from('profiles')
                .update({ last_login_at: new Date().toISOString() })
                .eq('id', userId)
        } catch (err) {
            console.error('Error updating last_login_at:', err)
        }
    }

    const fetchProfile = async (id, userEmail) => {
        try {
            // OPTIMIZATION: If it's the master admin, we can set the role immediately 
            // and fetch the rest of the profile info in background
            if (userEmail?.toLowerCase().trim() === MASTER_ADMIN_EMAIL) {
                setProfile(prev => prev || { role: 'admin', email: userEmail })
            }

            // Fire and forget update Last Login
            updateLastLogin(id)

            const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id, email, role, is_suspended, full_name, tax_id, whatsapp, city, state')
                .eq('id', id)
                .maybeSingle()

            if (profileError) {
                console.error('Error in fetchProfile query:', profileError)
                return null
            }

            let { data: subData } = await supabase
                .from('saas_subscriptions')
                .select('status, plan_type, current_period_end, plan_name')
                .eq('user_id', id)
                .maybeSingle()

            // FAILSAFE: If no subscription exists (and not master admin), create a 3-day trial
            if (profileData && !subData && userEmail?.toLowerCase().trim() !== MASTER_ADMIN_EMAIL) {
                const trialEnd = new Date()
                trialEnd.setDate(trialEnd.getDate() + 3)

                const { data: newSub, error: subError } = await supabase
                    .from('saas_subscriptions')
                    .insert([{
                        user_id: id,
                        status: 'trialing',
                        plan_name: 'Período de Teste',
                        current_period_end: trialEnd.toISOString(),
                        billing_cycle: 'monthly',
                        amount_cents: 9990
                    }])
                    .select('status, plan_type, current_period_end, plan_name')
                    .single()

                if (!subError && newSub) {
                    console.log('Auth: Auto-created 3-day trial for user', id)
                    subData = newSub
                } else if (subError) {
                    console.error('Auth: Failed to auto-create trial:', subError)
                }
            }

            if (profileData) {
                // Determine actual access status
                let effectiveStatus = subData?.status || 'incomplete'
                const now = new Date()
                const periodEnd = subData?.current_period_end ? new Date(subData.current_period_end) : null

                // Access Control Logic:
                // 1. active: Has access (unless periodEnd is in the past, but usually Stripe handled)
                // 2. trialing: Has access until periodEnd
                // 3. canceled: Has access until periodEnd

                const hasTimeRemaining = periodEnd && periodEnd > now

                if (effectiveStatus === 'trialing' || effectiveStatus === 'active' || effectiveStatus === 'canceled') {
                    if (periodEnd && periodEnd < now) {
                        effectiveStatus = 'expired'
                    } else {
                        // All these are "active" for the UI/Router access purposes
                        effectiveStatus = 'active'
                    }
                }
                else if (effectiveStatus === 'past_due' && !hasTimeRemaining) {
                    effectiveStatus = 'expired'
                }

                const combinedData = {
                    ...profileData,
                    subscription_status: effectiveStatus,
                    plan_type: subData?.plan_type,
                    plan_name: subData?.plan_name,
                    current_period_end: subData?.current_period_end
                }
                setProfile(combinedData)
                return combinedData
            }
            return null
        } catch (err) {
            console.error('Catch-all error in fetchProfile:', err)
            return null
        }
    }

    useEffect(() => {
        let isMounted = true

        const initAuth = async () => {
            const safetyTimeout = setTimeout(() => {
                if (loading && isMounted) {
                    console.warn('Auth: Safety timeout reached (Initialization bypass)')
                    setLoading(false)
                }
            }, 3000)

            try {
                const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
                if (sessionError) throw sessionError

                if (isMounted) {
                    setSession(currentSession)
                    if (currentSession?.user) {
                        // Priority Check: If master email, unlock loading state IMMEDIATELY
                        if (currentSession.user.email?.toLowerCase().trim() === MASTER_ADMIN_EMAIL) {
                            setLoading(false)
                            clearTimeout(safetyTimeout)
                        }
                        // Non-blocking fetch
                        fetchProfile(currentSession.user.id, currentSession.user.email)
                    }
                }
            } catch (error) {
                console.error('Auth initialization error:', error)
            } finally {
                if (isMounted) {
                    clearTimeout(safetyTimeout)
                    setLoading(false)
                }
            }
        }

        initAuth()

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
            if (!isMounted) return

            console.log('Auth: AuthStateChange event:', event)

            if (event === 'PASSWORD_RECOVERY') {
                console.log('Auth: Password recovery detected, redirecting...')
                window.location.href = '/reset-password'
                return
            }

            setSession(currentSession)
            if (currentSession?.user) {
                if (currentSession.user.email?.toLowerCase().trim() === MASTER_ADMIN_EMAIL) {
                    setLoading(false)
                }
                fetchProfile(currentSession.user.id, currentSession.user.email)
            } else {
                setProfile(null)
            }
            setLoading(false)
        })

        return () => {
            isMounted = false
            subscription.unsubscribe()
        }
    }, [])

    const signOut = async () => {
        try {
            console.log('Auth: Performing aggressive signOut...')
            setSession(null)
            setProfile(null)
            setLoading(false)
            localStorage.clear()
            sessionStorage.clear()
            await supabase.auth.signOut()
            window.location.href = '/login'
        } catch (error) {
            console.error('Error signing out:', error)
            window.location.href = '/login'
        }
    }

    const normalizedEmail = session?.user?.email?.toLowerCase().trim()
    const isMasterAdmin = normalizedEmail === MASTER_ADMIN_EMAIL

    const value = {
        session,
        user: session?.user ?? null,
        profile,
        role: isMasterAdmin ? 'admin' : (profile?.role ?? 'user'),
        isSuspended: isMasterAdmin ? false : (profile?.is_suspended ?? false),
        subscriptionStatus: isMasterAdmin ? 'active' : (profile?.subscription_status ?? 'incomplete'),
        planType: profile?.plan_type,
        loading,
        signOut,
        refreshProfile: () => session?.user ? fetchProfile(session.user.id, session.user.email) : null
    }

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    )
}

import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
    User,
    Lock,
    AlertCircle,
    Save,
    CreditCard,
    LayoutDashboard,
    Home
} from 'lucide-react'

import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useDialog } from '../components/DialogProvider'
import SubscriptionManager from '../components/SubscriptionManager'
import HeaderUserMenu from '../components/HeaderUserMenu'
import logoRisu from '../assets/logo_risu.jpg'

export default function Account() {
    const { user, signOut, subscriptionStatus } = useAuth()
    const { success, error: toastError, confirm } = useDialog()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState('profile') // profile, billing

    const hasActiveSubscription = subscriptionStatus === 'active' || subscriptionStatus === 'trialing'

    // Profile States
    const [profileData, setProfileData] = useState({
        full_name: '',
        avatar_url: ''
    })

    // Password States
    const [passwordData, setPasswordData] = useState({
        new: '',
        confirm: ''
    })

    useEffect(() => {
        if (user) loadProfile()
    }, [user])

    const loadProfile = async () => {
        try {
            setLoading(true)
            const { data: profile, error } = await supabase
                .from('profiles')
                .select('full_name, avatar_url')
                .eq('id', user.id)
                .maybeSingle()

            if (error) {
                console.error('Profile fetch error:', error)
            }

            if (profile) {
                setProfileData({
                    full_name: profile.full_name || '',
                    avatar_url: profile.avatar_url || ''
                })
            } else {
                // Fallback to auth user metadata
                setProfileData({
                    full_name: user?.user_metadata?.full_name || '',
                    avatar_url: ''
                })
            }
        } catch (err) {
            console.error('Error loading profile:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleSaveProfile = async (e) => {
        e.preventDefault()
        try {
            setLoading(true)
            const { error } = await supabase
                .from('profiles')
                .update({ full_name: profileData.full_name })
                .eq('id', user.id)

            if (error) throw error
            success('Perfil atualizado!')
        } catch (err) {
            toastError('Erro ao salvar perfil')
        } finally {
            setLoading(false)
        }
    }

    const handleChangePassword = async (e) => {
        e.preventDefault()
        if (passwordData.new !== passwordData.confirm) return toastError('As senhas não conferem')

        try {
            setLoading(true)
            const { error } = await supabase.auth.updateUser({ password: passwordData.new })
            if (error) throw error
            success('Senha alterada com sucesso!')
            setPasswordData({ new: '', confirm: '' })
        } catch (err) {
            toastError('Erro ao alterar senha: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleDeleteAccount = async () => {
        const isConfirmed = await confirm({
            title: 'Tem certeza absoluta?',
            message: 'Todos os seus imóveis, inquilinos, contratos e pagamentos serão apagados permanentemente. Não há como desfazer.',
            confirmText: 'Sim, excluir tudo',
            cancelText: 'Cancelar',
            type: 'danger'
        })

        if (isConfirmed) {
            try {
                setLoading(true)

                // DEBUG: Usando fetch manual para ver o erro real
                const { data: { session } } = await supabase.auth.getSession()
                if (!session) throw new Error('Sem sessão ativa')

                const response = await fetch('https://lrkbmpdnowciyfvvlotl.supabase.co/functions/v1/delete-account', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json'
                    }
                })

                if (!response.ok) {
                    const errorText = await response.text()
                    console.error('DEBUG: Response Body:', errorText)
                    let errorMessage = 'Erro desconhecido'
                    try {
                        const json = JSON.parse(errorText)
                        errorMessage = json.error || errorText
                    } catch (e) {
                        errorMessage = errorText
                    }
                    throw new Error(`Erro do Servidor (${response.status}): ${errorMessage}`)
                }

                await signOut()
                window.location.href = '/'
            } catch (err) {
                console.error(err)
                await alert(`DETALHE DO ERRO:\n\n${err.message}`, 'Debug do Erro')
            } finally {
                setLoading(false)
            }
        }
    }

    return (
        <div className="min-h-screen bg-slate-50 font-sans selection:bg-primary/20">
            {/* Header Standalone */}
            <header className="fixed w-full top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                        <img src={logoRisu} alt="Risu Logo" className="h-8 w-auto mix-blend-multiply" />
                    </Link>
                    <nav className="hidden md:flex gap-8">
                        {hasActiveSubscription ? (
                            <Link to="/dashboard" className="flex items-center gap-2 text-sm font-bold text-[#13283b] hover:opacity-70 transition-colors">
                                <LayoutDashboard size={16} />
                                Voltar para o Dashboard
                            </Link>
                        ) : (
                            <Link to="/" className="flex items-center gap-2 text-sm font-bold text-[#13283b] hover:opacity-70 transition-colors">
                                <Home size={16} />
                                Voltar para o Início
                            </Link>
                        )}
                    </nav>
                    <div className="flex items-center gap-6">
                        {user && <HeaderUserMenu />}
                    </div>
                </div>
            </header>

            <main className="pt-32 pb-20 px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-10 text-center md:text-left flex flex-col md:flex-row md:items-end justify-between gap-4">
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black text-[#13283b] tracking-tighter mb-2">
                                Minha Conta
                            </h1>
                            <p className="text-slate-500 font-medium">
                                Gerencie seus dados pessoais, senha e assinatura.
                            </p>
                        </div>

                        {/* Tabs */}
                        <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'profile' ? 'bg-[#13283b] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                <User size={16} /> Perfil
                            </button>
                            <button
                                onClick={() => setActiveTab('billing')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${activeTab === 'billing' ? 'bg-[#13283b] text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                <CreditCard size={16} /> Assinatura
                            </button>
                        </div>
                    </div>

                    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-200/50 border border-slate-100 animate-fadeIn">

                        {/* Tab: PROFILE */}
                        {activeTab === 'profile' && (
                            <div className="space-y-10">
                                {/* Personal Info */}
                                <section>
                                    <h3 className="text-lg font-black text-[#13283b] mb-6 flex items-center gap-2 border-b border-slate-100 pb-2">
                                        <User size={20} className="text-blue-500" /> Dados Pessoais
                                    </h3>
                                    <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Nome Completo</label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-[#13283b] outline-none focus:border-[#13283b] transition-colors"
                                                value={profileData.full_name}
                                                onChange={e => setProfileData({ ...profileData, full_name: e.target.value })}
                                            />
                                        </div>
                                        <div className="opacity-60 cursor-not-allowed">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Email (Login)</label>
                                            <input
                                                type="email"
                                                disabled
                                                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-500 outline-none"
                                                value={user?.email}
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <button type="submit" disabled={loading} className="px-6 py-3 bg-[#13283b] text-white rounded-xl font-bold text-sm hover:shadow-lg transition-all flex items-center gap-2">
                                                <Save size={18} /> Salvar Alterações
                                            </button>
                                        </div>
                                    </form>
                                </section>

                                {/* Security */}
                                <section>
                                    <h3 className="text-lg font-black text-[#13283b] mb-6 flex items-center gap-2 border-b border-slate-100 pb-2">
                                        <Lock size={20} className="text-amber-500" /> Segurança
                                    </h3>
                                    <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg bg-amber-50/50 p-6 rounded-2xl border border-amber-100">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-amber-800/60 mb-1 block">Nova Senha</label>
                                            <input
                                                type="password"
                                                placeholder="Mínimo 6 caracteres"
                                                className="w-full bg-white border border-amber-200 rounded-xl px-4 py-3 text-sm font-bold text-amber-900 outline-none focus:border-amber-500 transition-colors"
                                                value={passwordData.new}
                                                onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-amber-800/60 mb-1 block">Confirmar Senha</label>
                                            <input
                                                type="password"
                                                placeholder="Repita a nova senha"
                                                className="w-full bg-white border border-amber-200 rounded-xl px-4 py-3 text-sm font-bold text-amber-900 outline-none focus:border-amber-500 transition-colors"
                                                value={passwordData.confirm}
                                                onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                            />
                                        </div>
                                        <button type="submit" disabled={loading} className="w-full px-6 py-3 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition-all shadow-md shadow-amber-200">
                                            Atualizar Senha
                                        </button>
                                    </form>
                                </section>

                                {/* Danger Zone */}
                                <section className="pt-8">
                                    <div className="border border-red-100 bg-red-50 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                                        <div>
                                            <h4 className="font-bold text-red-700 flex items-center gap-2 mb-1">
                                                <AlertCircle size={18} /> Zona de Perigo
                                            </h4>
                                            <p className="text-sm text-red-600/80 max-w-md">
                                                Ao excluir sua conta, todos os seus contratos, imóveis, faturas e dados de inquilinos serão <strong className="font-black">apagados permanentemente</strong>.
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleDeleteAccount}
                                            className="whitespace-nowrap px-6 py-3 bg-white border-2 border-red-200 text-red-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white hover:border-red-600 transition-all shadow-sm"
                                        >
                                            Excluir Conta
                                        </button>
                                    </div>
                                </section>
                            </div>
                        )}

                        {/* Tab: BILLING */}
                        {activeTab === 'billing' && (
                            <div className="animate-fadeIn">
                                <SubscriptionManager user={user} />
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    )
}

import React from 'react'
import { Link } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import SubscriptionManager from '../components/SubscriptionManager'
import HeaderUserMenu from '../components/HeaderUserMenu'
import logoRisu from '../assets/logo_risu.jpg'

export default function Billing() {
    const { user } = useAuth()

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#0a1118] font-sans selection:bg-primary/20">
            {/* Header */}
            <header className="fixed w-full top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
                        <img src={logoRisu} alt="Risu Logo" className="h-8 w-auto mix-blend-multiply" />
                    </Link>
                    <nav className="hidden md:flex gap-8">
                        <Link to="/" className="text-sm font-bold text-slate-500 hover:text-[#13283b] dark:hover:text-white transition-colors">Início</Link>
                    </nav>
                    <div className="flex items-center gap-6">
                        {user && <HeaderUserMenu />}
                    </div>
                </div>
            </header>

            <main className="pt-32 pb-20 px-6">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-10 text-center md:text-left">
                        <h1 className="text-3xl md:text-4xl font-black text-[#13283b] dark:text-white tracking-tighter mb-2">
                            Gerenciar Assinatura
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">
                            Visualize seu plano atual, histórico e opções de pagamento.
                        </p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800">
                        <SubscriptionManager user={user} />
                    </div>
                </div>
            </main>
        </div>
    )
}

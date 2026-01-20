import React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
    Check,
    X,
    Calendar,
    Package,
    Users,
    Truck,
    MessageCircle,
    BarChart3,
    DollarSign,
    ArrowRight,
    FileText,
    Settings,
    LayoutDashboard,
    AlertCircle,
    Zap
} from 'lucide-react'
import logoRisu from '../assets/logo_risu.jpg'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useState, useEffect } from 'react'
import HeaderUserMenu from '../components/HeaderUserMenu'

export default function Landing() {
    const navigate = useNavigate()
    const { user, loading: authLoading } = useAuth()
    const [subscriptionStatus, setSubscriptionStatus] = useState(null)
    const [loadingSub, setLoadingSub] = useState(false)

    useEffect(() => {
        if (user) {
            checkSubscription()
        }
    }, [user])

    const checkSubscription = async () => {
        try {
            setLoadingSub(true)
            const { data, error } = await supabase
                .from('saas_subscriptions')
                .select('status')
                .eq('user_id', user.id)
                .maybeSingle()

            if (data) {
                setSubscriptionStatus(data.status)
            }
        } catch (error) {
            console.error('Error checking subscription:', error)
        } finally {
            setLoadingSub(false)
        }
    }

    const benefits = [
        { icon: <DollarSign className="text-primary" />, title: "Orçamentos Rápidos", desc: "Crie e envie propostas profissionais em segundos." },
        { icon: <BarChart3 className="text-primary" />, title: "Controle Financeiro Completo", desc: "Saiba exatamente quanto entra e sai do seu caixa." },
        { icon: <AlertCircle className="text-primary" />, title: "Impostos e Taxas Visíveis", desc: "Clareza total sobre o custo fiscal da sua operação." },
        { icon: <Calendar className="text-primary" />, title: "Custos Recorrentes Organizados", desc: "Mapeie suas despesas fixas e evite surpresas." },
        { icon: <Package className="text-primary" />, title: "Relatórios Claros", desc: "Entenda o desempenho do seu negócio com dados reais." }
    ]

    const features = [
        "Orçamentos Inteligentes",
        "Controle Financeiro",
        "Gestão de Contratos",
        "Custos Recorrentes",
        "Suporte Integrado",
        "Configurações Avançadas"
    ]

    const pains = [
        "Perda de controle financeiro",
        "Orçamentos bagunçados",
        "Atrasos sem cobrança correta",
        "Custos invisíveis",
        "Falta de visão de lucro"
    ]

    return (
        <div className="min-h-screen bg-white font-sans text-[#13283b] selection:bg-primary/20">
            {/* 1. NAVBAR */}
            <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <img src={logoRisu} alt="Risu Logo" className="h-8 w-auto mix-blend-multiply" />
                    </Link>


                    <div className="flex items-center gap-6">
                        {!user ? (
                            <>
                                <button
                                    onClick={() => navigate('/login')}
                                    className="text-xs font-black uppercase tracking-widest text-[#13283b] hover:opacity-70 transition-opacity"
                                >
                                    Entrar
                                </button>
                                <button
                                    onClick={() => navigate('/signup')}
                                    className="text-xs font-black uppercase tracking-widest text-[#13283b] hover:opacity-70 transition-opacity"
                                >
                                    Cadastrar
                                </button>
                            </>
                        ) : (
                            <HeaderUserMenu />
                        )}
                    </div>
                </div>
            </nav >

            {/* 2. HERO SECTION */}
            < section className="pt-32 pb-20 px-6 bg-[#13283b] text-white" >
                <div className="max-w-4xl mx-auto text-center">
                    <span className="inline-block px-4 py-1.5 bg-white/10 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6 animate-fade-in">
                        Gestão de Locações Moderna
                    </span>
                    <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight">
                        Controle total da sua locação, do orçamento ao financeiro.
                    </h1>
                    <p className="text-lg md:text-xl opacity-80 mb-10 max-w-2xl mx-auto font-medium">
                        O Risu é o sistema simples e completo para quem aluga equipamentos e quer parar de perder dinheiro.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <button
                            onClick={() => navigate('/signup')}
                            className="bg-[#e7e9e8] text-[#13283b] text-sm font-black uppercase tracking-widest px-10 py-5 rounded-xl shadow-2xl hover:bg-white transition-all transform hover:-translate-y-1 flex flex-col items-center leading-none"
                        >
                            <span>🚀 Começar Teste Grátis</span>
                            <span className="text-[9px] mt-1 opacity-60">3 dias • Sem cartão</span>
                        </button>
                        <button
                            onClick={() => navigate('/pricing')}
                            className="bg-transparent border border-white/20 text-white text-sm font-black uppercase tracking-widest px-10 py-5 rounded-xl hover:bg-white/10 transition-all"
                        >
                            👉 Ver preços
                        </button>
                    </div>
                </div>
            </section >

            {/* 3. O PROBLEMA (DOR) */}
            < section className="py-24 px-6" >
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-4">
                            Você enfrenta esses problemas?
                        </h2>
                        <div className="w-20 h-1 bg-[#13283b] mx-auto"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {pains.map((pain, i) => (
                            <div key={i} className="flex items-start gap-3 p-6 rounded-2xl border border-slate-100 bg-slate-50/50">
                                <X className="text-red-500 mt-1 shrink-0" size={18} />
                                <span className="font-bold text-sm leading-snug">{pain}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section >

            {/* 4. A SOLUÇÃO (PRODUTO) */}
            < section id="solucao" className="py-24 px-6 bg-slate-50" >
                <div className="max-w-6xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <span className="text-primary font-black uppercase tracking-widest text-xs mb-4 block">A Solução Risu</span>
                            <h2 className="text-3xl md:text-4xl font-black mb-6 leading-tight">
                                Tudo o que você precisa para crescer
                            </h2>
                            <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                                Transforme a gestão da sua locadora com ferramentas que trazem clareza e controle para o seu dia a dia.
                            </p>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-[#13283b] text-white flex items-center justify-center shrink-0">
                                        <Check size={16} />
                                    </div>
                                    <span className="font-bold">Controle financeiro na ponta do lápis</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-[#13283b] text-white flex items-center justify-center shrink-0">
                                        <Check size={16} />
                                    </div>
                                    <span className="font-bold">Adeus aos orçamentos perdidos</span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {benefits.map((b, i) => (
                                <div key={i} className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow flex items-start gap-4">
                                    <div className="p-3 bg-slate-50 rounded-xl shrink-0 text-primary">
                                        {b.icon}
                                    </div>
                                    <div>
                                        <h3 className="font-black text-sm mb-1 uppercase text-[#13283b]">{b.title}</h3>
                                        <p className="text-xs text-slate-500 leading-relaxed font-medium">{b.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section >

            {/* 5. FUNCIONALIDADES */}
            < section id="funcionalidades" className="py-24 px-6" >
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-4 text-center">
                            Funcionalidades Poderosas
                        </h2>
                        <p className="text-slate-500 uppercase tracking-widest text-[10px] font-black">O que o sistema entrega</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                        {features.map((f, i) => (
                            <div key={i} className="flex flex-col items-center justify-center p-8 border border-slate-100 rounded-2xl bg-white text-center hover:border-primary/20 hover:shadow-lg transition-all group">
                                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-[#13283b] mb-4 group-hover:scale-110 transition-transform">
                                    <Check size={24} />
                                </div>
                                <span className="text-sm font-black uppercase tracking-tight text-[#13283b]">{f}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section >



            {/* 7. PARA QUEM É */}
            < section className="py-24 px-6 border-b border-slate-100" >
                <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                    <div>
                        <h2 className="text-3xl font-black uppercase tracking-tight mb-6">Para quem é o Risu?</h2>
                        <p className="text-slate-600 mb-8 leading-relaxed font-medium">
                            Desenvolvemos nossa plataforma pensando nas necessidades reais de quem trabalha com locação.
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                        {[
                            "Locadoras de equipamentos",
                            "Empresas de eventos",
                            "Prestadores de serviço",
                            "Pequenas e médias empresas"
                        ].map((target, i) => (
                            <div key={i} className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-xl hover:border-primary/30 transition-colors">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                    <Users size={16} />
                                </div>
                                <span className="font-black text-sm uppercase tracking-tight">{target}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section >

            {/* 8. CHAMADA FINAL */}
            <section className="py-32 px-6 text-center">
                <div className="max-w-2xl mx-auto">
                    {user ? (
                        <>
                            <h2 className="text-4xl md:text-5xl font-black mb-8 leading-tight">Pronto para começar?</h2>
                            <p className="text-lg text-slate-500 mb-12 font-medium">Ative sua assinatura e tenha acesso completo a todas as funcionalidades.</p>
                            <button
                                onClick={() => navigate('/pricing')}
                                className="bg-[#13283b] text-white text-base font-black uppercase tracking-widest px-16 py-6 rounded-2xl shadow-2xl hover:scale-110 transition-transform flex items-center gap-3 mx-auto"
                            >
                                Ver Planos
                                <ArrowRight size={20} />
                            </button>
                        </>
                    ) : (
                        <>
                            <h2 className="text-4xl md:text-5xl font-black mb-8 leading-tight">Comece a controlar sua locadora hoje</h2>
                            <p className="text-lg text-slate-500 mb-12 font-medium">Junte-se a quem já parou de perder dinheiro com a desorganização.</p>
                            <button
                                onClick={() => navigate('/signup')}
                                className="bg-[#13283b] text-white text-base font-black uppercase tracking-widest px-16 py-6 rounded-2xl shadow-2xl hover:scale-110 transition-transform flex flex-col items-center gap-1 mx-auto"
                            >
                                <div className="flex items-center gap-3">
                                    Começar meu Teste
                                    <ArrowRight size={20} />
                                </div>
                                <span className="text-[10px] opacity-60">3 dias grátis • Sem cartão de crédito</span>
                            </button>
                            <p className="mt-8 text-xs text-slate-400 font-bold uppercase tracking-widest">
                                Acesso imediato • Cancele quando quiser
                            </p>
                        </>
                    )}
                </div>
            </section>

            {/* FOOTER */}
            < footer className="py-12 border-t border-slate-100 px-6" >
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <img src={logoRisu} alt="Risu Logo" className="h-6 opacity-30 grayscale mix-blend-multiply" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        &copy; 2026 Risu Tecnologia. Todos os direitos reservados.
                    </p>
                    <div className="flex gap-6 opacity-40 text-[10px] font-black uppercase tracking-widest">
                        <a href="#" className="hover:opacity-100">Termos</a>
                        <a href="#" className="hover:opacity-100">Privacidade</a>
                    </div>
                </div>
            </footer >
        </div >
    )
}

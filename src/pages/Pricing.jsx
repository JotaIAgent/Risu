import { useNavigate } from 'react-router-dom'
import { Check, ShieldCheck, X, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import HeaderUserMenu from '../components/HeaderUserMenu'
import logoRisu from '../assets/logo_risu.jpg'

export default function Pricing() {
    const { user } = useAuth()
    const navigate = useNavigate()

    const plans = [
        {
            id: 'monthly',
            name: 'Mensal',
            price: '99,90',
            period: 'mês',
            billingText: 'Cobrado mensalmente',
            highlight: false,
            stripePriceId: 'price_1SqHrZJrvxBiHEjISBIjF1Xg'
        },
        {
            id: 'quarterly',
            name: 'Trimestral',
            price: '89,90',
            period: 'mês',
            billingText: 'Cobrança única de R$ 269,70',
            highlight: false,
            stripePriceId: 'price_1SqHtTJrvxBiHEjIgyTx6ECr'
        },
        {
            id: 'semiannual',
            name: 'Semestral',
            price: '79,90',
            period: 'mês',
            billingText: 'Cobrança única de R$ 479,40',
            highlight: false,
            stripePriceId: 'price_1SqHu6JrvxBiHEjIcFJOrE7Y'
        },
        {
            id: 'annual',
            name: 'Anual',
            price: '69,90',
            period: 'mês',
            billingText: 'Cobrança única de R$ 838,80',
            highlight: true,
            badge: 'Mais Vantajoso',
            stripePriceId: 'price_1SqHuVJrvxBiHEjIUNJCWLFm'
        }
    ]

    const features = [
        'Acesso total ao sistema',
        'Orçamentos ilimitados',
        'Controle financeiro',
        'Custos recorrentes',
        'Suporte prioritário',
        'Atualizações constantes'
    ]

    const handleSubscribe = async (priceId) => {
        console.log('DEBUG: Supabase Key:', import.meta.env.VITE_SUPABASE_ANON_KEY?.slice(0, 10))
        if (!user) {
            navigate('/signup')
            return
        }

        try {
            const { data, error } = await supabase.functions.invoke('create-checkout', {
                body: {
                    priceId,
                    successUrl: window.location.origin + '/dashboard?session_id={CHECKOUT_SESSION_ID}',
                    cancelUrl: window.location.href,
                }
            })

            if (error) throw error
            if (data?.url) window.location.href = data.url
        } catch (error) {
            console.error('Error creating checkout:', error)
            alert('Erro ao iniciar pagamento. Tente novamente.')
        }
    }

    return (
        <div className="min-h-screen bg-white font-sans text-[#13283b] selection:bg-primary/20">
            {/* 1. NAVBAR */}
            <nav className="fixed w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2">
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
            </nav>

            {/* 2. HERO SECTION (WHITE) */}
            <section className="pt-40 pb-20 px-6 text-center">
                <div className="max-w-4xl mx-auto">
                    <span className="inline-block px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6 animate-fade-in">
                        Investimento Inteligente
                    </span>
                    <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight text-[#13283b]">
                        Teste Grátis por 3 dias.<br /><span className="text-blue-600">Sem cartão de crédito.</span>
                    </h1>
                    <p className="text-lg md:text-xl opacity-80 mb-10 max-w-2xl mx-auto font-medium text-slate-600">
                        Crie sua conta agora e use o sistema completo por 3 dias. Só assine se gostar da experiência.
                    </p>
                </div>
            </section>

            {/* 3. PRICING GRID (BLUE CARDS) */}
            <section className="pb-32 px-6">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {plans.map((plan) => (
                        <div
                            key={plan.id}
                            className={`relative p-8 rounded-[2.5rem] flex flex-col transition-all duration-300 bg-[#13283b] text-white ${plan.highlight
                                ? 'shadow-2xl scale-105 z-10 ring-4 ring-blue-500/30'
                                : 'hover:scale-[1.02] hover:shadow-xl opacity-95 hover:opacity-100'
                                }`}
                        >
                            {plan.highlight && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-white text-[#13283b] px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
                                    <Star size={12} fill="currentColor" /> {plan.badge}
                                </div>
                            )}

                            <div className="mb-8">
                                <h3 className="text-lg font-black uppercase tracking-widest mb-4 text-white">
                                    {plan.name}
                                </h3>
                                <div className="flex items-baseline gap-1 mb-2">
                                    <span className="text-sm font-bold text-blue-200">R$</span>
                                    <span className="text-5xl font-black tracking-tighter text-white">
                                        {plan.price}
                                    </span>
                                    <span className="text-sm font-bold text-blue-200">/{plan.period}</span>
                                </div>
                                <p className="text-xs font-medium text-blue-200">
                                    {plan.billingText}
                                </p>
                            </div>

                            <ul className="space-y-4 mb-8 flex-1">
                                {features.map((feature, i) => (
                                    <li key={i} className="flex items-start gap-3">
                                        <Check size={18} className="shrink-0 text-blue-400" strokeWidth={3} />
                                        <span className="text-sm font-bold text-slate-300">
                                            {feature}
                                        </span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => handleSubscribe(plan.stripePriceId)}
                                className="w-full py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:scale-105 bg-white text-[#13283b] hover:bg-blue-50"
                            >
                                {user ? 'Assinar Agora' : 'Cadastrar'}
                            </button>
                        </div>
                    ))}
                </div>

                {/* Important Notices */}
                <div className="max-w-4xl mx-auto mt-24 bg-slate-50 rounded-[3rem] p-12 border border-slate-100">
                    <h3 className="text-xl font-black text-[#13283b] uppercase tracking-tighter mb-8 text-center">
                        Transparência Total
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
                                <Zap size={24} strokeWidth={3} />
                            </div>
                            <div>
                                <h4 className="font-bold text-[#13283b] mb-2">3 Dias Grátis</h4>
                                <p className="text-xs text-slate-500 leading-relaxed">Liberação imediata no cadastro. Sem pedir cartão ou compromisso.</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-500">
                                <ShieldCheck size={24} strokeWidth={3} />
                            </div>
                            <div>
                                <h4 className="font-bold text-[#13283b] mb-2">Sem Taxas Escondidas</h4>
                                <p className="text-xs text-slate-500 leading-relaxed">O valor que você vê é o valor que você paga. Simples assim.</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-500">
                                <Check size={24} strokeWidth={3} />
                            </div>
                            <div>
                                <h4 className="font-bold text-[#13283b] mb-2">Cancelamento Fácil</h4>
                                <p className="text-xs text-slate-500 leading-relaxed">Cancele quando quiser diretamente no painel, sem burocracia.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* FOOTER */}
            <footer className="py-12 border-t border-slate-100 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
                    <img src={logoRisu} alt="Risu Logo" className="h-6 opacity-30 grayscale mix-blend-multiply" />
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        &copy; 2026 Risu Tecnologia. Todos os direitos reservados.
                    </p>
                    <div className="flex gap-6 opacity-40 text-[10px] font-black uppercase tracking-widest text-[#13283b]">
                        <a href="#" className="hover:opacity-100 hover:text-blue-600 transition-colors">Termos</a>
                        <a href="#" className="hover:opacity-100 hover:text-blue-600 transition-colors">Privacidade</a>
                    </div>
                </div>
            </footer>
        </div>
    )
}

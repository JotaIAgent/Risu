import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { CreditCard, Receipt, AlertCircle, Calendar, Download, History, CheckCircle2, XCircle, ArrowUpCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'

export default function SubscriptionManager({ user }) {
    const { refreshProfile } = useAuth()
    const [subscriptionData, setSubscriptionData] = useState(null)
    const [billingInfo, setBillingInfo] = useState(null)
    const [loading, setLoading] = useState(true)
    const [loadingBilling, setLoadingBilling] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        if (user) {
            loadSubscription()
            loadBillingInfo()
        }
    }, [user])

    const loadSubscription = async () => {
        try {
            setLoading(true)
            const { data: sub } = await supabase
                .from('saas_subscriptions')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle()

            if (sub) {
                setSubscriptionData(sub)
            }
        } catch (err) {
            console.error('Error loading subscription:', err)
        } finally {
            setLoading(false)
        }
    }

    const loadBillingInfo = async () => {
        try {
            setLoadingBilling(true)
            const { data, error } = await supabase.functions.invoke('get-billing-info')

            if (!error && data) {
                setBillingInfo(data)
                if (data.planName || data.nextBillingDate) {
                    setSubscriptionData(prev => {
                        const base = prev || {
                            user_id: user.id,
                            plan_name: data.planName,
                            status: data.subscriptionStatus,
                            current_period_end: data.nextBillingDate
                        }
                        return {
                            ...base,
                            current_period_end: data.nextBillingDate || base.current_period_end,
                            status: data.subscriptionStatus || base.status,
                            plan_name: data.planName || base.plan_name
                        }
                    })
                    if (refreshProfile) refreshProfile()
                }
            }
        } catch (err) {
            console.error('Error loading billing info:', err)
        } finally {
            setLoadingBilling(false)
        }
    }

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount)
    }

    const formatDate = (dateString) => {
        if (!dateString) return '-'
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const getSubscriptionStatus = () => {
        const status = subscriptionData?.status
        const periodEnd = subscriptionData?.current_period_end
        const now = new Date()

        const isExpired = periodEnd && new Date(periodEnd) < now

        if (isExpired && status !== 'active' && status !== 'trialing') {
            return { label: 'Expirado', class: 'bg-slate-500 text-white', isActive: false, isExpired: true }
        }

        switch (status) {
            case 'active':
                return { label: 'Ativo', class: 'bg-green-500 text-white', isActive: true, isExpired: false }
            case 'trialing':
                return { label: 'Período de Teste', class: 'bg-blue-500 text-white', isActive: true, isExpired: false }
            case 'canceled':
                // Check if still has access
                const hasAccess = periodEnd && new Date(periodEnd) > now
                return {
                    label: hasAccess ? 'Acesso até expiração' : 'Cancelado',
                    class: hasAccess ? 'bg-orange-500 text-white' : 'bg-red-500 text-white',
                    isActive: hasAccess,
                    isExpired: !hasAccess,
                    isCanceled: true
                }
            case 'past_due':
                return { label: 'Pagamento Pendente', class: 'bg-yellow-500 text-white', isActive: false, isExpired: false }
            default:
                return { label: 'Inativo', class: 'bg-slate-400 text-white', isActive: false, isExpired: false }
        }
    }

    const subscriptionStatus = getSubscriptionStatus()

    const rawTimeline = [
        ...(billingInfo?.invoices || []).map(i => ({ ...i, category: 'payment', created: i.created })),
        ...(billingInfo?.events || []).map(e => ({ ...e, category: 'event', created: e.created }))
    ];

    const timeline = rawTimeline.sort((a, b) => new Date(b.created) - new Date(a.created))

    if (loading) return <div className="p-8 text-center text-slate-400">Carregando informações da assinatura...</div>

    return (
        <div className="space-y-8 animate-fadeIn">
            <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                    <CreditCard size={32} />
                </div>
                <div>
                    <h2 className="text-xl font-black text-[#13283b]">Sua Assinatura</h2>
                    <p className="text-slate-400 text-sm font-medium">Gerencie seu plano, faturas e histórico.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-[#13283b] text-white rounded-2xl shadow-xl relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 mb-1">Status da Conta</p>
                        <h3 className="text-2xl font-black mb-4 flex items-center gap-2">
                            {(subscriptionStatus.isActive || subscriptionStatus.isCanceled) ? (subscriptionData?.plan_name || 'Risu Mensal') : 'Sem Assinatura'}
                        </h3>

                        <div className="flex flex-wrap gap-2 mb-6">
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${subscriptionStatus.class}`}>
                                {subscriptionStatus.label}
                            </span>
                            {subscriptionData?.current_period_end && (
                                <span className="bg-white/10 px-3 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5">
                                    <Calendar size={12} />
                                    {subscriptionData.status === 'active' ? 'Renovação:' : 'Acesso até:'} {new Date(subscriptionData.current_period_end).toLocaleDateString('pt-BR')}
                                </span>
                            )}
                        </div>

                        <button
                            onClick={async () => {
                                try {
                                    const { data, error } = await supabase.functions.invoke('create-portal', {
                                        body: { returnUrl: window.location.href }
                                    })
                                    if (error) throw error
                                    if (data?.url) window.location.href = data.url
                                } catch (err) {
                                    console.error('Portal error:', err)
                                    alert('Não foi possível acessar o portal de gerenciamento.')
                                }
                            }}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-900/20"
                        >
                            Gerenciar Assinatura & Pagamentos
                        </button>
                    </div>
                    <div className="absolute -top-10 -right-10 p-12 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity rotate-12">
                        <CreditCard size={200} />
                    </div>
                </div>

                <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col justify-between group">
                    <div>
                        <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-slate-400 mb-4 group-hover:text-blue-500 transition-colors">
                            <History size={20} />
                        </div>
                        <h4 className="font-black text-[#13283b] mb-1">Alterar Plano?</h4>
                        <p className="text-xs text-slate-500 leading-relaxed mb-6">
                            Você pode mudar seu ciclo de cobrança ou fazer upgrade a qualquer momento.
                        </p>
                    </div>
                    <button
                        onClick={() => navigate('/pricing')}
                        className="w-full bg-white border border-slate-200 text-[#13283b] hover:border-blue-200 hover:text-blue-600 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                    >
                        Ver Planos Disponíveis
                    </button>
                </div>
            </div>

            <div className="space-y-6">
                <div className="flex items-center justify-between px-1">
                    <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-[0.2em] flex items-center gap-2">
                        <Receipt size={14} /> Histórico de Atividades e Pagamentos
                    </h3>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    {loadingBilling ? (
                        <div className="p-12 text-center text-slate-400">
                            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                            <p className="text-xs font-bold uppercase tracking-widest">Sincronizando com Stripe...</p>
                        </div>
                    ) : timeline.length > 0 ? (
                        <div className="divide-y divide-slate-100">
                            {timeline.map((item) => (
                                <div key={item.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.category === 'payment' ? 'bg-green-50 text-green-600' :
                                                item.eventType === 'canceled' ? 'bg-red-50 text-red-600' :
                                                    item.eventType === 'cancellation_scheduled' ? 'bg-orange-50 text-orange-600' :
                                                        item.eventType === 'reactivated' ? 'bg-blue-50 text-blue-600' :
                                                            item.eventType === 'subscribed' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-500'
                                            }`}>
                                            {item.category === 'payment' ? <CheckCircle2 size={18} /> :
                                                item.eventType === 'canceled' ? <XCircle size={18} /> :
                                                    item.eventType === 'cancellation_scheduled' ? <AlertCircle size={18} /> :
                                                        <ArrowUpCircle size={18} />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm text-[#13283b] mb-0.5">{item.description}</p>
                                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{formatDate(item.created)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        {item.amount && (
                                            <span className="font-black text-sm text-[#13283b]">{formatCurrency(item.amount)}</span>
                                        )}
                                        {item.pdfUrl ? (
                                            <a
                                                href={item.pdfUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-8 h-8 flex items-center justify-center bg-slate-100 text-slate-400 hover:bg-blue-600 hover:text-white rounded-lg transition-all"
                                                title="Baixar Nota"
                                            >
                                                <Download size={14} />
                                            </a>
                                        ) : (
                                            <div className="w-8 h-8"></div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="p-12 text-center">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
                                <History size={32} />
                            </div>
                            <p className="text-sm text-slate-400 font-medium italic">Nenhuma atividade registrada ainda.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="pt-4 flex justify-center">
                <button
                    onClick={async () => {
                        try {
                            const { data, error } = await supabase.functions.invoke('create-portal', {
                                body: { returnUrl: window.location.href }
                            })
                            if (error) throw error
                            if (data?.url) window.location.href = data.url
                        } catch (err) {
                            console.error('Portal error:', err)
                        }
                    }}
                    className="text-red-400 hover:text-red-600 text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 group"
                >
                    <AlertCircle size={14} className="group-hover:animate-pulse" />
                    Quero cancelar minha assinatura
                </button>
            </div>
        </div>
    )
}

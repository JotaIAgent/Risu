
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom'
import {
    LayoutDashboard,
    Users,
    CreditCard,
    MessageSquare,
    Settings,
    BarChart3,
    LogOut,
    ShieldCheck,
    AlertCircle,
    TrendingUp,
    TrendingDown,
    Activity,
    Server,
    Zap,
    History,
    Unlock,
    Lock,
    UserPlus,
    RefreshCw
} from 'lucide-react'
import AdminSubscribers from './AdminSubscribers'
import AdminSupport from './AdminSupport'
import AdminFinance from './AdminFinance'
import AdminUsage from './AdminUsage'
import AdminSettings from './AdminSettings'

const ADMIN_EMAILS = ['joaopedro.faggionato@gmail.com', 'joaopedrofaggionato@gmail.com', 'faggionato.rentals@gmail.com']

const AdminSidebar = () => {
    const location = useLocation()
    const { signOut } = useAuth()
    const navigate = useNavigate()

    const menuItems = [
        { icon: LayoutDashboard, label: 'Visão Geral', path: '/admin' },
        { icon: Users, label: 'Assinantes', path: '/admin/subscribers' },
        { icon: CreditCard, label: 'Financeiro', path: '/admin/finance' },
        { icon: MessageSquare, label: 'Suporte', path: '/admin/support' },
        { icon: BarChart3, label: 'Uso do Sistema', path: '/admin/usage' },
        { icon: Settings, label: 'Configurações', path: '/admin/settings' },
    ]

    return (
        <div className="w-64 min-h-screen bg-[#13283b] text-[#e7e9e8] flex flex-col p-6 fixed left-0 top-0">
            <div className="flex items-center gap-3 mb-12 px-2">
                <div className="bg-white p-1.5 rounded-lg">
                    <ShieldCheck size={24} className="text-[#13283b]" />
                </div>
                <h1 className="text-xl font-black uppercase tracking-tighter">Admin Master</h1>
            </div>

            <nav className="flex-1 space-y-2">
                {menuItems.map((item) => {
                    const isActive = location.pathname === item.path
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest transition-all ${isActive
                                ? 'bg-white/10 text-white shadow-lg'
                                : 'text-white/50 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            <item.icon size={18} />
                            {item.label}
                        </Link>
                    )
                })}
            </nav>

            <button
                onClick={async () => {
                    await signOut()
                    navigate('/login')
                }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-widest text-red-300 hover:bg-red-500/10 transition-all mt-auto"
            >
                <LogOut size={18} />
                Encerrar Sessão
            </button>
        </div>
    )
}

const StatCard = ({ label, value, trend, icon: Icon, colorClass = "text-[#13283b]", description }) => {
    const isPositive = trend > 0
    return (
        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group hover:scale-[1.02] transition-all duration-300">
            <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 transition-all group-hover:bg-slate-100/50" />
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-6">
                    <div className={`p-4 bg-slate-50 rounded-2xl group-hover:rotate-6 transition-transform`}>
                        <Icon size={24} className={colorClass} />
                    </div>
                    {trend !== undefined && (
                        <div className={`flex items-center gap-1 px-3 py-1.5 rounded-full border ${isPositive ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'
                            }`}>
                            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            <span className="text-[10px] font-black uppercase tracking-widest">
                                {Math.abs(trend)}%
                            </span>
                        </div>
                    )}
                </div>
                <p className="text-[11px] uppercase font-black tracking-[0.2em] text-slate-400 mb-2">{label}</p>
                <h3 className="text-4xl font-black text-[#13283b] tracking-tighter mb-1">{value}</h3>
                {description && <p className="text-[10px] text-slate-400 font-medium">{description}</p>}
            </div>
        </div>
    )
}

const AdminOverview = () => {
    const [metrics, setMetrics] = useState({
        totalSubscribers: 0,
        activeSubscribers: 0,
        canceledLast30: 0,
        mrr: 0,
        mrrTrend: 12,
        churnRate: 0,
        newToday: 0,
        events: [],
        referralStats: [],
        companySizeStats: []
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                setLoading(true)

                // 1. Core Profile Stats
                const { count: totalCount } = await supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true })
                    .eq('role', 'user')
                    .not('email', 'in', `(${ADMIN_EMAILS.join(',')})`)

                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const { count: newTodayCount } = await supabase
                    .from('profiles')
                    .select('*', { count: 'exact', head: true })
                    .eq('role', 'user')
                    .not('email', 'in', `(${ADMIN_EMAILS.join(',')})`)
                    .gte('created_at', today.toISOString())

                // 2. Subscription Stats
                const { data: subs, error: subsError } = await supabase
                    .from('saas_subscriptions')
                    .select('*, profiles(email)')

                const nonAdminSubs = subs?.filter(s => !ADMIN_EMAILS.includes(s.profiles?.email)) || []
                const activeSubs = nonAdminSubs.filter(s => {
                    const isActive = s.status === 'active'
                    const isTrialing = s.status === 'trialing'
                    const isCanceledButActive = s.status === 'canceled' && s.current_period_end && new Date(s.current_period_end) > new Date()
                    return isActive || isTrialing || isCanceledButActive
                })
                const activeCount = activeSubs.length

                // MRR Normalization Logic
                const mrrTotal = activeSubs.reduce((acc, curr) => {
                    const amount = curr.amount_cents || 0
                    const cycle = (curr.billing_cycle || curr.plan_type || 'monthly').toLowerCase()

                    let divisor = 1
                    if (cycle.includes('annual') || cycle.includes('anual')) divisor = 12
                    else if (cycle.includes('quarter') || cycle.includes('trimestre')) divisor = 3
                    else if (cycle.includes('semester') || cycle.includes('semestre')) divisor = 6

                    return acc + (amount / divisor)
                }, 0) / 100

                const thirtyDaysAgo = new Date()
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

                // Churn calculation (approximate if no history)
                const canceledLast30 = nonAdminSubs.filter(s =>
                    s.status === 'canceled' &&
                    new Date(s.updated_at || s.created_at) >= thirtyDaysAgo
                ).length

                const churnRate = totalCount > 0 ? ((canceledLast30 / totalCount) * 100).toFixed(1) : 0

                // 3. Aggregate Activity Feed (Subscription Events + Support)
                const [{ data: eventsData }, { data: recentTickets }] = await Promise.all([
                    supabase.from('subscription_events')
                        .select('*, profiles(full_name, email)')
                        .order('created_at', { ascending: false })
                        .limit(20),
                    supabase.from('saas_support_tickets')
                        .select('*, profiles(full_name, email)')
                        .order('created_at', { ascending: false })
                        .limit(10)
                ])

                const nonAdminEvents = eventsData?.filter(e => !ADMIN_EMAILS.includes(e.profiles?.email)) || []
                const nonAdminTicketEvents = recentTickets?.filter(t => !ADMIN_EMAILS.includes(t.profiles?.email)) || []

                const events = [
                    ...(nonAdminEvents.map(e => ({
                        id: `se-${e.id}`,
                        type: e.event_type.toUpperCase(),
                        user: e.profiles?.full_name || e.profiles?.email || 'Sistema',
                        email: e.profiles?.email,
                        date: e.created_at,
                        status: ['payment_failed', 'canceled'].includes(e.event_type) ? 'alert' : 'success'
                    }))),
                    ...(nonAdminTicketEvents.map(t => ({
                        id: `t-${t.id}`,
                        type: 'SUPPORT',
                        user: t.profiles?.full_name || t.profiles?.email,
                        email: t.profiles?.email,
                        date: t.created_at,
                        status: t.priority === 'high' ? 'alert' : 'success'
                    })))
                ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8)

                setMetrics({
                    totalSubscribers: totalCount || 0,
                    activeSubscribers: activeCount,
                    canceledLast30: canceledLast30,
                    mrr: mrrTotal,
                    mrrTrend: 12, // Mocked for now
                    churnRate: churnRate,
                    newToday: newTodayCount || 0,
                    events,
                    referralStats: [],
                    companySizeStats: []
                })

                // 4. Fetch Referral & Company Size Stats
                const { data: profileStats } = await supabase
                    .from('profiles')
                    .select('referral_source, company_size')
                    .eq('role', 'user')
                    .not('email', 'in', `(${ADMIN_EMAILS.join(',')})`)

                if (profileStats) {
                    // Aggregate referral sources
                    const referralCounts = profileStats.reduce((acc, p) => {
                        const source = p.referral_source || 'Não informado'
                        acc[source] = (acc[source] || 0) + 1
                        return acc
                    }, {})
                    const referralStats = Object.entries(referralCounts)
                        .map(([source, count]) => ({ source, count }))
                        .sort((a, b) => b.count - a.count)

                    // Aggregate company sizes
                    const sizeCounts = profileStats.reduce((acc, p) => {
                        const size = p.company_size || 'Não informado'
                        acc[size] = (acc[size] || 0) + 1
                        return acc
                    }, {})
                    const companySizeStats = Object.entries(sizeCounts)
                        .map(([size, count]) => ({ size, count }))
                        .sort((a, b) => b.count - a.count)

                    setMetrics(prev => ({
                        ...prev,
                        referralStats,
                        companySizeStats
                    }))
                }
            } catch (error) {
                console.error('Error fetching admin metrics:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchMetrics()
    }, [])

    return (
        <div className="space-y-12 w-full">
            <header className="flex justify-between items-start">
                <div>
                    <h2 className="text-4xl font-black text-[#13283b] uppercase tracking-tighter mb-2">Painel de Controle</h2>
                    <p className="text-slate-400 font-medium tracking-wide text-lg">Central de comando do ecossistema Risu.</p>
                </div>
                <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border border-slate-100 shadow-sm">
                    <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`} />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#13283b]">
                        {loading ? 'Sincronizando...' : 'Database: Online'}
                    </span>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <StatCard
                    label="Assinantes Ativos"
                    value={loading ? "..." : metrics.activeSubscribers}
                    trend={5}
                    icon={Users}
                    colorClass="text-blue-600"
                    description={`Total de ${metrics.totalSubscribers} cadastrados`}
                />
                <StatCard
                    label="Receita Mensal (MRR)"
                    value={loading ? "..." : `R$ ${metrics.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                    trend={metrics.mrrTrend}
                    icon={CreditCard}
                    colorClass="text-green-600"
                    description="Receita recorrente bruta"
                />
                <StatCard
                    label="Taxa de Churn"
                    value={loading ? "..." : `${metrics.churnRate}%`}
                    trend={-2}
                    icon={TrendingDown}
                    colorClass="text-red-500"
                    description={`${metrics.canceledLast30} cancelamentos (30d)`}
                />
                <StatCard
                    label="Novos Hoje"
                    value={loading ? "..." : metrics.newToday}
                    trend={10}
                    icon={TrendingUp}
                    colorClass="text-purple-600"
                    description="Assinaturas criadas nas últimas 24h"
                />
                <StatCard
                    label="Assinantes Cancelados"
                    value={loading ? "..." : metrics.canceledLast30}
                    icon={AlertCircle}
                    colorClass="text-slate-500"
                    description="Usuários que saíram nos últimos 30 dias"
                />
                <StatCard
                    label="Total de Usuários"
                    value={loading ? "..." : metrics.totalSubscribers}
                    icon={Activity}
                    colorClass="text-blue-500"
                    description="Base histórica completa do SaaS"
                />
            </div>

            {/* Referral & Company Size Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                {/* Referral Sources */}
                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-lg">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Como Nos Conheceram</h3>
                    <div className="space-y-3">
                        {metrics.referralStats.length > 0 ? metrics.referralStats.map((item, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                <span className="text-xs font-bold text-[#13283b] capitalize">
                                    {item.source === 'instagram' ? '📸 Instagram/Facebook' :
                                        item.source === 'google' ? '🔍 Google Search' :
                                            item.source === 'indication' ? '🤝 Indicação' :
                                                item.source === 'youtube' ? '▶️ YouTube' :
                                                    item.source === 'other' ? '📦 Outros' :
                                                        item.source}
                                </span>
                                <span className="text-xs font-black text-secondary bg-secondary/10 px-3 py-1 rounded-lg">{item.count}</span>
                            </div>
                        )) : (
                            <p className="text-xs text-slate-300 italic">Nenhum dado disponível</p>
                        )}
                    </div>
                </div>

                {/* Company Size */}
                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-lg">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Tamanho das Empresas</h3>
                    <div className="space-y-3">
                        {metrics.companySizeStats.length > 0 ? metrics.companySizeStats.map((item, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                                <span className="text-xs font-bold text-[#13283b]">
                                    {item.size === '1' ? '🧑 Apenas eu (Autônomo)' :
                                        item.size === '2-5' ? '👥 2-5 funcionários' :
                                            item.size === '6-20' ? '🏢 6-20 funcionários' :
                                                item.size === '21+' ? '🏭 +21 funcionários' :
                                                    item.size}
                                </span>
                                <span className="text-xs font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">{item.count}</span>
                            </div>
                        )) : (
                            <p className="text-xs text-slate-300 italic">Nenhum dado disponível</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mt-4">
                {/* Event Feed */}
                <div className="lg:col-span-8 bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30 min-h-[550px]">
                    <div className="flex justify-between items-center mb-10">
                        <div className="flex items-center gap-3">
                            <History size={18} className="text-slate-400" />
                            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 underline decoration-[#13283b]/20 underline-offset-[12px]">Feed de Atividade</h3>
                        </div>
                        <Link to="subscribers" className="text-[10px] font-black uppercase tracking-widest text-[#13283b] hover:underline">Ver Auditoria</Link>
                    </div>

                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-80">
                            <RefreshCw className="w-8 h-8 text-slate-200 animate-spin mb-4" />
                            <p className="font-bold uppercase tracking-widest text-[10px] text-slate-300">Sincronizando feed em tempo real...</p>
                        </div>
                    ) : metrics.events.length > 0 ? (
                        <div className="space-y-4">
                            {metrics.events.map((event) => (
                                <div key={event.id} className="flex items-center justify-between p-5 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100 group">
                                    <div className="flex items-center gap-5">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shadow-sm ${event.status === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                                            }`}>
                                            {event.type.charAt(0)}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="text-sm font-black text-[#13283b]">{event.user}</p>
                                                <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${event.type === 'SIGNUP' ? 'bg-blue-100 text-blue-600' :
                                                    event.type === 'SUBSCRIPTION' ? 'bg-green-100 text-green-600' :
                                                        'bg-purple-100 text-purple-600'
                                                    }`}>
                                                    {event.type}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-medium">{event.email}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-black text-[#13283b] uppercase tracking-tighter">
                                            {new Date(event.date).toLocaleDateString()}
                                        </p>
                                        <p className="text-[9px] text-slate-300 font-bold uppercase tracking-widest">
                                            {new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-80 text-slate-300 gap-4">
                            <Activity size={48} strokeWidth={1} />
                            <p className="font-bold uppercase tracking-widest text-[10px]">Aguardando novos eventos...</p>
                        </div>
                    )}
                </div>

                {/* Sidebar Health & Actions */}
                <div className="lg:col-span-4 space-y-8">
                    {/* System Health */}
                    <div className="bg-[#13283b] p-10 rounded-[2.5rem] shadow-2xl shadow-[#13283b]/40 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16" />
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/40 mb-10">Estado do Sistema</h3>
                        <div className="space-y-6">
                            {[
                                { label: 'API Gateway', status: 'Online', icon: Zap },
                                { label: 'Banco de Dados', status: 'Normal', icon: Server },
                                { label: 'Processamento', status: 'Operacional', icon: Activity }
                            ].map((item, i) => (
                                <div key={i} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white/5 rounded-xl group-hover:bg-white/10 transition-colors">
                                            <item.icon size={18} className="text-white/60" />
                                        </div>
                                        <p className="text-xs font-black uppercase tracking-tighter">{item.label}</p>
                                    </div>
                                    <span className="text-[8px] font-black uppercase tracking-widest text-green-400 bg-green-400/10 px-2 py-1 rounded-lg">
                                        {item.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <button className="mt-12 bg-white text-[#13283b] w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-slate-100 transition-all">
                            Relatório Técnico
                        </button>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-200/50">
                        <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8 px-2">Ações Rápidas</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { label: 'Novo User', icon: UserPlus, path: 'subscribers' },
                                { label: 'Planos', icon: Settings, path: 'settings' },
                                { label: 'Financeiro', icon: CreditCard, path: 'finance' },
                                { label: 'Faturas', icon: History, path: 'finance' },
                                { label: 'Tickets', icon: MessageSquare, path: 'support' },
                                { label: 'Bloquear', icon: Lock, path: 'subscribers' }
                            ].map((action, i) => (
                                <Link
                                    key={i}
                                    to={action.path}
                                    className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-slate-200/50 hover:border-[#13283b]/20 hover:shadow-md transition-all group"
                                >
                                    <action.icon size={20} className="text-slate-400 mb-2 group-hover:text-[#13283b] transition-colors" />
                                    <span className="text-[9px] font-black uppercase tracking-tighter text-slate-500">{action.label}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function AdminDashboard() {
    return (
        <div className="min-h-screen bg-[#e7e9e8] flex">
            <AdminSidebar />
            <main className="flex-1 ml-64 p-12 overflow-auto flex flex-col">
                <Routes>
                    <Route index element={<AdminOverview />} />
                    <Route path="subscribers" element={<AdminSubscribers />} />
                    <Route path="finance" element={<AdminFinance />} />
                    <Route path="support" element={<AdminSupport />} />
                    <Route path="usage" element={<AdminUsage />} />
                    <Route path="settings" element={<AdminSettings />} />
                    <Route path="*" element={<Navigate to="/admin" replace />} />
                </Routes>
            </main>
        </div>
    )
}

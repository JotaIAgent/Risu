import { useState, useEffect } from 'react'
import {
    Activity,
    BarChart3,
    Zap,
    AlertTriangle,
    CheckCircle2,
    Users,
    Package,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    PieChart,
    Search,
    Calendar,
    ArrowUpRight,
    ArrowDownRight,
    Filter,
    Clock,
    FileText,
    Truck
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { format, subDays, startOfDay, endOfDay, isWithinInterval, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'

const ADMIN_EMAILS = ['joaopedro.faggionato@gmail.com', 'joaopedrofaggionato@gmail.com', 'faggionato.rentals@gmail.com']

// --- Helper Components ---

const MetricCard = ({ label, value, previousValue, icon: Icon, colorClass, tooltip }) => {
    // Calculate Variation
    let variation = 0
    let trend = 'neutral'

    if (previousValue > 0) {
        variation = ((value - previousValue) / previousValue) * 100
        trend = variation > 0 ? 'up' : variation < 0 ? 'down' : 'neutral'
    } else if (value > 0) {
        variation = 100 // New growth
        trend = 'up'
    }

    return (
        <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 group relative overflow-hidden">
            <div className="flex justify-between items-start mb-4">
                <div className={`p-3 rounded-xl bg-slate-50 group-hover:scale-110 transition-transform duration-300`}>
                    <Icon size={20} className={colorClass} />
                </div>
                <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${trend === 'up' ? 'bg-green-50 text-green-600' :
                    trend === 'down' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'
                    }`}>
                    {trend === 'up' && <ArrowUpRight size={10} />}
                    {trend === 'down' && <ArrowDownRight size={10} />}
                    {Math.abs(variation).toFixed(1)}%
                </div>
            </div>
            <div className="space-y-1 relative z-10">
                <p className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400" title={tooltip}>{label}</p>
                <h3 className="text-2xl font-black text-[#13283b] tracking-tighter">{value}</h3>
            </div>
            {/* Background Decor */}
            <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
                <Icon size={80} />
            </div>
        </div>
    )
}

const ActivityItem = ({ event }) => {
    const icons = {
        rental: FileText,
        item: Package,
        customer: Users
    }
    const colors = {
        rental: 'text-blue-500 bg-blue-50',
        item: 'text-purple-500 bg-purple-50',
        customer: 'text-green-500 bg-green-50'
    }

    const Icon = icons[event.type] || Activity
    const colorStyle = colors[event.type] || 'text-slate-500 bg-slate-50'

    return (
        <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl hover:bg-white hover:shadow-md transition-all duration-300 border border-transparent hover:border-slate-100">
            <div className={`p-2 rounded-xl ${colorStyle} shrink-0`}>
                <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-[#13283b] truncate">{event.primaryText}</p>
                <p className="text-[10px] text-slate-400 font-medium truncate">{event.secondaryText}</p>
            </div>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wide shrink-0 bg-white px-2 py-1 rounded-lg border border-slate-100">
                {event.timeAgo}
            </div>
        </div>
    )
}

export default function AdminUsage() {
    // State
    const [period, setPeriod] = useState(30) // 7, 30, 90
    const [loading, setLoading] = useState(true)
    const [metrics, setMetrics] = useState({
        rentals: { current: 0, previous: 0 },
        items: { current: 0, previous: 0 },
        customers: { current: 0, previous: 0 },
        activeTenants: { current: 0, previous: 0 },
    })
    const [activityFeed, setActivityFeed] = useState([])
    const [churnRisk, setChurnRisk] = useState([])
    const [featureAdoption, setFeatureAdoption] = useState([])
    const [topTenants, setTopTenants] = useState([])

    const navigate = useNavigate()

    useEffect(() => {
        fetchDashboardData()
    }, [period])

    const fetchDashboardData = async () => {
        setLoading(true)
        try {
            // 1. Calculate Date Ranges
            const now = new Date()
            const startDate = subDays(startOfDay(now), period)
            const prevStartDate = subDays(startOfDay(now), period * 2)
            const prevEndDate = subDays(endOfDay(now), period) // Comparison period

            // 2. Fetch Core Metrics (Current & Previous)
            // Function to fetch count table with date filter
            const fetchCount = async (table, start, end) => {
                const { count } = await supabase.from(table)
                    .select('*', { count: 'exact', head: true })
                    .gte('created_at', start.toISOString())
                    .lte('created_at', end.toISOString())
                return count || 0
            }

            // Parallel Requests for Performance
            const [
                rentalsCurr, rentalsPrev,
                itemsCurr, itemsPrev,
                customersCurr, customersPrev,
                // For Active Tenants Logic (Needs distinct check on logs or rentals really, but simplification using profiles login)
                activeProfiles
            ] = await Promise.all([
                fetchCount('rentals', startDate, now), fetchCount('rentals', prevStartDate, prevEndDate),
                fetchCount('items', startDate, now), fetchCount('items', prevStartDate, prevEndDate),
                fetchCount('customers', startDate, now), fetchCount('customers', prevStartDate, prevEndDate),
                supabase.from('profiles').select('id, full_name, email, last_login_at, created_at, saas_subscriptions(status)').not('email', 'in', `(${ADMIN_EMAILS.join(',')})`)
            ])

            // Filter Active Tenants based on Login in Period
            const tenantsCurr = activeProfiles.data?.filter(p => p.last_login_at && new Date(p.last_login_at) >= startDate).length || 0
            const tenantsPrev = activeProfiles.data?.filter(p => p.last_login_at && new Date(p.last_login_at) >= prevStartDate && new Date(p.last_login_at) < prevEndDate).length || 0

            setMetrics({
                rentals: { current: rentalsCurr, previous: rentalsPrev },
                items: { current: itemsCurr, previous: itemsPrev },
                customers: { current: customersCurr, previous: customersPrev },
                activeTenants: { current: tenantsCurr, previous: tenantsPrev }
            })

            // 3. Activity Feed (Manual Join to avoid FK issues)
            const { data: recentRentals } = await supabase.from('rentals').select('id, created_at, user_id').order('created_at', { ascending: false }).limit(5)
            const { data: recentItems } = await supabase.from('items').select('id, name, created_at, user_id').order('created_at', { ascending: false }).limit(5)
            const { data: recentCustomers } = await supabase.from('customers').select('id, name, created_at, user_id').order('created_at', { ascending: false }).limit(5)

            // Collect unique user IDs
            const userIds = new Set([
                ...(recentRentals?.map(r => r.user_id) || []),
                ...(recentItems?.map(i => i.user_id) || []),
                ...(recentCustomers?.map(c => c.user_id) || [])
            ])

            // Fetch profiles
            let profilesMap = {}
            if (userIds.size > 0) {
                const { data: profilesData } = await supabase.from('profiles').select('id, full_name, email').in('id', Array.from(userIds))
                profilesData?.forEach(p => {
                    profilesMap[p.id] = p
                })
            }

            const feed = [
                ...(recentRentals?.map(r => ({
                    type: 'rental',
                    date: new Date(r.created_at),
                    primaryText: 'Nova Locação',
                    secondaryText: `Por ${profilesMap[r.user_id]?.full_name || profilesMap[r.user_id]?.email || 'Desconhecido'}`
                })) || []),
                ...(recentItems?.map(i => ({
                    type: 'item',
                    date: new Date(i.created_at),
                    primaryText: `Item: ${i.name}`,
                    secondaryText: `Cadastrado por ${profilesMap[i.user_id]?.full_name || profilesMap[i.user_id]?.email || 'Desconhecido'}`
                })) || []),
                ...(recentCustomers?.map(c => ({
                    type: 'customer',
                    date: new Date(c.created_at),
                    primaryText: `Cliente: ${c.name}`,
                    secondaryText: `Cadastrado por ${profilesMap[c.user_id]?.full_name || profilesMap[c.user_id]?.email || 'Desconhecido'}`
                })) || [])
            ].sort((a, b) => b.date - a.date).slice(0, 6).map(item => ({
                ...item,
                timeAgo: format(item.date, "dd MMM HH:mm", { locale: ptBR })
            }))

            setActivityFeed(feed)

            // 4. Churn Risk Logic (Inactivity + Support Flags)
            const profiles = activeProfiles.data || []
            const thirtyDaysAgo = subDays(now, 30)

            // A. Inactivity Risk
            const inactivityRisk = profiles.filter(p => {
                const lastActivity = p.last_login_at ? new Date(p.last_login_at) : new Date(p.created_at)
                return lastActivity < thirtyDaysAgo
            }).map(p => {
                let daysInactive = 'N/A'
                if (p.last_login_at) {
                    daysInactive = Math.floor((now - new Date(p.last_login_at)) / (1000 * 60 * 60 * 24))
                } else if (p.created_at) {
                    daysInactive = Math.floor((now - new Date(p.created_at)) / (1000 * 60 * 60 * 24))
                } else {
                    daysInactive = 'Nunca'
                }

                return {
                    id: p.id,
                    name: p.full_name || p.email,
                    last_login: p.last_login_at ? new Date(p.last_login_at) : null,
                    risk: !p.last_login_at ? 'critical' : 'high',
                    reason: `${daysInactive} dias inativo`
                }
            })

            // B. Support Flag Risk
            const { data: flaggedTickets } = await supabase
                .from('support_tickets')
                .select('user_id, profiles(full_name, email)')
                .eq('churn_risk_flag', true)

            const supportRisk = flaggedTickets?.map(t => ({
                id: t.user_id,
                name: t.profiles?.full_name || t.profiles?.email,
                last_login: null, // Not relevant for this view
                risk: 'critical',
                reason: 'Sinalizado no Suporte'
            })) || []

            // Merge & Deduplicate (Support Flag takes precedence)
            const riskMap = new Map()

            // Add inactivity risks first
            inactivityRisk.forEach(item => riskMap.set(item.id, item))

            // Overwrite/Add support risks
            supportRisk.forEach(item => riskMap.set(item.id, item))

            const finalRiskList = Array.from(riskMap.values()).sort((a, b) => {
                if (a.reason === 'Sinalizado no Suporte' && b.reason !== 'Sinalizado no Suporte') return -1
                return 0
            })

            setChurnRisk(finalRiskList.slice(0, 5))

            // 5. Feature Adoption (Global Stats)
            // Simply calculate based on unique users in tables VS total users
            const totalUsers = profiles.length || 1
            const { count: usersWithItems } = await supabase.from('items').select('user_id', { count: 'exact', head: true }) // Approximation (should be distinct)
            // Correct approach for distinct count via JS for now (optimization later)
            const { data: itemUsers } = await supabase.from('items').select('user_id')
            const uniqueItemUsers = new Set(itemUsers?.map(i => i.user_id)).size

            const { data: rentalUsers } = await supabase.from('rentals').select('user_id')
            const uniqueRentalUsers = new Set(rentalUsers?.map(r => r.user_id)).size

            setFeatureAdoption([
                { name: 'Gestão de Inventário', value: Math.round((uniqueItemUsers / totalUsers) * 100) },
                { name: 'Contratos Digitais', value: Math.round((uniqueRentalUsers / totalUsers) * 100) },
            ])


        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-8 pb-20 animate-in fade-in duration-700">
            {/* Header & Filter */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-4xl font-black text-[#13283b] uppercase tracking-tighter mb-1">Análise de Uso</h2>
                    <p className="text-slate-400 font-medium tracking-wide text-sm max-w-lg">Visão estratégica de engajamento, retenção e riscos operacionais em tempo real.</p>
                </div>

                <div className="bg-white p-1.5 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-1">
                    {[7, 30, 90].map(days => (
                        <button
                            key={days}
                            onClick={() => setPeriod(days)}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${period === days
                                ? 'bg-[#13283b] text-white shadow-lg shadow-[#13283b]/20'
                                : 'text-slate-400 hover:bg-slate-50 hover:text-[#13283b]'
                                }`}
                        >
                            {days} Dias
                        </button>
                    ))}
                    <div className="w-px h-6 bg-slate-100 mx-1" />
                    <button className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-slate-400 hover:bg-slate-50 flex items-center gap-2">
                        <Calendar size={14} /> Personalizado
                    </button>
                </div>
            </div>

            {/* Main Metrics Logic */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    label="Locações Realizadas"
                    value={metrics.rentals.current}
                    previousValue={metrics.rentals.previous}
                    icon={FileText}
                    colorClass="text-blue-500"
                    tooltip="Total de contratos/locações gerados no período"
                />
                <MetricCard
                    label="Itens Cadastrados"
                    value={metrics.items.current}
                    previousValue={metrics.items.previous}
                    icon={Package}
                    colorClass="text-purple-500"
                    tooltip="Novos itens adicionados ao estoque"
                />
                <MetricCard
                    label="Clientes Captados"
                    value={metrics.customers.current}
                    previousValue={metrics.customers.previous}
                    icon={Users}
                    colorClass="text-green-500"
                    tooltip="Novos clientes finais cadastrados pelos tenants"
                />
                <MetricCard
                    label="Tenants Ativos"
                    value={metrics.activeTenants.current}
                    previousValue={metrics.activeTenants.previous}
                    icon={Zap}
                    colorClass="text-amber-500"
                    tooltip="Empresas que fizeram login ou operaram no período"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Activity Feed */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Activity size={18} className="text-[#13283b]" />
                        <h3 className="text-sm font-black text-[#13283b] uppercase tracking-widest">Atividade Operacional Recente</h3>
                    </div>
                    <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30 min-h-[400px]">
                        {loading ? (
                            <div className="flex items-center justify-center h-full text-slate-300 gap-2">
                                <RefreshCw className="animate-spin" /> Carregando feed...
                            </div>
                        ) : activityFeed.length > 0 ? (
                            <div className="flex flex-col gap-3">
                                {activityFeed.map((event, i) => <ActivityItem key={i} event={event} />)}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                                <Clock size={48} className="mb-4 opacity-20" />
                                <p className="text-xs uppercase font-bold tracking-widest">Nenhuma atividade no período</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Churn & Adoption */}
                <div className="space-y-8">
                    {/* Adoption */}
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
                            <BarChart3 size={14} /> Adoção de Features
                        </h3>
                        <div className="space-y-6">
                            {featureAdoption.map((feat, i) => (
                                <div key={i}>
                                    <div className="flex justify-between items-end mb-2">
                                        <span className="text-xs font-bold text-[#13283b]">{feat.name}</span>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${feat.value > 50 ? 'bg-green-100 text-green-700' :
                                            feat.value > 20 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                                            }`}>{feat.value}% Adotaram</span>
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-[#13283b]" style={{ width: `${feat.value}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Churn Predictor */}
                    <div className="bg-red-50/50 p-8 rounded-[2.5rem] border border-red-100 relative overflow-hidden">
                        <div className="absolute -right-6 -top-6 text-red-100 rotate-12 pointer-events-none">
                            <AlertTriangle size={120} />
                        </div>
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400 mb-6 flex items-center gap-2 relative z-10">
                            <AlertTriangle size={14} /> Risco de Churn ({churnRisk.length})
                        </h3>
                        <div className="space-y-3 relative z-10">
                            {churnRisk.length > 0 ? churnRisk.map((user, i) => (
                                <div key={i} className="bg-white p-3 rounded-xl border border-red-100 flex justify-between items-center shadow-sm">
                                    <div>
                                        <p className="text-[10px] font-black text-[#13283b] bg-red-50 px-1.5 rounded inline-block mb-1">
                                            {user.reason}
                                        </p>
                                        <p className="text-xs font-bold text-slate-500 truncate max-w-[120px]">{user.name}</p>
                                    </div>
                                    <button
                                        onClick={() => navigate('/admin/subscribers', { state: { search: user.name } })}
                                        className="text-[9px] font-black uppercase tracking-tight bg-[#13283b] text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors"
                                    >
                                        Agir
                                    </button>
                                </div>
                            )) : (
                                <p className="text-xs text-slate-400 font-medium">Nenhum risco crítico detectado.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

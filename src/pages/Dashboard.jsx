import { useEffect, useState, useRef } from 'react'
import {
    Package, Calendar, DollarSign, TrendingUp, AlertTriangle,
    Clock, CheckCircle, Truck, User, ArrowUpRight, AlertCircle, Wrench,
    Hammer, ClipboardList, Lightbulb, BarChart2
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { isSameDay, parseISO } from 'date-fns'

export default function Dashboard() {
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [period, setPeriod] = useState('30')
    const [expandInsights, setExpandInsights] = useState(false)
    const [chartWidth, setChartWidth] = useState(0)
    const chartContainerRef = useRef(null)

    useEffect(() => {
        if (!loading && chartContainerRef.current) {
            const resizeObserver = new ResizeObserver((entries) => {
                for (const entry of entries) {
                    setChartWidth(entry.contentRect.width)
                }
            })

            resizeObserver.observe(chartContainerRef.current)

            return () => resizeObserver.disconnect()
        }
    }, [loading])

    const [data, setData] = useState({
        chartData: [],
        alerts: {
            overduePayments: [],
            overdueReturns: [],
            criticalStock: [],
            lateLogistics: [],
            stockConflicts: [],
            damagedItemsAlerts: []
        },
        financials: {
            revenueToday: 0,
            revenuePeriod: 0,
            revenuePrvPeriod: 0,
            toReceive: 0,
            openDeposits: 0,
            paidPercentage: 0,
            overdueAmount: 0 // Keep for ToReceive card
        },
        stock: {
            total: 0,
            rented: 0,
            reserved: 0,
            maintenance: 0,
            broken: 0,
            lost: 0,
            available: 0
        },
        agenda: [],
        highlights: {
            latestOrders: [],
            pendingQuotes: [],
            debtClients: [],
            recurringClients: []
        },
        problems: {
            maintenanceCount: 0,
            brokenCount: 0
        },
        kpis: {
            activeRentals: 0,
            occupancyRate: 0,
            avgTicket: 0,
            mostRented: null,
            leastRented: null
        },
        insights: []
    })

    useEffect(() => {
        fetchDashboardData()
    }, [period])

    async function fetchDashboardData() {
        try {
            setLoading(true)
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            const todayStr = today.toISOString().split('T')[0]
            const now = new Date()

            const { data: { user } } = await supabase.auth.getUser()

            // 0. Fetch User Settings for Store Address
            const { data: settingsData } = await supabase
                .from('user_settings')
                .select('owner_street, owner_number, owner_neighborhood, owner_city, owner_state')
                .eq('user_id', user.id)
                .maybeSingle()

            const storeAddress = settingsData && settingsData.owner_street
                ? `${settingsData.owner_street}, ${settingsData.owner_number} - ${settingsData.owner_neighborhood}, ${settingsData.owner_city}`
                : 'Endereço da Loja não configurado'

            // Period Calculation
            const days = period === 'all' ? 36500 : parseInt(period)
            const startDate = new Date()
            startDate.setDate(startDate.getDate() - days)
            const startDateStr = period === 'all' ? '2000-01-01' : startDate.toISOString().split('T')[0]

            // Previous Period Calculation (for comparison)
            const prevStartDate = new Date(startDate)
            prevStartDate.setDate(prevStartDate.getDate() - days)
            const prevStartDateStr = prevStartDate.toISOString().split('T')[0]

            // 1. Fetch Active/Pending Rentals
            const { data: activeRentals } = await supabase
                .from('rentals')
                .select(`
                    *,
                    customers (id, name, whatsapp),
                    rental_items (item_id, quantity, unit_price, items(name))
                `)
                .neq('status', 'canceled')
                .in('status', ['active', 'pending', 'confirmed', 'in_progress'])

            // 1b. Fetch Open Broken Logs
            const { count: brokenCount } = await supabase
                .from('broken_logs')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'OPEN')

            // 2. Fetch Period Rentals (For Revenue Period, KPIs, Highlights)
            const { data: periodRentals } = await supabase
                .from('rentals')
                .select(`
                    *,
                    customers (id, name),
                    rental_items (item_id, quantity, items(name))
                `)
                .gte('created_at', startDateStr)
                .neq('status', 'canceled')

            // 3. Fetch Previous Period Rentals (For Comparison)
            const { data: prevPeriodRentals } = await supabase
                .from('rentals')
                .select('total_value')
                .gte('created_at', prevStartDateStr)
                .lt('created_at', startDateStr)
                .neq('status', 'canceled')

            // 4. Fetch Items (For Stock)
            const { data: items } = await supabase
                .from('items')
                .select('*')

            // 5. Fetch Latest Confirmed Orders
            const { data: latestOrdersData } = await supabase
                .from('rentals')
                .select('id, created_at, total_value, status, customers(name)')
                .eq('type', 'rental')
                .eq('status', 'confirmed') // Show Confirmed, not just active logic
                .order('created_at', { ascending: false })
                .limit(5)

            // 6. Fetch Pending Quotes
            const { data: pendingQuotesData } = await supabase
                .from('rentals')
                .select('id, created_at, total_value, status, customers(name)')
                .eq('type', 'quote')
                .in('status', ['draft', 'sent'])
                .order('created_at', { ascending: false })
                .limit(5)

            // 7. Fetch New Clients in Period
            const { count: newClientsCount } = await supabase
                .from('customers')
                .select('*', { count: 'exact', head: true })
                .gte('created_at', startDateStr)

            // --- PROCESSING ---
            const overduePayments = []
            const overdueReturns = []
            const lateLogistics = []
            const checklistOutAlerts = []
            const checklistInAlerts = []
            const stockConflicts = []
            const damagedItemsAlerts = []

            let totalPending = 0
            let totalOverdue = 0

            activeRentals?.forEach(r => {
                const pendingVal = Math.max(0, (r.total_value || 0) - (r.down_payment || 0))
                totalPending += pendingVal

                // 1. Overdue Payment
                const dueDate = r.custom_due_date || r.delivery_date
                if (pendingVal > 0.01 && dueDate && new Date(dueDate + 'T00:00:00') < today) {
                    overduePayments.push({
                        id: r.id,
                        client: r.customers?.name,
                        amount: pendingVal,
                        days: Math.floor((today - new Date(dueDate + 'T00:00:00')) / (1000 * 60 * 60 * 24))
                    })
                    totalOverdue += pendingVal
                }

                // 2. Overdue Return
                if (['active', 'in_progress', 'confirmed'].includes(r.status) && r.return_date && new Date(r.return_date + 'T00:00:00') < today) {
                    overdueReturns.push({
                        id: r.id,
                        client: r.customers?.name,
                        date: r.return_date,
                        days: Math.floor((today - new Date(r.return_date + 'T00:00:00')) / (1000 * 60 * 60 * 24))
                    })
                }

                // 3. Late Logistics
                if (r.delivery_date === todayStr && r.delivery_time) {
                    const [h, m] = r.delivery_time.split(':').map(Number)
                    const deliveryTime = new Date(today)
                    deliveryTime.setHours(h, m, 0)
                    if (now > deliveryTime && !['step_4_delivered', 'step_3_in_transit'].includes(r.logistics_status)) {
                        const typeLabel = r.delivery_type === 'pickup' ? 'Retirada (Loja)' : 'Entrega'
                        lateLogistics.push({
                            id: r.id, type: typeLabel, client: r.customers?.name, time: r.delivery_time, diff: Math.floor((now - deliveryTime) / (1000 * 60))
                        })
                    }
                }
                if (r.return_date === todayStr && r.return_time) {
                    const [h, m] = r.return_time.split(':').map(Number)
                    const returnTime = new Date(today)
                    returnTime.setHours(h, m, 0)
                    if (now > returnTime && !['step_7_returned', 'step_6_returning'].includes(r.logistics_status)) {
                        const typeLabel = r.return_type === 'collection' ? 'Coleta' : 'Devolução (Loja)'
                        lateLogistics.push({
                            id: r.id, type: typeLabel, client: r.customers?.name, time: r.return_time, diff: Math.floor((now - returnTime) / (1000 * 60))
                        })
                    }
                }
            })

            // Stock Logic for Alerts
            const rentedPerItem = {}
            activeRentals?.filter(r => ['active', 'in_progress', 'confirmed'].includes(r.status)).forEach(r => {
                r.rental_items?.forEach(ri => {
                    rentedPerItem[ri.item_id] = (rentedPerItem[ri.item_id] || 0) + ri.quantity
                })
            })

            items?.forEach(i => {
                if ((i.maintenance_quantity || 0) > 0) damagedItemsAlerts.push({ id: i.id + '-maint', originalId: i.id, name: i.name, qty: i.maintenance_quantity, status: 'Em Manutenção' })
                if ((i.broken_quantity || 0) > 0) damagedItemsAlerts.push({ id: i.id + '-broken', originalId: i.id, name: i.name, qty: i.broken_quantity, status: 'Avariado' })

                const rented = rentedPerItem[i.id] || 0
                const available = i.total_quantity - i.maintenance_quantity - i.lost_quantity - (i.broken_quantity || 0) - rented
                if (available < 0) stockConflicts.push({ id: i.id, name: i.name, overbooked: Math.abs(available) })
            })

            const criticalStock = items?.filter(i => (i.total_quantity - i.maintenance_quantity - i.lost_quantity) < 2).slice(0, 3)

            // -> FINANCIALS
            const revenueToday = periodRentals?.filter(r => r.created_at.startsWith(todayStr)).reduce((sum, r) => sum + r.total_value, 0) || 0
            const revenuePeriod = periodRentals?.reduce((sum, r) => sum + r.total_value, 0) || 0
            const revenuePrvPeriod = prevPeriodRentals?.reduce((sum, r) => sum + r.total_value, 0) || 0
            const openDeposits = activeRentals?.reduce((sum, r) => sum + (r.security_deposit || 0), 0) || 0
            const totalReceivedPeriod = periodRentals?.reduce((sum, r) => sum + (r.down_payment || 0), 0) || 0
            const paidPercentage = revenuePeriod > 0 ? (totalReceivedPeriod / revenuePeriod) * 100 : 0

            // -> AGENDA (Updated with Store Address Logic)
            const tomorrow = new Date(today)
            tomorrow.setDate(tomorrow.getDate() + 1)
            const tomorrowStr = tomorrow.toISOString().split('T')[0]
            const agendaItems = []

            activeRentals?.forEach(r => {
                const clientAddress = r.address_street
                    ? `${r.address_street}, ${r.address_number} - ${r.address_neighborhood}, ${r.address_city}`
                    : 'Endereço não informado'

                // Delivery / Pickup Agenda
                if (r.delivery_date === todayStr || r.delivery_date === tomorrowStr) {
                    const isPickup = r.delivery_type === 'pickup' // or implied default if not 'delivery'
                    const useAddress = (r.delivery_type === 'delivery') ? clientAddress : storeAddress

                    agendaItems.push({
                        type: 'DELIVERY',
                        date: r.delivery_date,
                        time: r.delivery_time || '08:00',
                        displayTime: r.delivery_time || 'A definir',
                        client: r.customers?.name,
                        address: useAddress,
                        id: r.id,
                        subtype: r.delivery_type
                    })
                }

                // Return / Collection Agenda
                if (r.return_date === todayStr || r.return_date === tomorrowStr) {
                    const isCollection = r.return_type === 'collection'
                    const useAddress = isCollection ? clientAddress : storeAddress

                    agendaItems.push({
                        type: 'RETURN',
                        date: r.return_date,
                        time: r.return_time || '18:00',
                        displayTime: r.return_time || 'A definir',
                        client: r.customers?.name,
                        address: useAddress,
                        id: r.id,
                        subtype: r.return_type
                    })
                }
            })

            agendaItems.sort((a, b) => {
                if (a.date !== b.date) return a.date.localeCompare(b.date)
                return a.time.localeCompare(b.time)
            })

            // -> STOCK, HIGHLIGHTS, KPIs (Simplified for brevity)
            const totalItems = items?.reduce((sum, i) => sum + (i.total_quantity || 0), 0) || 0
            const maintenanceItems = items?.reduce((sum, i) => sum + (i.maintenance_quantity || 0), 0) || 0
            const lostItems = items?.reduce((sum, i) => sum + (i.lost_quantity || 0), 0) || 0
            const brokenItems = items?.reduce((sum, i) => sum + (i.broken_quantity || 0), 0) || 0

            // Calc Rented/Reserved
            let rentedItemsCount = 0
            let reservedItemsCount = 0
            activeRentals?.forEach(r => {
                const isStarted = r.start_date <= todayStr
                const isFuture = r.start_date > todayStr
                const count = r.rental_items?.reduce((s, ri) => s + ri.quantity, 0) || 0
                if (['active', 'in_progress'].includes(r.status) && isStarted) rentedItemsCount += count
                else if (['pending', 'confirmed'].includes(r.status) || (['active', 'in_progress'].includes(r.status) && isFuture)) reservedItemsCount += count
            })
            const availableItems = Math.max(0, totalItems - maintenanceItems - lostItems - brokenItems - rentedItemsCount)
            const activeRentalsCount = activeRentals?.filter(r => ['active', 'in_progress', 'confirmed'].includes(r.status)).length || 0
            const occupancyRate = totalItems > 0 ? (rentedItemsCount / totalItems) * 100 : 0
            const avgTicket = periodRentals?.length > 0 ? (revenuePeriod / periodRentals.length) : 0

            // Clients
            const clientCounts = {}
            periodRentals?.forEach(r => { if (r.customers?.name) clientCounts[r.customers.name] = (clientCounts[r.customers.name] || 0) + 1 })
            const recurringClients = Object.entries(clientCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5)

            // Debt
            const debtMap = {}
            activeRentals?.forEach(r => {
                const pending = Math.max(0, r.total_value - (r.down_payment || 0))
                if (pending > 0.01 && r.customers) { // Check customer exists
                    if (!debtMap[r.customers.id]) debtMap[r.customers.id] = { id: r.customers.id, name: r.customers.name, whatsapp: r.customers.whatsapp, totalDebt: 0, count: 0 }
                    debtMap[r.customers.id].totalDebt += pending
                    debtMap[r.customers.id].count += 1
                }
            })
            const debtClients = Object.values(debtMap).sort((a, b) => b.totalDebt - a.totalDebt).slice(0, 5)

            // Most/Least Rented
            const itemIdCounts = {}
            periodRentals?.forEach(r => r.rental_items?.forEach(ri => itemIdCounts[ri.item_id] = (itemIdCounts[ri.item_id] || 0) + ri.quantity))
            const itemPerformance = items?.map(i => ({ name: i.name, count: itemIdCounts[i.id] || 0 })).sort((a, b) => a.count - b.count) || []
            const leastRentedItem = itemPerformance[0] || null
            const mostRentedItem = itemPerformance[itemPerformance.length - 1] || null

            // Chart
            const chartMap = {}
            const numDaysChart = (parseInt(period) === 30 || parseInt(period) === 7) ? parseInt(period) : 7
            for (let i = numDaysChart - 1; i >= 0; i--) {
                const d = new Date()
                d.setDate(d.getDate() - i)
                chartMap[d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })] = 0
            }
            periodRentals?.forEach(r => {
                const d = new Date(r.created_at)
                const dStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                if (chartMap[dStr] !== undefined) chartMap[dStr] += r.total_value
            })
            const chartData = Object.entries(chartMap).map(([date, value]) => ({ date, value }))

            // Insights
            const insights = []

            // Insight A: Peak Day
            const futureRentalsMap = {}
            activeRentals?.forEach(r => {
                if (['active', 'pending', 'confirmed'].includes(r.status) && r.start_date > todayStr) {
                    futureRentalsMap[r.start_date] = (futureRentalsMap[r.start_date] || 0) + 1
                }
            })
            const peakDay = Object.entries(futureRentalsMap).sort((a, b) => b[1] - a[1])[0]
            if (peakDay && peakDay[1] > 2) {
                insights.push({
                    type: 'busy_day',
                    message: `Dia ${new Date(peakDay[0] + 'T00:00:00').toLocaleDateString('pt-BR')} será agitado!`,
                    sub: `${peakDay[1]} aluguéis agendados.`
                })
            }

            // Insight B: Stock
            if (criticalStock.length > 0) {
                const stockMsg = criticalStock.length === 1
                    ? `${criticalStock[0].name} com estoque baixo.`
                    : `${criticalStock[0].name} e mais ${criticalStock.length - 1} itens.`
                insights.push({ type: 'stock_low', message: 'Atenção ao Estoque', sub: stockMsg })
            }

            // Insight C: Trend
            const calcTrend = revenuePrvPeriod > 0 ? ((revenuePeriod - revenuePrvPeriod) / revenuePrvPeriod) * 100 : 100
            if (calcTrend !== 0 && Math.abs(calcTrend) > 10) {
                insights.push({
                    type: calcTrend > 0 ? 'trend_up' : 'trend_down',
                    message: calcTrend > 0 ? 'Faturamento em alta' : 'Queda no Faturamento',
                    sub: `${Math.abs(calcTrend).toFixed(0)}% ${calcTrend > 0 ? 'acima' : 'abaixo'} do período anterior.`
                })
            }

            // Insight D: General Activity
            if (activeRentalsCount > 5) insights.push({ type: 'info', message: 'Movimentação Constante', sub: `${activeRentalsCount} aluguéis ativos.` })
            if (newClientsCount > 0) insights.push({ type: 'info', message: 'Novos Clientes', sub: `${newClientsCount} novos.` })

            // Fallback
            if (insights.length === 0) {
                insights.push({ type: 'info', message: 'Sistema Operando', sub: 'Tudo tranquilo por enquanto.' })
            }

            // Operational Metrics Calculation
            const todayDate = new Date().toISOString().split('T')[0]

            // 1. Checklist Out (Pending Delivery/Pickup today or earlier that are still just 'confirmed')
            // If status is 'confirmed', it means it hasn't technically started/been picked up yet.
            const checklistOutCount = activeRentals?.filter(r =>
                r.status === 'confirmed' && r.start_date <= todayDate
            ).length || 0

            // 2. Checklist In (Pending Return today or earlier that are still 'active'/'in_progress')
            const checklistInCount = activeRentals?.filter(r =>
                ['active', 'in_progress'].includes(r.status) && r.return_date <= todayDate
            ).length || 0

            // 3. Inactive Items (No rentals in the selected period, assuming period is roughly 30d or using specific logic)
            // We'll use periodRentals to verify activity. 
            // Note: This matches "Sem aluguel > 30d" if period is 30.
            const rentedItemIdsThisPeriod = new Set()
            periodRentals?.forEach(r => {
                r.rental_items?.forEach(ri => rentedItemIdsThisPeriod.add(ri.item_id))
            })
            const inactiveCount = items?.filter(i => !rentedItemIdsThisPeriod.has(i.id)).length || 0

            setData({
                alerts: { overduePayments, overdueReturns, criticalStock, lateLogistics, stockConflicts, damagedItemsAlerts },
                financials: { revenueToday, revenuePeriod, revenuePrvPeriod, toReceive: totalPending, openDeposits, paidPercentage, overdueAmount: totalOverdue },
                stock: { total: totalItems, rented: rentedItemsCount, reserved: reservedItemsCount, maintenance: maintenanceItems, broken: brokenItems, lost: lostItems, available: availableItems },
                agenda: agendaItems.slice(0, 6),
                highlights: { latestOrders: latestOrdersData || [], pendingQuotes: pendingQuotesData || [], debtClients, recurringClients },
                problems: { maintenanceCount: maintenanceItems, brokenCount: brokenItems }, // Keep for backward compatibility if needed
                operational: {
                    broken: brokenItems,
                    checklistOut: checklistOutCount,
                    checklistIn: checklistInCount,
                    inactive: inactiveCount
                },
                kpis: { activeRentals: activeRentalsCount, occupancyRate, avgTicket, newClients: newClientsCount || 0, mostRented: mostRentedItem, leastRented: leastRentedItem },
                chartData,
                insights
            })

        } catch (error) {
            console.error('Error dashboard:', error)
            setError(error.message)
        } finally {
            setLoading(false)
        }
    }

    if (loading) return <div className="p-8 text-center">Carregando Dashboard...</div>

    // Calculations for Trend
    const trend = data.financials.revenuePrvPeriod > 0
        ? ((data.financials.revenuePeriod - data.financials.revenuePrvPeriod) / data.financials.revenuePrvPeriod) * 100
        : 100
    const trendIsPositive = trend >= 0

    return (
        <div className="space-y-8 pb-12">
            {error && <div className="bg-red-500 text-white p-4 mb-4 rounded">{error}</div>}

            {/* ... Alerts, Financials, Stock, Agenda, Highlights ... */}

            {/* 1. CRITICAL ALERTS SECTION */}
            {(data.alerts.overduePayments.length > 0 || data.alerts.overdueReturns.length > 0 || data.alerts.lateLogistics.length > 0 || data.alerts.stockConflicts.length > 0 || data.alerts.damagedItemsAlerts.length > 0) && (
                <div className="space-y-4">
                    <h3 className="text-secondary font-black uppercase tracking-widest text-xs flex items-center gap-2"><AlertTriangle size={14} />Alertas Críticos</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.alerts.overduePayments.map(pay => (<div key={`pay-${pay.id}`} className="bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500 p-4 rounded-r-xl flex justify-between items-center shadow-sm"><div><p className="text-xs font-bold text-red-700 dark:text-red-400 uppercase">🔔 Pagamento Atrasado</p><p className="font-black text-text-primary-light dark:text-white">{pay.client}</p><p className="text-xs text-text-secondary-light">{pay.days} dias de atraso</p></div><div className="text-right"><p className="text-lg font-black text-red-600">R$ {pay.amount.toFixed(2)}</p><button onClick={() => navigate(`/rentals/${pay.id}`)} className="text-[10px] font-bold underline hover:text-red-800">Ver</button></div></div>))}
                        {data.alerts.lateLogistics.map(log => (<div key={`log-${log.id}`} className="bg-purple-50 dark:bg-purple-900/10 border-l-4 border-purple-500 p-4 rounded-r-xl flex justify-between items-center shadow-sm"><div><p className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase flex items-center gap-1">🔔 {log.type === 'Entrega' ? 'Entrega Atrasada' : 'Retirada Atrasada'}</p><p className="font-black text-text-primary-light dark:text-white">{log.client}</p><p className="text-xs text-text-secondary-light">Era p/ ser às {log.time}</p></div><Clock size={20} className="text-purple-600" opacity={0.5} /></div>))}
                        {data.alerts.stockConflicts.map(item => (
                            <div
                                key={`conf-${item.id}`}
                                onClick={() => navigate(`/rentals?search=${encodeURIComponent(item.name)}`)}
                                className="bg-red-100 dark:bg-red-900/30 border-l-4 border-red-700 p-4 rounded-r-xl flex justify-between items-center shadow-sm cursor-pointer hover:shadow-md transition-all"
                            >
                                <div>
                                    <p className="text-xs font-bold text-red-800 dark:text-red-300 uppercase">🔔 Conflito de Estoque</p>
                                    <p className="font-black text-text-primary-light dark:text-white">{item.name}</p>
                                    <p className="text-xs text-red-700 dark:text-red-400 font-bold">Excesso: {item.overbooked} un.</p>
                                </div>
                                <AlertCircle size={20} className="text-red-700" />
                            </div>
                        ))}
                        {data.alerts.overdueReturns.map(ret => (<div key={`ret-${ret.id}`} className="bg-orange-50 dark:bg-orange-900/10 border-l-4 border-orange-500 p-4 rounded-r-xl flex justify-between items-center shadow-sm"><div><p className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase">🔔 Devolução Atrasada</p><p className="font-black text-text-primary-light dark:text-white">{ret.client}</p><p className="text-xs text-text-secondary-light">{ret.days} dias de atraso</p></div><button onClick={() => navigate(`/rentals/${ret.id}`)} className="p-2 bg-white dark:bg-slate-800 rounded-lg text-orange-600 hover:scale-105 transition-transform"><ArrowUpRight size={16} /></button></div>))}
                        {data.alerts.damagedItemsAlerts.map(item => (<div key={`dam-${item.id}`} className="bg-yellow-50 dark:bg-yellow-900/10 border-l-4 border-yellow-500 p-4 rounded-r-xl flex justify-between items-center shadow-sm"><div><p className="text-xs font-bold text-yellow-700 dark:text-yellow-400 uppercase">🔔 {item.status}</p><p className="font-black text-text-primary-light dark:text-white truncate max-w-[150px]">{item.name}</p><p className="text-xs text-text-secondary-light">{item.qty} unidades</p></div><Wrench size={20} className="text-yellow-600" opacity={0.5} /></div>))}
                    </div>
                </div>
            )}


            {/* 3. FINANCIAL SUMMARY */}
            <div>
                <div className="flex justify-between items-end mb-4">
                    <h3 className="text-primary font-black uppercase tracking-widest text-xs flex items-center gap-2">
                        <DollarSign size={14} />
                        Resumo Financeiro
                    </h3>
                    <select
                        className="bg-transparent text-xs font-bold text-text-secondary-light outline-none cursor-pointer"
                        value={period}
                        onChange={(e) => setPeriod(e.target.value)}
                    >
                        <option value="30">Últimos 30 Dias</option>
                        <option value="90">Últimos 90 Dias</option>
                        <option value="all">Filtro: Tudo</option>
                    </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">

                    {/* CARD 1: Faturamento Hoje */}
                    <div className="app-card p-4 flex flex-col justify-between border-l-4 border-primary shadow-sm hover:shadow-md transition-shadow">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Faturamento Hoje</span>
                        <div className="flex justify-between items-end mt-2">
                            <span className="text-2xl font-black text-text-primary-light dark:text-white">R$ {data.financials.revenueToday.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            <div className="p-1.5 bg-primary/10 rounded text-primary"><TrendingUp size={16} /></div>
                        </div>
                        <p className="text-xs font-medium text-slate-400 mt-1">Negócios fechados hoje</p>
                    </div>

                    {/* CARD 2: Faturamento Período */}
                    <div className="app-card p-4 flex flex-col justify-between border-l-4 border-blue-500 shadow-sm hover:shadow-md transition-shadow">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Faturamento ({period === 'all' ? 'Total' : `${period}d`})</span>
                        <div className="flex justify-between items-end mt-2">
                            <span className="text-2xl font-black text-text-primary-light dark:text-white">R$ {data.financials.revenuePeriod.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            <div className={`p-1.5 rounded text-[10px] font-bold ${trendIsPositive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {trendIsPositive ? '▲' : '▼'} {Math.abs(trend).toFixed(0)}%
                            </div>
                        </div>
                        <div className="w-full bg-blue-100 h-1 mt-2 rounded-full overflow-hidden">
                            <div className="bg-blue-500 h-full" style={{ width: `${data.financials.paidPercentage}%` }}></div>
                        </div>
                        <p className="text-xs font-medium text-blue-600 mt-1">{data.financials.paidPercentage.toFixed(0)}% recebido efetivamente</p>
                    </div>

                    {/* CARD 3: Valores a Receber */}
                    <div className="app-card p-4 flex flex-col justify-between border-l-4 border-orange-400 shadow-sm hover:shadow-md transition-shadow">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">A Receber (Geral)</span>
                        <div className="flex justify-between items-end mt-2">
                            <span className="text-2xl font-black text-text-primary-light dark:text-white">R$ {data.financials.toReceive.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            <div className="p-1.5 bg-orange-100 rounded text-orange-600"><Clock size={16} /></div>
                        </div>
                        {data.financials.overdueAmount > 0 ? (
                            <p className="text-xs font-bold text-red-500 mt-1">⚠️ R$ {data.financials.overdueAmount.toFixed(2)} vencidos!</p>
                        ) : (
                            <p className="text-xs font-medium text-slate-400 mt-1">Fluxo saudável</p>
                        )}
                    </div>

                    {/* CARD 4: Cauções em Aberto */}
                    <div className="app-card p-4 flex flex-col justify-between border-l-4 border-slate-400 shadow-sm hover:shadow-md transition-shadow">
                        <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Cauções (Retidas)</span>
                        <div className="flex justify-between items-end mt-2">
                            <span className="text-2xl font-black text-text-primary-light dark:text-white">R$ {data.financials.openDeposits.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            <div className="p-1.5 bg-slate-100 rounded text-slate-600"><AlertCircle size={16} /></div>
                        </div>
                        <p className="text-xs font-medium text-slate-400 mt-1">A devolver após retorno</p>
                    </div>

                </div>
            </div>



            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 3. STOCK STATUS (Left Col) */}
                <div className="space-y-4">
                    {/* SMART INSIGHTS (Premium Extra) */}
                    {data.insights?.length > 0 && (
                        <div className="mb-6">
                            <div
                                onClick={() => setExpandInsights(!expandInsights)}
                                className="flex items-center justify-between cursor-pointer mb-3 group"
                            >
                                <h3 className="text-slate-500 font-black uppercase tracking-widest text-xs flex items-center gap-2">
                                    <Lightbulb size={14} className="text-yellow-500" />
                                    Avisos do Sistema
                                </h3>
                                <span className="text-[10px] text-slate-400 group-hover:text-primary transition-colors">
                                    {expandInsights ? 'Mostrar menos' : `Ver mais (${data.insights.length - 1})`}
                                </span>
                            </div>

                            <div className="space-y-3">
                                {data.insights.slice(0, expandInsights ? undefined : 1).map((insight, idx) => (
                                    <div key={idx} className={`p-4 rounded-xl border-l-4 shadow-sm flex items-start gap-3 transition-all ${insight.type === 'stock_low' ? 'bg-red-50 border-red-500 text-red-800' :
                                        insight.type === 'trend_down' ? 'bg-orange-50 border-orange-500 text-orange-800' :
                                            insight.type === 'trend_up' ? 'bg-emerald-50 border-emerald-500 text-emerald-800' :
                                                'bg-indigo-50 border-indigo-500 text-indigo-800'
                                        }`}>
                                        {insight.type === 'stock_low' || insight.type === 'trend_down' ? <AlertTriangle size={18} className="shrink-0" /> : <Calendar size={18} className="shrink-0" />}
                                        <div>
                                            <p className="text-xs font-bold">{insight.message}</p>
                                            <p className="text-[10px] mt-1 opacity-80 font-medium">{insight.sub}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <h3 className="text-text-secondary-light font-black uppercase tracking-widest text-xs flex items-center gap-2">
                        <Package size={14} />
                        Status de Estoque (Visão Geral)
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-2 gap-3">
                        {/* 1. DISPONÍVEL */}
                        <div onClick={() => navigate('/inventory')} className="app-card p-4 border-l-4 border-emerald-500 cursor-pointer hover:scale-[1.02] transition-transform">
                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Disponível Hoje</p>
                            <p className="text-2xl font-black text-emerald-600">{data.stock.available}</p>
                            <p className="text-[9px] font-bold text-text-secondary-light mt-1">Prontos p/ alugar</p>
                        </div>

                        {/* 2. RESERVADO (Futuro) */}
                        <div onClick={() => navigate('/rentals')} className="app-card p-4 border-l-4 border-blue-400 cursor-pointer hover:scale-[1.02] transition-transform">
                            <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-1">Reservado (Futuro)</p>
                            <p className="text-2xl font-black text-blue-500">{data.stock.reserved}</p>
                            <p className="text-[9px] font-bold text-text-secondary-light mt-1">Agendados/Pendentes</p>
                        </div>

                        {/* 3. EM USO (Alugado) */}
                        <div onClick={() => navigate('/rentals')} className="app-card p-4 border-l-4 border-primary cursor-pointer hover:scale-[1.02] transition-transform">
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Em Uso (Alugado)</p>
                            <p className="text-2xl font-black text-primary">{data.stock.rented}</p>
                            <p className="text-[9px] font-bold text-text-secondary-light mt-1">Com clientes agora</p>
                        </div>

                        {/* 4. MANUTENÇÃO */}
                        <div onClick={() => navigate('/inventory?tab=maintenance')} className="app-card p-4 border-l-4 border-yellow-500 cursor-pointer hover:scale-[1.02] transition-transform">
                            <p className="text-[10px] font-black uppercase tracking-widest text-yellow-600 mb-1">Em Manutenção</p>
                            <p className="text-2xl font-black text-yellow-600">{data.stock.maintenance}</p>
                            <p className="text-[9px] font-bold text-text-secondary-light mt-1">Indisponíveis</p>
                        </div>

                        {/* 5. PERDIDO/BAIXADO */}
                        <div onClick={() => navigate('/inventory?tab=lost')} className="app-card p-4 border-l-4 border-red-500 cursor-pointer hover:scale-[1.02] transition-transform col-span-2 lg:col-span-2">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-red-600 mb-1">Perdas / Avarias</p>
                                    <p className="text-2xl font-black text-red-600">{data.stock.lost + data.stock.broken}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-bold text-text-secondary-light">Perdidos: {data.stock.lost}</p>
                                    <p className="text-[9px] font-bold text-text-secondary-light">Quebrados: {data.stock.broken}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 4. OPERATIONAL AGENDA (Right Col - Wider) */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-text-secondary-light font-black uppercase tracking-widest text-xs flex items-center gap-2">
                        <Truck size={14} />
                        Agenda Operacional (Hoje / Amanhã)
                    </h3>
                    <div className="app-card overflow-hidden min-h-[300px]">
                        {data.agenda.length > 0 ? (
                            <div className="divide-y divide-border-light dark:divide-border-dark">
                                {data.agenda.map((item, idx) => {
                                    // Helper for styles based on exact subtype
                                    let typeLabel = ''
                                    let typeColorBg = ''
                                    let typeColorText = ''
                                    let typeColorBadge = ''
                                    let typeColorBadgeText = ''

                                    if (item.type === 'DELIVERY') {
                                        if (item.subtype === 'pickup') {
                                            typeLabel = 'Retirada na Loja'
                                            typeColorBg = 'bg-orange-100 dark:bg-orange-900/30'
                                            typeColorText = 'text-orange-700 dark:text-orange-300'
                                            typeColorBadge = 'bg-orange-50'
                                            typeColorBadgeText = 'text-orange-600'
                                        } else {
                                            typeLabel = 'Entrega'
                                            typeColorBg = 'bg-blue-100 dark:bg-blue-900/30'
                                            typeColorText = 'text-blue-700 dark:text-blue-300'
                                            typeColorBadge = 'bg-blue-50'
                                            typeColorBadgeText = 'text-blue-600'
                                        }
                                    } else {
                                        // RETURN
                                        if (item.subtype === 'return') { // Client returns to store
                                            typeLabel = 'Devolução na Loja'
                                            typeColorBg = 'bg-emerald-100 dark:bg-emerald-900/30'
                                            typeColorText = 'text-emerald-700 dark:text-emerald-300'
                                            typeColorBadge = 'bg-emerald-50'
                                            typeColorBadgeText = 'text-emerald-600'
                                        } else {
                                            typeLabel = 'Coleta'
                                            typeColorBg = 'bg-purple-100 dark:bg-purple-900/30'
                                            typeColorText = 'text-purple-700 dark:text-purple-300'
                                            typeColorBadge = 'bg-purple-50'
                                            typeColorBadgeText = 'text-purple-600'
                                        }
                                    }

                                    return (
                                        <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group">
                                            <div className="flex items-center gap-4">
                                                <div className={`p-3 rounded-xl font-black text-xs uppercase w-16 text-center leading-tight flex flex-col justify-center ${typeColorBg} ${typeColorText}`}>
                                                    <span className="block opacity-70 text-[10px]">
                                                        {item.time.slice(0, 5)}
                                                    </span>
                                                    <span className="text-[8px]">
                                                        {isSameDay(parseISO(item.date), new Date()) ? 'HOJE' : 'AMANHÃ'}
                                                    </span>
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${typeColorBadge} ${typeColorBadgeText}`}>
                                                            {typeLabel}
                                                        </span>
                                                        <span className="text-xs font-bold text-text-primary-light dark:text-white">{item.client}</span>
                                                    </div>
                                                    <p className="text-xs text-text-secondary-light flex items-center gap-1">
                                                        <Truck size={10} />
                                                        {item.address || 'Endereço não informado'}
                                                    </p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => navigate(`/rentals/${item.id}`)}
                                                className="px-4 py-2 bg-white dark:bg-slate-800 border border-border-light dark:border-border-dark rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors shadow-sm"
                                            >
                                                Ver
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-text-secondary-light opacity-50">
                                <Calendar size={48} className="mb-4" strokeWidth={1} />
                                <p className="font-bold">Agenda livre por enquanto</p>
                                <p className="text-xs">Nenhuma entrega ou retirada prevista para hoje/amanhã.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 5. HIGHLIGHTS (Customers & Orders) */}
            <h3 className="text-text-secondary-light font-black uppercase tracking-widest text-xs flex items-center gap-2 mt-8 mb-4">
                <User size={14} />
                Destaques de Clientes e Pedidos
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* 1. PEDIDOS CONFIRMADOS RECENTES */}
                <div className="app-card overflow-hidden flex flex-col">
                    <div className="p-3 border-b border-border-light dark:border-border-dark bg-emerald-500/5 flex items-center gap-2">
                        <CheckCircle size={14} className="text-emerald-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-500">Últimos Pedidos Confirmados</span>
                    </div>
                    <div className="divide-y divide-border-light dark:divide-border-dark overflow-y-auto max-h-[250px]">
                        {data.highlights.latestOrders?.length > 0 ? data.highlights.latestOrders.map(order => (
                            <button key={order.id} onClick={() => navigate(`/rentals/${order.id}`)} className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group">
                                <p className="text-xs font-black text-text-primary-light dark:text-white truncate transition-transform group-hover:scale-105 origin-left inline-block">{order.customers?.name || 'Cliente'}</p>
                                <div className="flex justify-between items-center mt-1">
                                    <span className="text-[10px] font-medium text-text-secondary-light">{new Date(order.created_at).toLocaleDateString('pt-BR')}</span>
                                    <span className="text-[10px] font-black text-primary">R$ {order.total_value.toFixed(2)}</span>
                                </div>
                            </button>
                        )) : <p className="p-4 text-xs text-center opacity-50">Sem pedidos recentes</p>}
                    </div>
                </div>

                {/* 2. ORÇAMENTOS PENDENTES */}
                <div className="app-card overflow-hidden flex flex-col">
                    <div className="p-3 border-b border-border-light dark:border-border-dark bg-blue-500/5 flex items-center gap-2">
                        <Clock size={14} className="text-blue-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-500">Orçamentos Aguardando</span>
                    </div>
                    <div className="divide-y divide-border-light dark:divide-border-dark overflow-y-auto max-h-[250px]">
                        {data.highlights.pendingQuotes?.length > 0 ? data.highlights.pendingQuotes.map(quote => (
                            <button key={quote.id} onClick={() => navigate(`/rentals/${quote.id}`)} className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-between group">
                                <div>
                                    <p className="text-xs font-black text-text-primary-light dark:text-white truncate max-w-[120px]">{quote.customers?.name || 'Prospect'}</p>
                                    <span className="text-[10px] font-medium text-text-secondary-light">{new Date(quote.created_at).toLocaleDateString('pt-BR')}</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-blue-600">R$ {quote.total_value.toFixed(2)}</p>
                                    <span className="text-[9px] font-bold text-blue-400 group-hover:underline">Responder</span>
                                </div>
                            </button>
                        )) : <p className="p-4 text-xs text-center opacity-50">Sem orçamentos pendentes</p>}
                    </div>
                </div>

                {/* 3. CLIENTES C/ PENDÊNCIA */}
                <div className="app-card overflow-hidden flex flex-col">
                    <div className="p-3 border-b border-border-light dark:border-border-dark bg-red-500/5 flex items-center gap-2">
                        <AlertTriangle size={14} className="text-red-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-red-700 dark:text-red-500">Pendências Financeiras</span>
                    </div>
                    <div className="divide-y divide-border-light dark:divide-border-dark overflow-y-auto max-h-[250px]">
                        {data.highlights.debtClients?.length > 0 ? data.highlights.debtClients.map(client => (
                            <div key={client.id} className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex justify-between items-center">
                                <div>
                                    <p className="text-xs font-black text-text-primary-light dark:text-white truncate max-w-[120px]">{client.name}</p>
                                    <a href={`https://wa.me/55${client.whatsapp?.replace(/\D/g, '') || ''}`} target="_blank" rel="noreferrer" className="text-[9px] font-bold text-green-600 hover:underline flex items-center gap-1">
                                        WhatsApp
                                    </a>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-red-600">R$ {client.totalDebt.toFixed(2)}</p>
                                    <span className="text-[9px] opacity-60 text-text-secondary-light">{client.count} alugueis</span>
                                </div>
                            </div>
                        )) : <p className="p-4 text-xs text-center opacity-50">Nenhuma pendência crítica</p>}
                    </div>
                </div>

                {/* 4. CLIENTES FIÉIS */}
                <div className="app-card overflow-hidden flex flex-col">
                    <div className="p-3 border-b border-border-light dark:border-border-dark bg-purple-500/5 flex items-center gap-2">
                        <TrendingUp size={14} className="text-purple-600" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-purple-700 dark:text-purple-500">Clientes Recorrentes ({period === 'all' ? 'Total' : `${period}d`})</span>
                    </div>
                    <div className="divide-y divide-border-light dark:divide-border-dark overflow-y-auto max-h-[250px]">
                        {data.highlights.recurringClients?.length > 0 ? data.highlights.recurringClients.map((client, idx) => (
                            <div key={idx} className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center text-[10px] font-black">{idx + 1}</div>
                                    <p className="text-xs font-black text-text-primary-light dark:text-white truncate max-w-[120px]">{client.name}</p>
                                </div>
                                <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/20 text-purple-700 rounded-full text-[9px] font-bold">{client.count} pedidos</span>
                            </div>
                        )) : <p className="p-4 text-xs text-center opacity-50">Sem dados suficientes</p>}
                    </div>
                </div>

            </div>

            {/* 7. SIMPLE KPIs (Bottom Row) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="app-card p-4 flex flex-col items-center justify-center text-center hover:scale-105 transition-transform">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Item Mais Alugado</span>
                    <span className="text-sm font-black text-primary truncate w-full px-2" title={data.kpis.mostRented?.name || '-'}>{data.kpis.mostRented?.name || '-'}</span>
                    <span className="text-xs text-slate-500 mt-1">{data.kpis.mostRented?.count || 0} aluguéis</span>
                </div>
                <div className="app-card p-4 flex flex-col items-center justify-center text-center hover:scale-105 transition-transform">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Item Menos Alugado</span>
                    <span className="text-sm font-black text-red-500 truncate w-full px-2" title={data.kpis.leastRented?.name || '-'}>{data.kpis.leastRented?.name || '-'}</span>
                    <span className="text-xs text-slate-500 mt-1">{data.kpis.leastRented?.count || 0} aluguéis</span>
                </div>
                <div className="app-card p-4 flex flex-col items-center justify-center text-center hover:scale-105 transition-transform">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Ticket Médio</span>
                    <span className="text-xl font-black text-blue-500">R$ {data.kpis.avgTicket.toFixed(2)}</span>
                </div>
                <div className="app-card p-4 flex flex-col items-center justify-center text-center hover:scale-105 transition-transform">
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">Ocupação Estoque</span>
                    <span className="text-xl font-black text-secondary">{data.kpis.occupancyRate.toFixed(0)}%</span>
                </div>
            </div>

            {/* 8. OPERATIONAL ALERTS (Problemas Operacionais) - Moved to Bottom */}
            <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark flex items-center gap-2 mt-8">
                <Wrench className="text-primary" size={24} />
                Problemas Operacionais
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Broken Items */}
                <div className="app-card p-4 hover:scale-105 transition-transform cursor-pointer border-l-4 border-l-red-500" onClick={() => navigate('/inventory?tab=broken')}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light">Itens Quebrados</span>
                        <Hammer className="text-red-500" size={20} />
                    </div>
                    <span className="text-2xl font-black text-text-primary dark:text-text-primary-dark">
                        {data.operational?.broken || 0}
                    </span>
                    <span className="text-xs text-text-secondary-light block mt-1">Não resolvidos</span>
                </div>

                {/* Missing Checklist Out */}
                <div className="app-card p-4 hover:scale-105 transition-transform cursor-pointer border-l-4 border-l-orange-500" onClick={() => navigate('/rentals')}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light">Checklist Saída</span>
                        <Package className="text-orange-500" size={20} />
                    </div>
                    <span className="text-2xl font-black text-text-primary dark:text-text-primary-dark">
                        {data.operational?.checklistOut || 0}
                    </span>
                    <span className="text-xs text-text-secondary-light block mt-1">Pendentes de hoje</span>
                </div>

                {/* Missing Checklist In */}
                <div className="app-card p-4 hover:scale-105 transition-transform cursor-pointer border-l-4 border-l-orange-500" onClick={() => navigate('/rentals')}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light">Checklist Retorno</span>
                        <ClipboardList className="text-orange-500" size={20} />
                    </div>
                    <span className="text-2xl font-black text-text-primary dark:text-text-primary-dark">
                        {data.operational?.checklistIn || 0}
                    </span>
                    <span className="text-xs text-text-secondary-light block mt-1">Devoluções s/ conferência</span>
                </div>

                {/* Inactive Items */}
                <div className="app-card p-4 hover:scale-105 transition-transform cursor-pointer border-l-4 border-l-slate-400" onClick={() => navigate('/inventory')}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light">Itens Parados</span>
                        <Clock className="text-slate-400" size={20} />
                    </div>
                    <span className="text-2xl font-black text-text-primary dark:text-text-primary-dark">
                        {data.operational?.inactive || 0}
                    </span>
                    <span className="text-xs text-text-secondary-light block mt-1">Sem aluguel &gt; 30d</span>
                </div>
            </div>

            {/* CHART (Moved to Bottom as Requested) */}
            <div className="mt-8 app-card p-6 border-l-4 border-indigo-500 shadow-sm min-h-[300px]">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                    <BarChart2 size={16} className="text-indigo-500" />
                    Evolução de Faturamento (Diário)
                </h3>
                <div ref={chartContainerRef} className="mt-4 w-full" style={{ height: 320, minWidth: 0, position: 'relative' }}>
                    {chartWidth > 0 && (
                        <BarChart width={chartWidth} height={320} data={data.chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fill: '#94a3b8' }}
                                tickFormatter={(value) => `R$${value}`}
                            />
                            <RechartsTooltip
                                cursor={{ fill: '#f1f5f9' }}
                                contentStyle={{
                                    backgroundColor: '#fff',
                                    borderRadius: '8px',
                                    border: 'none',
                                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                                }}
                                itemStyle={{ color: '#1e293b', fontWeight: 'bold' }}
                                labelStyle={{ color: '#64748b', marginBottom: '0.25rem', fontSize: '10px', textTransform: 'uppercase' }}
                                formatter={(value) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Faturamento']}
                            />
                            <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    )}
                </div>
            </div>
        </div>
    )
}

import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, Package, TrendingUp, Users, DollarSign, Calendar, Clock, Plus, Eye, AlertTriangle, ArrowDown } from 'lucide-react'
import { useDialog } from '../components/DialogProvider'
import PageTitle from '../components/PageTitle'

export default function ItemDetails() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [item, setItem] = useState(null)
    const [history, setHistory] = useState([])
    const [stats, setStats] = useState({
        totalRevenue: 0,
        rentalsCount: 0,
        availableStock: 0
    })
    const [settings, setSettings] = useState(null)
    const [activeTab, setActiveTab] = useState('history')
    const { confirm, alert: dialogAlert, prompt, success, error: toastError } = useDialog()

    async function handleUpdateFine(type, value) {
        if (!item) return

        const numericValue = parseFloat(value)
        if (isNaN(numericValue) || numericValue < 0) return

        const updates = {}
        if (type === 'damage') updates.damage_fine = numericValue
        if (type === 'lost') updates.lost_fine = numericValue

        try {
            const { error } = await supabase
                .from('items')
                .update(updates)
                .eq('id', id)

            if (error) throw error

            setItem(prev => ({ ...prev, ...updates }))
            // Optional: Show a subtle success toast or indicator? Keeping it silent/seamless for now unless error.
        } catch (error) {
            console.error('Error updating fine:', error)
            toastError('Erro ao salvar valor da multa')
        }
    }

    async function handleStockAdjustment(type, amount) {
        if (!item) return
        // ... (omitting unchanged lines for brevity in thought process, but need to be precise in replacement)
        // Actually I simply insert the state and the fetch logic.

        let qty = amount
        if (qty === undefined) {
            let promptMsg = ''
            if (type === 'maintenance') promptMsg = 'Quantos itens deseja enviar para manutenção?'
            else if (type === 'lost') promptMsg = 'Quantos itens deseja reportar como perda?'
            else if (type === 'broken') promptMsg = 'Quantos itens deseja reportar como avaria/quebra?'

            const response = await prompt(promptMsg, '1', 'Ajuste de Estoque')
            if (response === null) return
            qty = parseInt(response)
        }

        if (isNaN(qty) || qty <= 0) {
            toastError('Quantidade inválida')
            return
        }

        const currentMaintenance = item.maintenance_quantity || 0
        const currentLost = item.lost_quantity || 0
        const currentBroken = item.broken_quantity || 0

        const newMaintenance = type === 'maintenance' ? Math.max(0, currentMaintenance + qty) : currentMaintenance
        const newLost = type === 'lost' ? Math.max(0, currentLost + qty) : currentLost
        const newBroken = type === 'broken' ? Math.max(0, currentBroken + qty) : currentBroken

        const updates = {
            maintenance_quantity: newMaintenance,
            lost_quantity: newLost,
            broken_quantity: newBroken
        }

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error('User not authenticated')

            // 1. Update item counters
            const { error: itemError } = await supabase
                .from('items')
                .update(updates)
                .eq('id', id)

            if (itemError) throw itemError

            if (qty > 0) {
                const logTable = type === 'maintenance' ? 'maintenance_logs' : type === 'lost' ? 'lost_logs' : 'broken_logs'
                const { error: logError } = await supabase
                    .from(logTable)
                    .insert({
                        item_id: id,
                        user_id: user.id,
                        quantity: qty,
                        status: 'OPEN'
                    })
                if (logError) {
                    console.error(`Erro ao criar log em ${logTable}:`, logError)
                    throw new Error(`Falha ao registrar histórico de ${type === 'maintenance' ? 'manutenção' : type === 'lost' ? 'perda' : 'avaria'}.`)
                }
            }

            setItem(prev => ({ ...prev, ...updates }))
            success('Estoque ajustado com sucesso!')
            fetchItemData()
        } catch (error) {
            console.error('Error adjusting stock:', error)
            toastError(error.message || 'Erro ao ajustar estoque')
        }
    }

    useEffect(() => {
        if (id) {
            fetchItemData()
        }
    }, [id])

    async function fetchItemData() {
        try {
            setLoading(true)

            // 1. Fetch Item Info
            const { data: itemData, error: itemError } = await supabase
                .from('items')
                .select('*')
                .eq('id', id)
                .single()

            if (itemError) throw itemError
            setItem(itemData)

            // 1.1 Fetch User Settings for Late Fees
            const { data: settingsData } = await supabase
                .from('user_settings')
                .select('late_fee_type, late_fee_value')
                .eq('user_id', (await supabase.auth.getUser()).data.user.id)
                .maybeSingle()

            setSettings(settingsData)

            // 2. Fetch Item Usage History
            const { data: historyData, error: histError } = await supabase
                .from('rental_items')
                .select(`
                    quantity,
                    unit_price,
                    rentals!inner (
                        id,
                        start_date,
                        end_date,
                        status,
                        type,
                        customers (name)
                    )
                `)
                .eq('item_id', id)
                .neq('rentals.status', 'canceled')
                .or('type.eq.rental,type.is.null', { foreignTable: 'rentals' })
                .order('rentals(start_date)', { ascending: false })

            if (histError) throw histError

            // Calculate Metrics
            let totalRevenue = 0
            let rentalsCount = 0

            const processedHistory = (historyData || []).map(entry => {
                const rental = entry.rentals
                const start = new Date(rental.start_date + 'T00:00:00')
                const end = new Date(rental.end_date + 'T00:00:00')
                const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1
                const entryRevenue = entry.unit_price * entry.quantity * diffDays

                if (rental.status !== 'canceled') {
                    totalRevenue += entryRevenue
                    rentalsCount++
                }

                return {
                    rentalId: rental.id,
                    customer: rental.customers?.name,
                    date: rental.start_date,
                    endDate: rental.end_date,
                    duration: diffDays,
                    quantity: entry.quantity,
                    revenue: entryRevenue,
                    status: rental.status
                }
            })

            setHistory(processedHistory)
            setStats({
                totalRevenue,
                rentalsCount,
                availableStock: itemData.total_quantity || 0
            })

        } catch (error) {
            console.error('Error fetching item data:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <p className="mt-4 text-text-secondary-light dark:text-text-secondary-dark font-medium uppercase tracking-widest text-xs">Carregando detalhes...</p>
        </div>
    )

    if (!item) return (
        <div className="text-center py-20">
            <div className="p-4 bg-danger/10 text-danger rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Package size={32} />
            </div>
            <h3 className="text-xl font-bold">Item não encontrado</h3>
            <button onClick={() => navigate('/inventory')} className="mt-4 text-primary font-bold hover:underline">Voltar para o catálogo</button>
        </div>
    )

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
            <PageTitle title={`${item.name} | Detalhes`} />
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/inventory')}
                    className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className="text-2xl font-black tracking-tight text-text-primary-light dark:text-text-primary-dark uppercase">Detalhes do Produto</h2>
                    <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm font-medium">Análise de rentabilidade e histórico de uso.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Item Hero Card */}
                    <div className="app-card overflow-hidden">
                        <div className="flex flex-col md:flex-row">
                            <div className="w-full md:w-64 h-64 bg-white dark:bg-slate-900/50 flex items-center justify-center p-6 border-b md:border-b-0 md:border-r border-border-light dark:border-border-dark">
                                {item.photo_url ? (
                                    <img
                                        src={item.photo_url}
                                        alt={item.name}
                                        className="w-full h-full object-contain transition-transform hover:scale-110 duration-500"
                                    />
                                ) : (
                                    <div className="text-text-secondary-light/20">
                                        <Package size={80} strokeWidth={0.5} />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 p-6 md:p-8 flex flex-col justify-center">
                                <h3 className="text-2xl font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-tight leading-tight mb-2">
                                    {item.name}
                                </h3>
                                <div className="flex items-center gap-2 mb-6">
                                    <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[9px] font-black text-text-secondary-light tracking-widest uppercase">ID: #{item.id.slice(0, 8)}</span>
                                </div>

                                <div className="flex items-baseline gap-1 mb-6">
                                    <span className="text-primary text-3xl font-black tabular-nums tracking-tighter">
                                        R$ {Number(item.daily_price).toFixed(2)}
                                    </span>
                                    <span className="text-[10px] font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-widest opacity-50">/ dia</span>
                                </div>

                                <div className="flex flex-col gap-2 mb-6 p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl w-full sm:w-fit">
                                    <div className="flex items-center gap-3">
                                        <div className="flex flex-col">
                                            <label htmlFor="damage_fine_input" className="text-[9px] font-black text-orange-500 uppercase tracking-widest mb-1">Multa Avaria</label>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-orange-500 font-bold text-xs">R$</span>
                                                <input
                                                    id="damage_fine_input"
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    className="w-24 pl-6 pr-2 py-1.5 bg-white dark:bg-slate-900 border border-orange-200 dark:border-orange-900/30 rounded-lg text-xs font-black text-orange-500 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 outline-none transition-all"
                                                    defaultValue={item.damage_fine}
                                                    onBlur={(e) => handleUpdateFine('damage', e.target.value)}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                        <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 mx-1"></div>
                                        <div className="flex flex-col">
                                            <label htmlFor="lost_fine_input" className="text-[9px] font-black text-danger uppercase tracking-widest mb-1">Multa Perda</label>
                                            <div className="relative">
                                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-danger font-bold text-xs">R$</span>
                                                <input
                                                    id="lost_fine_input"
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    className="w-24 pl-6 pr-2 py-1.5 bg-white dark:bg-slate-900 border border-danger/20 dark:border-danger/30 rounded-lg text-xs font-black text-danger focus:ring-2 focus:ring-danger/20 focus:border-danger outline-none transition-all"
                                                    defaultValue={item.lost_fine}
                                                    onBlur={(e) => handleUpdateFine('lost', e.target.value)}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-slate-400 font-medium italic">Valores salvos automaticamente</p>
                                </div>

                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-border-light dark:border-border-dark min-w-0">
                                        <p className="text-[9px] font-black text-text-secondary-light/60 dark:text-text-secondary-dark/60 uppercase tracking-wider mb-1 truncate">Estoque Total</p>
                                        <p className="font-bold text-text-primary-light dark:text-text-primary-dark truncate">{item.total_quantity || 0} un.</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-border-light dark:border-border-dark min-w-0">
                                        <p className="text-[9px] font-black text-warning/80 uppercase tracking-wider mb-1 truncate">Manutenção</p>
                                        <p className="font-bold text-text-primary-light dark:text-text-primary-dark truncate">{item.maintenance_quantity || 0} un.</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-border-light dark:border-border-dark min-w-0">
                                        <p className="text-[9px] font-black text-orange-500/80 uppercase tracking-wider mb-1 truncate">Avaria/Quebra</p>
                                        <p className="font-bold text-text-primary-light dark:text-text-primary-dark truncate">{item.broken_quantity || 0} un.</p>
                                    </div>
                                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-border-light dark:border-border-dark min-w-0">
                                        <p className="text-[9px] font-black text-danger/80 uppercase tracking-wider mb-1 truncate">Perdas/Baixas</p>
                                        <p className="font-bold text-text-primary-light dark:text-text-primary-dark truncate">{item.lost_quantity || 0} un.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabs Selection */}
                    <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-fit">
                        {['history', 'timeline'].map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-6 py-2.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all ${activeTab === tab
                                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                    : 'text-text-secondary-light hover:text-text-primary-light'
                                    }`}
                            >
                                {tab === 'history' ? 'Histórico de Lucro' : 'Timeline de Reservas'}
                            </button>
                        ))}
                    </div>

                    {activeTab === 'history' ? (
                        <div className="app-card overflow-hidden">
                            <div className="p-6 border-b border-border-light dark:border-border-dark flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TrendingUp size={18} className="text-text-secondary-light" />
                                    <h3 className="font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-wide text-sm">Histórico de Rentabilidade</h3>
                                </div>
                                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark">
                                    {history.length} locações
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="app-table">
                                    <thead>
                                        <tr>
                                            <th className="px-4 py-3 text-left font-black uppercase text-xs tracking-wider text-text-secondary-light dark:text-text-secondary-dark">Cliente / Status</th>
                                            <th className="px-4 py-3 text-center font-black uppercase text-xs tracking-wider text-text-secondary-light dark:text-text-secondary-dark">Período</th>
                                            <th className="px-4 py-3 text-center font-black uppercase text-xs tracking-wider text-text-secondary-light dark:text-text-secondary-dark">Duração</th>
                                            <th className="px-4 py-3 text-center font-black uppercase text-xs tracking-wider text-text-secondary-light dark:text-text-secondary-dark">Qtd</th>
                                            <th className="px-4 py-3 text-right font-black uppercase text-xs tracking-wider text-text-secondary-light dark:text-text-secondary-dark">Rendimento</th>
                                            <th className="px-4 py-3 text-right"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                        {history.map((entry, idx) => {
                                            const endDate = new Date(entry.endDate + 'T00:00:00')
                                            const today = new Date()
                                            today.setHours(0, 0, 0, 0)
                                            // Check if active and past due date
                                            const isLate = entry.status === 'active' && endDate < today && today.getTime() !== endDate.getTime()

                                            let daysLate = 0
                                            let lateFee = 0

                                            if (isLate) {
                                                const diffTime = Math.abs(today - endDate)
                                                daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

                                                if (settings?.late_fee_value) {
                                                    if (settings.late_fee_type === 'percent') {
                                                        // Assuming percent of daily price * days late OR percent of total contract? 
                                                        // Usually "Juros por dia de atraso" implies % of the total debt per day. 
                                                        // Let's assume % of Total Revenue of the contract per day for now as it's "Penalty".
                                                        lateFee = (settings.late_fee_value / 100) * entry.revenue * daysLate
                                                    } else {
                                                        lateFee = settings.late_fee_value * daysLate
                                                    }
                                                }
                                            }

                                            return (
                                                <tr key={idx} className={`group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${entry.status === 'canceled' ? 'opacity-40 grayscale' : ''}`}>
                                                    <td className="px-4 py-4 border-b border-border-light dark:border-border-dark align-middle">
                                                        <div className="font-bold text-text-primary-light dark:text-text-primary-dark uppercase text-sm mb-1">{entry.customer}</div>
                                                        <div className="flex flex-col items-start gap-1">
                                                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-text-secondary-light dark:text-text-secondary-dark">
                                                                {entry.status === 'active' && !isLate && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>}
                                                                {isLate && <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse"></span>}
                                                                {entry.status === 'completed' && <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>}
                                                                {entry.status === 'canceled' && <span className="w-1.5 h-1.5 rounded-full bg-danger"></span>}
                                                                {entry.status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-warning"></span>}

                                                                {isLate ? 'Atrasado' :
                                                                    entry.status === 'active' ? 'Em andamento' :
                                                                        entry.status === 'completed' ? 'Devolvido' :
                                                                            entry.status === 'canceled' ? 'Cancelado' : 'Pendente'}
                                                            </div>
                                                            {isLate && (
                                                                <span className="text-[10px] font-bold text-danger flex items-center gap-1">
                                                                    <Clock size={10} />
                                                                    {daysLate} {daysLate === 1 ? 'dia' : 'dias'} de atraso
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 border-b border-border-light dark:border-border-dark align-middle text-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className="text-xs font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                                                {new Date(entry.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                                            </span>
                                                            <span className="text-[10px] text-text-secondary-light/40">até</span>
                                                            <span className={`text-xs font-black px-2 py-1 rounded ${isLate ? 'bg-danger/10 text-danger border border-danger/20' : 'bg-slate-50 dark:bg-slate-800/50 text-text-secondary-light dark:text-text-secondary-dark'}`}>
                                                                {endDate.toLocaleDateString('pt-BR')}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 border-b border-border-light dark:border-border-dark align-middle text-center text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wide">
                                                        {entry.duration} dias
                                                    </td>
                                                    <td className="px-4 py-4 border-b border-border-light dark:border-border-dark align-middle text-center font-bold text-text-primary-light dark:text-text-white">
                                                        {entry.quantity}
                                                    </td>
                                                    <td className={`px-4 py-4 border-b border-border-light dark:border-border-dark align-middle text-right font-black ${entry.status === 'canceled' ? 'text-text-secondary-light' : 'text-secondary'}`}>
                                                        <div className="flex flex-col items-end">
                                                            <span>R$ {entry.revenue.toFixed(2)}</span>
                                                            {isLate && lateFee > 0 && (
                                                                <span className="text-[10px] text-danger font-bold">
                                                                    + Juros R$ {lateFee.toFixed(2)}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 border-b border-border-light dark:border-border-dark align-middle text-right">
                                                        <Link
                                                            to={`/rentals/${entry.rentalId}`}
                                                            className="p-2 text-text-secondary-light dark:text-text-secondary-dark hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all border border-border-light dark:border-border-dark shadow-sm inline-block"
                                                        >
                                                            <Clock size={16} />
                                                        </Link>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                        {history.length === 0 && (
                                            <tr>
                                                <td colSpan="5" className="p-12 text-center">
                                                    <p className="text-text-secondary-light/40 italic text-sm">Este produto ainda não gerou receita.</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="app-card p-6 space-y-6">
                            <div className="flex items-center gap-2 mb-2">
                                <Calendar size={18} className="text-primary" />
                                <h3 className="font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-wide text-sm">Compromissos Futuros</h3>
                            </div>

                            <div className="space-y-4">
                                {history
                                    .filter(h => h.status !== 'canceled' && new Date(h.date + 'T23:59:59') >= new Date())
                                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                                    .map((res, idx) => (
                                        <div key={idx} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-border-light dark:border-border-dark group">
                                            <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-800 border border-border-light dark:border-border-dark flex flex-col items-center justify-center shadow-sm">
                                                <span className="text-[10px] font-black uppercase text-text-secondary-light leading-none">{new Date(res.date + 'T00:00:00').toLocaleString('pt-BR', { month: 'short' })}</span>
                                                <span className="text-lg font-black text-primary leading-tight">{new Date(res.date + 'T00:00:00').getDate()}</span>
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-xs font-black uppercase text-text-primary-light mb-0.5">{res.customer}</p>
                                                <p className="text-[10px] font-bold text-text-secondary-light uppercase tracking-widest">Reserva: {res.quantity} unidades</p>
                                            </div>
                                            <div className="text-right">
                                                <span className="px-3 py-1 bg-secondary/10 text-secondary rounded-lg text-[10px] font-black uppercase tracking-widest">Reservado</span>
                                            </div>
                                        </div>
                                    ))}

                                {history.filter(h => h.status !== 'canceled' && new Date(h.date + 'T23:59:59') >= new Date()).length === 0 && (
                                    <div className="py-12 text-center">
                                        <p className="text-text-secondary-light/40 italic text-sm">Nenhuma reserva futura para este item.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar Stats & Actions */}
                <div className="space-y-6">
                    {/* Profit Card */}
                    <div className="app-card p-6 bg-gradient-to-br from-secondary to-green-600 text-white border-none shadow-xl shadow-secondary/20">
                        <div className="flex items-center gap-2 opacity-70 mb-4">
                            <TrendingUp size={16} />
                            <p className="text-xs font-black uppercase tracking-widest">Receita Acumulada</p>
                        </div>
                        <h4 className="text-4xl font-black tabular-nums tracking-tighter mb-2 whitespace-nowrap">
                            <span className="text-lg opacity-50 mr-1">R$</span>
                            {stats.totalRevenue.toFixed(2)}
                        </h4>
                        <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest border-t border-white/10 pt-4 mt-4">
                            Rendimento total em contratos válidos
                        </p>
                    </div>

                    {/* Quick Stats */}
                    <div className="app-card p-6 space-y-4">
                        <div className="flex justify-between items-center pb-4 border-b border-border-light dark:border-border-dark">
                            <div className="flex items-center gap-2 text-text-secondary-light dark:text-text-secondary-dark">
                                <Users size={16} />
                                <span className="text-xs font-bold uppercase tracking-widest">Locações</span>
                            </div>
                            <span className="text-xl font-black text-text-primary-light dark:text-text-primary-dark tabular-nums">{stats.rentalsCount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2 text-text-secondary-light dark:text-text-secondary-dark">
                                <DollarSign size={16} />
                                <span className="text-xs font-bold uppercase tracking-widest">Ticket Médio</span>
                            </div>
                            <span className="text-lg font-black text-primary tabular-nums">
                                R$ {stats.rentalsCount > 0 ? (stats.totalRevenue / stats.rentalsCount).toFixed(2) : '0.00'}
                            </span>
                        </div>
                    </div>

                    {/* Inventory Adjustments */}
                    <div className="app-card p-6 space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-secondary-light/60 mb-4">Ajustes Rápidos</h4>

                        <div className="space-y-3">
                            <button
                                onClick={() => handleStockAdjustment('maintenance')}
                                className="w-full flex items-center justify-between p-3 bg-warning/5 hover:bg-warning/10 border border-warning/20 rounded-xl text-warning transition-all group"
                            >
                                <span className="text-xs font-black uppercase tracking-widest text-warning/80">Enviar p/ Manutenção</span>
                                <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                            </button>

                            <button
                                onClick={() => handleStockAdjustment('broken')}
                                className="w-full flex items-center justify-between p-3 bg-secondary/5 hover:bg-secondary/10 border border-secondary/20 rounded-xl text-secondary transition-all group"
                            >
                                <span className="text-xs font-black uppercase tracking-widest text-secondary-hover">Reportar Avaria/Quebra</span>
                                <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                            </button>

                            <button
                                onClick={() => handleStockAdjustment('lost')}
                                className="w-full flex items-center justify-between p-3 bg-danger/5 hover:bg-danger/10 border border-danger/20 rounded-xl text-danger transition-all group"
                            >
                                <span className="text-xs font-black uppercase tracking-widest text-danger/80">Reportar Perda</span>
                                <Plus size={16} className="group-hover:rotate-90 transition-transform" />
                            </button>

                            <div className="pt-2">
                                <Link
                                    to={`/inventory/${item.id}`}
                                    className="w-full flex items-center justify-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 border border-border-light dark:border-border-dark rounded-xl text-text-secondary-light font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                                >
                                    <Clock size={16} />
                                    <span>Editar Tudo</span>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

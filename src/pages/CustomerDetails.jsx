import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { ArrowLeft, User, Phone, Mail, FileText, DollarSign, Calendar, Clock, CheckCircle, XCircle, StickyNote, Edit3, AlertCircle, MapPin, Crown, Package, PlusCircle, MessageCircle } from 'lucide-react'
import { useDialog } from '../components/DialogProvider'

export default function CustomerDetails() {
    const { id } = useParams()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const [customer, setCustomer] = useState(null)
    const [rentals, setRentals] = useState([])
    const [damages, setDamages] = useState([])
    const [activeTab, setActiveTab] = useState('rentals') // 'rentals', 'observations', or 'damages'
    const [settings, setSettings] = useState(null)
    const { alert: dialogAlert, success, error: toastError } = useDialog()
    const [stats, setStats] = useState({
        totalSpent: 0,
        rentalsCount: 0,
        activeRentals: 0,
        totalDue: 0,
        damagesCount: 0
    })

    useEffect(() => {
        if (id) {
            fetchCustomerData()
        }
    }, [id])

    async function fetchCustomerData() {
        try {
            setLoading(true)

            // 1. Fetch Customer Info
            const { data: custData, error: custError } = await supabase
                .from('customers')
                .select('*')
                .eq('id', id)
                .single()

            if (custError) throw custError
            setCustomer(custData)

            // 2. Fetch Customer Rentals
            const { data: rentData, error: rentError } = await supabase
                .from('rentals')
                .select(`
                    *,
                    rental_items (
                        quantity,
                        items (name)
                    )
                `)
                .eq('client_id', id)
                .order('start_date', { ascending: false })

            if (rentError) throw rentError
            setRentals(rentData || [])

            const rentalIds = (rentData || []).map(r => r.id)

            // 3. Fetch Damages (Broken and Lost logs linked to these rentals)
            let brokenLogs = []
            let lostLogs = []
            let checklistDamages = []

            if (rentalIds.length > 0) {
                const { data: blurs } = await supabase
                    .from('broken_logs')
                    .select('*, items(name)')
                    .in('rental_id', rentalIds)

                const { data: llurs } = await supabase
                    .from('lost_logs')
                    .select('*, items(name)')
                    .in('rental_id', rentalIds)

                const { data: clurs } = await supabase
                    .from('rental_checklists')
                    .select('*, items(name)')
                    .in('rental_id', rentalIds)
                    .neq('status', 'OK')
                    .eq('stage', 'CHECKIN')

                checklistDamages = clurs || []
            }

            const combinedDamages = [
                ...brokenLogs.map(l => ({ ...l, type: 'BROKEN', entry_date: l.entry_date })),
                ...lostLogs.map(l => ({ ...l, type: 'LOST', entry_date: l.entry_date })),
                ...checklistDamages.map(l => ({ ...l, type: l.status, entry_date: l.created_at }))
            ].sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date))

            setDamages(combinedDamages)

            // 4. Fetch Settings for late fee rules
            const { data: { user } } = await supabase.auth.getUser()
            let settingsData = null
            if (user) {
                const { data } = await supabase
                    .from('user_settings')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle()
                settingsData = data
            }
            setSettings(settingsData)

            // 5. Calculate Stats
            const validRentals = rentData.filter(r => r.status !== 'canceled')
            const totalSpent = validRentals.reduce((sum, r) => sum + (r.total_value || 0), 0)
            const activeRentals = rentData.filter(r => r.status === 'active').length

            setStats({
                totalSpent,
                rentalsCount: rentData.length,
                activeRentals,
                damagesCount: combinedDamages.length,
                totalDue: validRentals.reduce((sum, r) => {
                    let lateFee = 0
                    const endDate = new Date(r.end_date + 'T00:00:00')
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)

                    if (r.status === 'completed') {
                        lateFee = r.late_fee_amount || 0
                    } else if (r.status === 'active' && endDate < today) {
                        const diffTime = Math.abs(today - endDate)
                        const daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                        if (settingsData?.late_fee_value) {
                            if (settingsData.late_fee_type === 'percent') {
                                lateFee = (settingsData.late_fee_value / 100) * (r.total_value || 0) * daysLate
                            } else {
                                lateFee = settingsData.late_fee_value * daysLate
                            }
                        }
                    }

                    const grandTotal = (r.total_value || 0) + (lateFee || 0) + (r.damage_fee || 0)
                    const paidValue = r.down_payment || 0
                    return sum + Math.max(0, grandTotal - paidValue)
                }, 0)
            })

        } catch (error) {
            console.error('Error fetching customer data:', error)
        } finally {
            setLoading(false)
        }
    }

    function getItemsSummary(rental) {
        if (!rental.rental_items || rental.rental_items.length === 0) return 'Nenhum item'
        const firstItem = rental.rental_items[0]
        const count = rental.rental_items.length
        return count > 1
            ? `${firstItem.items?.name} + ${count - 1} itens`
            : firstItem.items?.name
    }

    async function toggleVip() {
        if (!customer) return
        try {
            const newStatus = !customer.is_vip
            // Optimistic update
            setCustomer(prev => ({ ...prev, is_vip: newStatus }))

            const { error } = await supabase
                .from('customers')
                .update({ is_vip: newStatus })
                .eq('id', customer.id)

            if (error) {
                // Revert on error
                setCustomer(prev => ({ ...prev, is_vip: !newStatus }))
                throw error
            }

        } catch (error) {
            console.error('Error updating VIP status:', error)
            toastError('Erro ao atualizar status VIP')
        }
    }

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <p className="mt-4 text-text-secondary-light dark:text-text-secondary-dark font-medium uppercase tracking-widest text-xs">Carregando perfil...</p>
        </div>
    )

    if (!customer) return (
        <div className="text-center py-20">
            <div className="p-4 bg-danger/10 text-danger rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <XCircle size={32} />
            </div>
            <h3 className="text-xl font-bold">Cliente não encontrado</h3>
            <button onClick={() => navigate('/customers')} className="mt-4 text-primary font-bold hover:underline">Voltar para a lista</button>
        </div>
    )

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/customers')}
                        className="p-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors border border-border-light dark:border-border-dark text-text-secondary-light dark:text-text-secondary-dark"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-text-primary-light dark:text-text-primary-dark">Perfil do Cliente</h2>
                        <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm font-medium">Visualize o histórico e informações de contato.</p>
                    </div>
                </div>

                <button
                    onClick={() => navigate(`/customers/${id}`)}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-white dark:bg-slate-800 border border-border-light dark:border-border-dark rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                >
                    <Edit3 size={16} className="text-primary" />
                    Editar Cadastro
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Basic Info Card */}
                    <div className="app-card p-6 md:p-8">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary relative">
                                <User size={32} />
                                {customer.is_vip && (
                                    <div className="absolute -top-2 -right-2 bg-amber-500 text-white p-1.5 rounded-full shadow-lg border-2 border-white dark:border-slate-900">
                                        <Crown size={14} className="fill-current" />
                                    </div>
                                )}
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-2xl font-black text-text-primary-light dark:text-text-primary-dark leading-none">{customer.name}</h3>
                                    {customer.is_vip && (
                                        <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-500 text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                                            VIP
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs font-bold text-text-secondary-light/60 dark:text-text-secondary-dark/60 uppercase tracking-widest mt-2">ID: {customer.id.slice(0, 8)}</p>
                            </div>
                        </div>

                        {/* Contact Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* WhatsApp */}
                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-border-light dark:border-border-dark">
                                <div className="p-2 bg-secondary/10 text-secondary rounded-lg shrink-0">
                                    <Phone size={16} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[9px] font-black text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-widest leading-none mb-1">WhatsApp</p>
                                    <p className="font-bold text-text-primary-light dark:text-text-primary-dark text-sm whitespace-normal break-all">
                                        {customer.whatsapp || '-'}
                                    </p>
                                </div>
                            </div>

                            {/* Email */}
                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-border-light dark:border-border-dark">
                                <div className="p-2 bg-primary/10 text-primary rounded-lg shrink-0">
                                    <Mail size={16} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[9px] font-black text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-widest leading-none mb-1">Email</p>
                                    <p className="font-bold text-text-primary-light dark:text-text-primary-dark text-xs whitespace-normal break-all">
                                        {customer.email || '-'}
                                    </p>
                                </div>
                            </div>

                            {/* CPF */}
                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-border-light dark:border-border-dark">
                                <div className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg shrink-0">
                                    <FileText size={16} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[9px] font-black text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-widest leading-none mb-1">CPF</p>
                                    <p className="font-bold text-text-primary-light dark:text-text-primary-dark text-sm break-all">
                                        {customer.cpf || '-'}
                                    </p>
                                </div>
                            </div>

                            {/* Saldo Devedor */}
                            <div className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${stats.totalDue > 0 ? 'bg-danger/10 border-danger/20 text-danger shadow-sm' : 'bg-slate-50 dark:bg-slate-800/40 border-border-light dark:border-border-dark opacity-60'}`}>
                                <div className={`p-2 rounded-lg shrink-0 ${stats.totalDue > 0 ? 'bg-danger text-white' : 'bg-slate-200 dark:bg-slate-700 text-text-secondary-light'}`}>
                                    <AlertCircle size={16} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[9px] font-bold uppercase tracking-widest leading-none mb-1 opacity-80">Saldo Devedor</p>
                                    <p className="font-black text-sm whitespace-normal">R$ {stats.totalDue?.toFixed(2) || '0.00'}</p>
                                </div>
                            </div>

                            {/* Cidade */}
                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-border-light dark:border-border-dark">
                                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shrink-0">
                                    <MapPin size={16} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[9px] font-black text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-widest leading-none mb-1">Cidade</p>
                                    <p className="font-bold text-text-primary-light dark:text-text-primary-dark text-sm whitespace-normal break-all">
                                        {customer.customer_city ? `${customer.customer_city}${customer.customer_state ? ` - ${customer.customer_state}` : ''}` : '-'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Financial stats highlights */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                            <div className="flex items-center gap-4 bg-primary/5 p-4 rounded-2xl border border-primary/10 transition-all hover:bg-primary/10">
                                <div className="p-3 bg-primary/10 text-primary rounded-xl shrink-0">
                                    <DollarSign size={24} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-widest mb-1 whitespace-normal">Total Movimentado (Histórico)</p>
                                    <p className="text-xl font-black text-primary leading-none">R$ {stats.totalSpent?.toFixed(2) || '0.00'}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 bg-secondary/5 p-4 rounded-2xl border border-secondary/10 transition-all hover:bg-secondary/10">
                                <div className="p-3 bg-secondary/10 text-secondary rounded-xl shrink-0">
                                    <CheckCircle size={24} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-widest mb-1 whitespace-normal">Contratos Realizados</p>
                                    <p className="text-xl font-black text-secondary leading-none">{stats.rentalsCount || 0}</p>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Dedicated General Observations Card */}
                    {customer.observations && (
                        <div className="app-card p-6 border-l-4 border-l-amber-400 bg-amber-50/20 dark:bg-amber-900/10">
                            <div className="flex items-center gap-2 mb-4 text-amber-600 dark:text-amber-500">
                                <StickyNote size={20} />
                                <h3 className="font-black uppercase tracking-widest text-xs">Observações Gerais</h3>
                            </div>
                            <p className="text-base text-text-primary-light dark:text-text-primary-dark font-semibold whitespace-pre-wrap leading-relaxed">
                                {customer.observations}
                            </p>
                        </div>
                    )}

                    {/* Tabs Navigation */}
                    <div className="flex items-center gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-fit">
                        <button
                            onClick={() => setActiveTab('rentals')}
                            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'rentals'
                                ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-white/50 dark:hover:bg-slate-700/50'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Calendar size={14} />
                                Locações
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('observations')}
                            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'observations'
                                ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-white/50 dark:hover:bg-slate-700/50'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <Clock size={14} />
                                Histórico de Notas
                                {rentals.filter(r => r.return_observations && r.return_observations.trim() !== '').length > 0 && (
                                    <span className="w-5 h-5 bg-primary text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                                        {rentals.filter(r => r.return_observations && r.return_observations.trim() !== '').length}
                                    </span>
                                )}
                            </div>
                        </button>
                        <button
                            onClick={() => setActiveTab('damages')}
                            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'damages'
                                ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-white/50 dark:hover:bg-slate-700/50'
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <AlertCircle size={14} />
                                Avarias & Perdas
                                {damages.length > 0 && (
                                    <span className="w-5 h-5 bg-danger text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                                        {damages.length}
                                    </span>
                                )}
                            </div>
                        </button>
                    </div>

                    {/* Tab Content */}
                    {activeTab === 'rentals' ? (
                        <div className="app-card overflow-hidden">
                            <div className="p-6 border-b border-border-light dark:border-border-dark flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Calendar size={18} className="text-text-secondary-light" />
                                    <h3 className="font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-wide text-sm">Histórico de Locações</h3>
                                </div>
                                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark">
                                    {rentals.length} registros
                                </span>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="app-table">
                                    <thead>
                                        <tr>
                                            <th>Início</th>
                                            <th>Resumo dos Itens</th>
                                            <th className="text-right">Valor</th>
                                            <th className="text-center">Pagamento</th>
                                            <th className="text-center w-[180px]">Status</th>
                                            <th className="text-right"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                        {rentals.map((rental) => (
                                            <tr key={rental.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                <td className="text-sm font-bold">
                                                    {new Date(rental.start_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                                </td>
                                                <td>
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-sm text-text-secondary-light dark:text-text-secondary-dark font-medium italic">
                                                            {getItemsSummary(rental)}
                                                        </div>
                                                        {rental.return_observations && (
                                                            <div title="Possui observação" className="p-1 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-md">
                                                                <StickyNote size={12} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="text-right font-black text-primary whitespace-nowrap">
                                                    R$ {(rental.total_value || 0).toFixed(2)}
                                                </td>
                                                <td className="text-center">
                                                    {(() => {
                                                        const endDate = new Date(rental.end_date + 'T00:00:00')
                                                        const today = new Date()
                                                        today.setHours(0, 0, 0, 0)

                                                        let lateFee = 0
                                                        if (rental.status === 'completed') {
                                                            lateFee = rental.late_fee_amount || 0
                                                        } else if (rental.status === 'active' && endDate < today) {
                                                            const diffTime = Math.abs(today - endDate)
                                                            const daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                                                            if (settings?.late_fee_value) {
                                                                if (settings.late_fee_type === 'percent') {
                                                                    lateFee = (settings.late_fee_value / 100) * (rental.total_value || 0) * daysLate
                                                                } else {
                                                                    lateFee = settings.late_fee_value * daysLate
                                                                }
                                                            }
                                                        }

                                                        const grandTotal = (rental.total_value || 0) + lateFee
                                                        const pendingBalance = grandTotal - (rental.down_payment || 0)
                                                        const isPaid = pendingBalance <= 0.01
                                                        const isPartial = rental.down_payment > 0 || rental.payment_status === 'PARTIAL'

                                                        return (
                                                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${isPaid ? 'bg-primary/10 text-primary' :
                                                                isPartial ? 'bg-secondary/10 text-secondary' :
                                                                    'bg-danger/10 text-danger'
                                                                }`}>
                                                                {isPaid ? 'PAGO' : isPartial ? 'PARCIAL' : 'PENDENTE'}
                                                            </span>
                                                        )
                                                    })()}
                                                </td>
                                                <td className="text-center whitespace-nowrap">
                                                    <span className={`
                                                        px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider block mx-auto whitespace-nowrap
                                                        ${['confirmed', 'in_progress'].includes(rental.status) ? 'bg-blue-100 text-blue-700' :
                                                            rental.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                                rental.status === 'completed' ? 'bg-primary/10 text-primary' :
                                                                    'bg-danger/10 text-danger'}
                                                    `}>
                                                        {rental.status === 'confirmed' ? 'Confirmado' :
                                                            rental.status === 'in_progress' ? 'Em Andamento' :
                                                                rental.status === 'pending' ? 'Pendente' :
                                                                    rental.status === 'completed' ? 'Concluído' : 'Cancelado'}
                                                    </span>
                                                </td>
                                                <td className="text-right">
                                                    <Link
                                                        to={`/rentals/${rental.id}`}
                                                        className="p-2 text-text-secondary-light dark:text-text-secondary-dark hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all border border-border-light dark:border-border-dark shadow-sm inline-block"
                                                    >
                                                        <Clock size={16} />
                                                    </Link>
                                                </td>
                                            </tr>
                                        ))}
                                        {rentals.length === 0 && (
                                            <tr>
                                                <td colSpan="5" className="p-12 text-center">
                                                    <p className="text-text-secondary-light/40 italic text-sm">Este cliente ainda não realizou locações.</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : activeTab === 'observations' ? (
                        <div className="space-y-4">
                            {/* Historical Observations from Rentals */}
                            {rentals.filter(r => r.return_observations && r.return_observations.trim() !== '').length > 0 ? (
                                <div className="grid grid-cols-1 gap-4">
                                    {rentals
                                        .filter(r => r.return_observations && r.return_observations.trim() !== '')
                                        .sort((a, b) => {
                                            const dateA = a.actual_return_date || a.end_date || '';
                                            const dateB = b.actual_return_date || b.end_date || '';
                                            return dateB.localeCompare(dateA);
                                        })
                                        .map((rental) => (
                                            <div key={rental.id} className="app-card p-6 border-l-4 border-l-amber-400 hover:shadow-md transition-all">
                                                <div className="flex items-start justify-between mb-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className="w-2 h-2 bg-amber-400 rounded-full"></div>
                                                            <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light">
                                                                {new Date((rental.actual_return_date || rental.end_date) + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                            </p>
                                                        </div>
                                                        <h5 className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">
                                                            Retorno: {getItemsSummary(rental)}
                                                        </h5>
                                                    </div>
                                                    <Link
                                                        to={`/rentals/${rental.id}`}
                                                        className="px-3 py-1 bg-slate-100 dark:bg-slate-700/50 rounded-lg text-[10px] font-black text-primary uppercase hover:bg-primary/10 transition-colors"
                                                    >
                                                        Ver Detalhes
                                                    </Link>
                                                </div>
                                                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-border-light/50 dark:border-border-dark/50 italic text-sm text-text-secondary-light dark:text-text-secondary-dark leading-relaxed">
                                                    "{rental.return_observations}"
                                                </div>
                                            </div>
                                        ))}
                                </div>
                            ) : (
                                <div className="app-card p-12 text-center">
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center text-text-secondary-light/40">
                                        <StickyNote size={32} />
                                    </div>
                                    <p className="text-text-secondary-light/60 italic text-sm">Nenhuma nota histórica registrada para este cliente.</p>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Damages Summary (Avarias & Perdas) */}
                            {damages.length > 0 ? (
                                <div className="app-card overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="app-table">
                                            <thead>
                                                <tr>
                                                    <th>Data</th>
                                                    <th>Item</th>
                                                    <th>Qtd</th>
                                                    <th className="text-center">Tipo</th>
                                                    <th className="text-right">Ação</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                                {damages.map((damage) => (
                                                    <tr key={`${damage.type}-${damage.id}`}>
                                                        <td className="text-xs font-bold text-text-secondary-light">
                                                            {new Date(damage.entry_date).toLocaleDateString('pt-BR')}
                                                        </td>
                                                        <td className="text-sm font-bold uppercase tracking-tight">
                                                            {damage.items?.name}
                                                        </td>
                                                        <td className="text-sm font-black text-primary">
                                                            {damage.quantity}
                                                        </td>
                                                        <td className="text-center">
                                                            <span className={`px-2 py-0.5 text-[9px] font-black rounded uppercase ${damage.type === 'BROKEN' ? 'bg-orange-100 text-orange-600' :
                                                                damage.type === 'LOST' ? 'bg-red-100 text-red-600' :
                                                                    damage.type === 'DIRTY' ? 'bg-amber-100 text-amber-600' :
                                                                        'bg-indigo-100 text-indigo-600'
                                                                }`}>
                                                                {damage.type === 'BROKEN' ? 'Avaria' :
                                                                    damage.type === 'LOST' ? 'Perda' :
                                                                        damage.type === 'DIRTY' ? 'Sujo' :
                                                                            damage.type === 'INCOMPLETE' ? 'Incompleto' : damage.type}
                                                            </span>
                                                        </td>
                                                        <td className="text-right">
                                                            {damage.rental_id && (
                                                                <Link
                                                                    to={`/rentals/${damage.rental_id}`}
                                                                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors inline-block"
                                                                >
                                                                    <Clock size={16} />
                                                                </Link>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                <div className="app-card p-12 text-center">
                                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center text-text-secondary-light/40">
                                        <AlertCircle size={32} />
                                    </div>
                                    <p className="text-text-secondary-light/60 italic text-sm">Este cliente não possui histórico de avarias ou perdas.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                    {/* Quick Actions */}
                    <div className="app-card p-6 border-l-4 border-l-primary/50">
                        <h4 className="text-xs font-black uppercase tracking-widest text-text-secondary-light mb-4">Ações Rápidas</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <Link
                                to={`/rentals/new?client_id=${customer.id}`}
                                className="col-span-2 flex items-center justify-center gap-2 p-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all"
                            >
                                <PlusCircle size={18} />
                                Nova Locação
                            </Link>
                            <a
                                href={`https://wa.me/55${customer.whatsapp?.replace(/\D/g, '') || ''}`}
                                target="_blank"
                                rel="noreferrer"
                                className={`flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-border-light dark:border-border-dark font-bold text-xs transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-600 ${!customer.whatsapp ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                                <MessageCircle size={20} />
                                WhatsApp
                            </a>
                            <Link
                                to="/logistics"
                                className="flex flex-col items-center justify-center gap-1 p-3 rounded-xl border border-border-light dark:border-border-dark font-bold text-xs transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 text-text-secondary-light"
                            >
                                <Package size={20} />
                                Logística
                            </Link>
                        </div>
                    </div>

                    {/* VIP Card Toggle */}
                    <button
                        onClick={toggleVip}
                        className={`w-full app-card p-6 border-none shadow-xl transition-all relative overflow-hidden group text-left
                        ${customer.is_vip
                                ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-amber-500/20'
                                : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                    >
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <div className={`p-2 rounded-xl mb-3 inline-flex ${customer.is_vip ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                                    <Crown size={24} className={customer.is_vip ? 'fill-current' : ''} />
                                </div>
                                <h4 className={`text-lg font-black uppercase tracking-tight ${customer.is_vip ? 'text-white' : 'text-text-primary-light dark:text-text-primary-dark'}`}>
                                    {customer.is_vip ? 'Cliente VIP Ativo' : 'Tornar VIP'}
                                </h4>
                                <p className={`text-xs font-medium mt-1 ${customer.is_vip ? 'text-white/80' : 'text-text-secondary-light'}`}>
                                    {customer.is_vip ? 'Clique para remover status' : 'Clique para ativar status VIP'}
                                </p>
                            </div>
                            {customer.is_vip && <div className="text-white/20 absolute -right-6 -bottom-6"><Crown size={80} /></div>}
                        </div>
                    </button>

                    <div className="app-card p-6 bg-gradient-to-br from-primary to-primary-hover text-white border-none shadow-xl shadow-primary/20">
                        <div className="flex items-center gap-2 opacity-70 mb-4">
                            <DollarSign size={16} />
                            <p className="text-xs font-black uppercase tracking-widest">Total Investido</p>
                        </div>
                        <h4 className="text-4xl font-black tabular-nums tracking-tighter mb-2">
                            <span className="text-lg opacity-50 mr-1">R$</span>
                            {stats.totalSpent.toFixed(2)}
                        </h4>
                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest border-t border-white/10 pt-4 mt-4">
                            Soma de contratos válidos
                        </p>
                    </div>

                    <div className="app-card p-6 space-y-4">
                        <div className="flex justify-between items-center pb-4 border-b border-border-light dark:border-border-dark">
                            <span className="text-text-secondary-light dark:text-text-secondary-dark text-xs font-bold uppercase tracking-widest">Locações Totais</span>
                            <span className="text-xl font-black text-text-primary-light dark:text-text-primary-dark tabular-nums">{stats.rentalsCount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-text-secondary-light dark:text-text-secondary-dark text-xs font-bold uppercase tracking-widest">Ativas Agora</span>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
                                <span className="text-xl font-black text-secondary tabular-nums">{stats.activeRentals}</span>
                            </div>
                        </div>
                    </div>

                    <div className="app-card p-6 border-dashed border-2 flex flex-col items-center justify-center text-center opacity-60 hover:opacity-100 transition-opacity cursor-pointer">
                        <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full mb-3">
                            <User size={24} className="text-text-secondary-light" />
                        </div>
                        <p className="text-xs font-bold uppercase tracking-widest">Documentação</p>
                        <p className="text-[10px] text-text-secondary-light mt-1 italic">Nenhum documento anexado.</p>
                    </div>
                </div>
            </div>
        </div>
    )
}

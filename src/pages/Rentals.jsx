import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, CheckCircle, XCircle, FileText, Download, Clock, FileCheck, Eye, Search, AlertTriangle } from 'lucide-react'
import { useDialog } from '../components/DialogProvider'
import RentalReturnModal from '../components/RentalReturnModal'

export default function Rentals() {
    const [rentals, setRentals] = useState([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('all')
    const [filterDate, setFilterDate] = useState('')
    const [settings, setSettings] = useState(null)
    const { confirm, prompt, alert: dialogAlert, success, error: toastError } = useDialog()
    const [searchParams] = useSearchParams()
    const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '')
    const [conflicts, setConflicts] = useState({})
    const navigate = useNavigate()

    useEffect(() => {
        const query = searchParams.get('search')
        if (query) setSearchTerm(query)
    }, [searchParams])

    const handleSetDate = (type) => {
        const d = new Date()
        if (type === 'tomorrow') d.setDate(d.getDate() + 1)
        setFilterDate(d.toISOString().split('T')[0])
    }


    useEffect(() => {
        fetchRentals()
    }, [])

    async function fetchRentals() {
        try {
            setLoading(true)
            const { data: rentalsData, error: rentalsError } = await supabase
                .from('rentals')
                .select(`
                    *,
                    customers (name, whatsapp, observations),
                    items (name),
                    rental_items (
                        quantity,
                        item_id,
                        items (name)
                    )
                `)
                .neq('type', 'quote') // Still filter out quotes if they are separate
                .order('created_at', { ascending: false })
                .order('start_date', { ascending: false })

            if (rentalsError) throw rentalsError
            setRentals(rentalsData)

            // Fetch Items for Conflict Check
            const { data: itemsData, error: itemsError } = await supabase
                .from('items')
                .select('id, name, total_quantity, maintenance_quantity, lost_quantity, broken_quantity')

            if (itemsError) throw itemsError

            // Calculate Conflicts
            const conflictsMap = {} // rentalId -> [itemNames]

            // 1. Calculate usage per item
            const usagePerItem = {} // itemId -> quantity
            const activeRentals = rentalsData.filter(r => ['active', 'in_progress', 'confirmed'].includes(r.status))

            activeRentals.forEach(r => {
                r.rental_items?.forEach(ri => {
                    if (ri.item_id) {
                        usagePerItem[ri.item_id] = (usagePerItem[ri.item_id] || 0) + ri.quantity
                    }
                })
            })

            // 2. Identify overbooked items
            const overbookedItems = new Set()
            itemsData.forEach(item => {
                const available = item.total_quantity - (item.maintenance_quantity || 0) - (item.lost_quantity || 0) - (item.broken_quantity || 0)
                const used = usagePerItem[item.id] || 0
                if (used > available) {
                    overbookedItems.add(item.id)
                }
            })

            // 3. Map rentals to overbooked items
            if (overbookedItems.size > 0) {
                activeRentals.forEach(r => {
                    const rentalConflicts = []
                    r.rental_items?.forEach(ri => {
                        if (overbookedItems.has(ri.item_id)) {
                            rentalConflicts.push(ri.items?.name)
                        }
                    })
                    if (rentalConflicts.length > 0) {
                        conflictsMap[r.id] = [...new Set(rentalConflicts)]
                    }
                })
            }
            setConflicts(conflictsMap)

            // Fetch settings...
        } catch (error) {
            console.error('Error fetching rentals:', error)
            toastError('Erro ao carregar aluguéis')
        } finally {
            setLoading(false)
        }
    }

    // Helper: Calculate if Late
    const isRentalLate = (rental) => {
        if (rental.status === 'completed' || rental.status === 'canceled') return false
        const endDate = new Date(rental.end_date + 'T00:00:00')
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return endDate < today
    }

    // Filter Logic
    const filteredRentals = rentals.filter(rental => {
        // Status Filter
        let statusMatch = true
        if (statusFilter === 'all') statusMatch = true
        else if (statusFilter === 'late') statusMatch = isRentalLate(rental)
        else if (statusFilter === 'payment_pending') {
            const grandTotal = (rental.total_value || 0) + (rental.late_fee_amount || 0)
            const paid = rental.amount_paid || rental.down_payment || 0
            statusMatch = (grandTotal - paid) > 0.01 && rental.status !== 'canceled'
        } else {
            statusMatch = rental.status === statusFilter
        }

        // Date Filter
        let dateMatch = true
        if (filterDate) {
            const start = rental.start_date
            const end = rental.end_date
            // Check if filterDate is within [start, end] range (inclusive)
            dateMatch = filterDate >= start && filterDate <= end
        }


        // Search Filter
        const searchLower = searchTerm.toLowerCase()
        const searchMatch = !searchTerm ||
            (rental.customers?.name || '').toLowerCase().includes(searchLower) ||
            (rental.rental_items?.some(ri => (ri.items?.name || '').toLowerCase().includes(searchLower))) ||
            rental.id.toString().includes(searchLower)

        return statusMatch && dateMatch && searchMatch
    })

    const statusOptions = [
        { id: 'all', label: 'Todos' },
        { id: 'confirmed', label: 'Confirmados' },
        { id: 'in_progress', label: 'Em Andamento' },
        { id: 'completed', label: 'Concluídos' },
        { id: 'canceled', label: 'Cancelados' },
        { id: 'late', label: '⚠ Atrasados' },
        { id: 'payment_pending', label: '$ Pendente' },
    ]

    async function handleCancel(id) {
        if (!await confirm('Deseja cancelar este aluguel?', 'Cancelar Aluguel')) return

        const refundInput = await prompt('Valor a ser devolvido ao cliente (Reembolso):', '0', 'Reembolso')
        if (refundInput === null) return

        const refundValue = parseFloat(refundInput.replace(',', '.')) || 0

        try {
            const { error } = await supabase
                .from('rentals')
                .update({
                    status: 'canceled',
                    refund_value: refundValue
                })
                .eq('id', id)

            if (error) throw error
            success('Aluguel cancelado com sucesso!')
            fetchRentals()
        } catch (error) {
            console.error('Error cancelling rental:', error)
            toastError('Erro ao cancelar aluguel')
        }
    }

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text-primary-light dark:text-text-primary-dark tracking-tight">Locações</h2>
                    <p className="text-text-secondary-light dark:text-text-secondary-dark font-medium mt-1">Gestão completa de pedidos e contratos.</p>
                </div>
                <Link to="/rentals/new" className="w-full md:w-auto px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-2xl font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                    <Plus size={20} />
                    Novo Aluguel
                </Link>
            </div>

            {/* Filters Bar */}
            <div className="flex overflow-x-auto pb-2 gap-2 no-scrollbar">
                {statusOptions.map(opt => (
                    <button
                        key={opt.id}
                        onClick={() => setStatusFilter(opt.id)}
                        className={`
                            px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all
                            ${statusFilter === opt.id
                                ? 'bg-primary text-white shadow-md shadow-primary/20'
                                : 'bg-white dark:bg-slate-800 text-text-secondary-light hover:bg-slate-50 dark:hover:bg-slate-700 border border-transparent hover:border-border-light'}
                        `}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>



            {/* Search and Date Filter Container */}
            <div className="flex flex-wrap items-center gap-4 mb-4">
                {/* Search Input */}
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
                    <input
                        type="search"
                        placeholder="Buscar cliente, item ou ID..."
                        className="app-input pl-10 w-full md:w-80"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Date Filter */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl flex flex-wrap items-center gap-2 border border-border-light dark:border-border-dark w-fit">
                    <div className="flex items-center gap-2 text-text-secondary-light">
                        <Clock size={18} />
                        <span className="text-xs font-bold uppercase tracking-widest">Filtrar por Data:</span>
                    </div>

                    <div className="flex gap-2">
                        <button
                            onClick={() => handleSetDate('today')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterDate === new Date().toISOString().split('T')[0] ? 'bg-blue-100 text-blue-700' : 'bg-white dark:bg-slate-800 hover:bg-slate-100'}`}
                        >
                            Hoje
                        </button>
                        <button
                            onClick={() => handleSetDate('tomorrow')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${(() => {
                                const t = new Date(); t.setDate(t.getDate() + 1);
                                return filterDate === t.toISOString().split('T')[0]
                            })() ? 'bg-blue-100 text-blue-700' : 'bg-white dark:bg-slate-800 hover:bg-slate-100'
                                }`}
                        >
                            Amanhã
                        </button>
                    </div>

                    <div className="w-px h-6 bg-border-light dark:bg-border-dark mx-1"></div>

                    <input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="app-input py-1.5 text-xs w-36"
                    />

                    {filterDate && (
                        <button
                            onClick={() => setFilterDate('')}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Limpar filtro de data"
                        >
                            <XCircle size={18} />
                        </button>
                    )}

                </div>
            </div>

            <div className="app-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="app-table w-full">
                        <thead>
                            <tr>
                                <th className="min-w-[200px]">Cliente</th>
                                <th className="min-w-[200px]">Itens / Período</th>
                                <th className="text-right min-w-[150px]">Financeiro</th>
                                <th className="text-center min-w-[150px]">Logística</th>
                                <th className="text-center w-[200px]">Status</th>
                                <th className="text-right min-w-[100px]">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light dark:divide-border-dark">
                            {filteredRentals.map((rental) => {
                                const isLate = isRentalLate(rental)
                                const logisticsStatus = rental.logistics_status || 'pending'

                                const paid = rental.amount_paid || rental.down_payment || 0
                                const total = (rental.total_value || 0) + (rental.late_fee_amount || 0)
                                const pending = total - paid
                                const isPaid = pending <= 0.01

                                return (
                                    <tr
                                        key={rental.id}
                                        className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                                        onClick={() => navigate(`/rentals/${rental.id}`)}
                                    >
                                        <td className="align-top">
                                            <div className="font-bold text-text-primary-light dark:text-text-primary-dark">{rental.customers?.name}</div>
                                            <div className="text-[10px] text-text-secondary-light font-medium mt-0.5 max-w-[150px] truncate">{rental.customers?.whatsapp || 'Sem contato'}</div>
                                        </td>
                                        <td className="align-top">
                                            <div className="flex flex-col gap-1">
                                                <div className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark line-clamp-2" title={rental.rental_items?.map(ri => `${ri.quantity}x ${ri.items?.name}`).join(', ')}>
                                                    {rental.rental_items?.map(ri => `${ri.quantity}x ${ri.items?.name}`).join(', ') || 'Sem itens'}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-text-secondary-light">
                                                    <span>{new Date(rental.start_date + 'T00:00:00').toLocaleDateString('pt-BR').slice(0, 5)}</span>
                                                    <span className="text-primary">➔</span>
                                                    <span>{new Date(rental.end_date + 'T00:00:00').toLocaleDateString('pt-BR').slice(0, 5)}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-right align-top">
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="font-black text-sm text-text-primary-light dark:text-text-primary-dark">R$ {total.toFixed(2)}</span>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isPaid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {isPaid ? 'PAGO' : `Faltam R$ ${pending.toFixed(2)}`}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="text-center align-middle">
                                            <div className="flex flex-col items-center">
                                                {conflicts[rental.id] && (
                                                    <div className="mb-1 group relative">
                                                        <AlertTriangle size={16} className="text-red-500 animate-pulse" />
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] bg-red-600/90 text-white text-[10px] p-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                                            <p className="font-bold border-b border-white/20 pb-1 mb-1">⚠️ Conflito de Estoque</p>
                                                            {conflicts[rental.id].map(item => (
                                                                <p key={item} className="truncate">• {item}</p>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                <span className={`
                                                    px-3 py-1 rounded text-xs font-bold uppercase block w-fit mx-auto whitespace-nowrap min-w-[100px]
                                                    ${(logisticsStatus === 'delivered' || logisticsStatus === 'step_4_delivered') ? 'bg-blue-100 text-blue-700' :
                                                        (logisticsStatus === 'returned' || logisticsStatus === 'step_7_returned') ? 'bg-green-100 text-green-700' :
                                                            (logisticsStatus === 'to_deliver' || logisticsStatus === 'step_2_to_deliver' || logisticsStatus === 'step_1_preparation') ? 'bg-yellow-100 text-yellow-700' :
                                                                (logisticsStatus === 'to_return' || logisticsStatus === 'step_5_to_return') ? 'bg-orange-100 text-orange-700' :
                                                                    (logisticsStatus === 'step_3_in_transit') ? 'bg-purple-100 text-purple-700' :
                                                                        (logisticsStatus === 'step_6_returning') ? 'bg-teal-100 text-teal-700' :
                                                                            'bg-slate-100 text-slate-500'}
                                                `}>
                                                    {(logisticsStatus === 'to_deliver' || logisticsStatus === 'step_2_to_deliver' || logisticsStatus === 'step_1_preparation') ? 'A Entregar' :
                                                        (logisticsStatus === 'delivered' || logisticsStatus === 'step_4_delivered') ? 'Entregue' :
                                                            (logisticsStatus === 'returned' || logisticsStatus === 'step_7_returned') ? 'Devolvido' :
                                                                (logisticsStatus === 'to_return' || logisticsStatus === 'step_5_to_return') ? 'A Retirar' :
                                                                    (logisticsStatus === 'step_3_in_transit') ? 'Em Rota' :
                                                                        (logisticsStatus === 'step_6_returning') ? 'Retornando' : 'Pendente'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="text-center align-middle whitespace-nowrap">
                                            <div className="w-full flex justify-center">
                                                <span className={`
                                                    px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider block whitespace-nowrap min-w-[140px]
                                                    ${isLate ? 'bg-danger/10 text-danger animate-pulse' :
                                                        rental.status === 'confirmed' ? 'bg-blue-500/10 text-blue-600' :
                                                            rental.status === 'in_progress' ? 'bg-purple-500/10 text-purple-600' :
                                                                rental.status === 'completed' ? 'bg-green-500/10 text-green-600' :
                                                                    rental.status === 'canceled' ? 'bg-red-500/10 text-red-600' :
                                                                        'bg-slate-100 text-slate-500'}
                                                `}>
                                                    {isLate ? 'Atrasado' :
                                                        rental.status === 'confirmed' ? 'Confirmado' :
                                                            rental.status === 'in_progress' ? 'Em Andamento' :
                                                                rental.status === 'completed' ? 'Concluído' :
                                                                    rental.status === 'canceled' ? 'Cancelado' :
                                                                        rental.status === 'pending' ? 'Conversão' : rental.status}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="text-right align-middle">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Link
                                                    to={`/rentals/${rental.id}`}
                                                    className="p-2 text-text-secondary-light hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Eye size={18} />
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {rentals.length === 0 && !loading && (
                                <tr>
                                    <td colSpan="6" className="p-12 text-center text-text-secondary-light opacity-50 font-medium">Nenhuma locação encontrada.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

            </div>
        </div >
    )
}

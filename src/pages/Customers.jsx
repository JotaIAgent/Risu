import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Edit, Trash2, Eye, Crown, Trophy, History, Filter, DollarSign, Clock, AlertCircle, CheckCircle, Search, MessageCircle, Calendar } from 'lucide-react'
import { useDialog } from '../components/DialogProvider'

export default function Customers() {
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState('all') // 'all', 'vip', 'debt', 'active', 'inactive'
    const [searchTerm, setSearchTerm] = useState('')
    const { confirm, success, error: toastError } = useDialog()
    const navigate = useNavigate()

    useEffect(() => {
        fetchCustomers()
    }, [])

    async function fetchCustomers() {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .rpc('get_customers_with_stats_v2')

            if (error) {
                console.warn('RPC unavailable, using fallback', error)
                throw error
            }

            // Sort by name default
            data.sort((a, b) => a.name.localeCompare(b.name))
            setCustomers(data)
        } catch (error) {
            console.warn('RPC failed, attempting fallback select...', error)
            // Fallback: Select from customers directly
            const { data: fallbackData, error: fallbackError } = await supabase
                .from('customers')
                .select('*')
                .order('name', { ascending: true })

            if (fallbackError) {
                console.error('Fallback failed:', fallbackError)
                toastError('Erro crítico ao carregar clientes.')
                return
            }

            // Map fallback data to expected structure (fill stats with 0/null)
            const mappedData = fallbackData.map(c => ({
                ...c,
                total_rentals: 0,
                last_rental_date: null,
                total_spent: 0,
                outstanding_balance: 0
            }))

            setCustomers(mappedData)
        } finally {
            setLoading(false)
        }
    }

    async function handleDelete(id) {
        if (!await confirm('Tem certeza que deseja excluir este cliente?')) return

        try {
            const { error } = await supabase.from('customers').delete().eq('id', id)
            if (error) throw error
            success('Cliente excluído com sucesso!')
            fetchCustomers()
        } catch (error) {
            console.error('Error deleting customer:', error)
            toastError('Erro ao excluir cliente')
        }
    }

    function formatPhone(phone) {
        if (!phone) return '-'
        const cleaned = phone.replace(/\D/g, '')
        if (cleaned.length === 11) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`
        if (cleaned.length === 10) return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`
        return phone
    }

    function formatCPF(cpf) {
        if (!cpf) return '-'
        const cleaned = cpf.replace(/\D/g, '')
        if (cleaned.length === 11) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9)}`
        if (cleaned.length === 14) return `${cleaned.slice(0, 2)}.${cleaned.slice(2, 5)}.${cleaned.slice(5, 8)}/${cleaned.slice(8, 12)}-${cleaned.slice(12)}`
        return cpf
    }

    function getLastRentalStatus(dateStr) {
        if (!dateStr) return { label: 'Novo', color: 'bg-emerald-100 text-emerald-700', icon: Trophy }

        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const rentalDate = new Date(dateStr)
        rentalDate.setHours(0, 0, 0, 0)

        const days = Math.floor((today - rentalDate) / (1000 * 60 * 60 * 24))

        if (days < 0) return { label: 'Agendado', color: 'bg-purple-100 text-purple-700', sub: `em ${Math.abs(days)} dias`, icon: Calendar }
        if (days === 0) return { label: 'Ativo Hoje', color: 'bg-emerald-100 text-emerald-700', sub: 'Hoje', icon: CheckCircle }
        if (days <= 30) return { label: 'Ativo Recente', color: 'bg-emerald-100 text-emerald-700', sub: `há ${days} dias`, icon: CheckCircle }
        if (days <= 90) return { label: 'Ativo', color: 'bg-blue-100 text-blue-700', sub: `há ${days} dias`, icon: Clock }
        return { label: 'Inativo', color: 'bg-slate-100 text-slate-500', sub: `há ${days} dias`, icon: History }
    }

    const filteredCustomers = customers.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.cpf && c.cpf.includes(searchTerm)) ||
            (c.whatsapp && c.whatsapp.includes(searchTerm))

        if (!matchesSearch) return false

        if (filter === 'all') return true
        if (filter === 'vip') return c.is_vip
        if (filter === 'debt') return (c.outstanding_balance || 0) > 0.01
        if (filter === 'active') {
            if (!c.last_rental_date) return false
            const days = Math.floor((new Date() - new Date(c.last_rental_date)) / (1000 * 60 * 60 * 24))
            return days <= 90
        }
        if (filter === 'inactive') {
            if (!c.last_rental_date) return true
            const days = Math.floor((new Date() - new Date(c.last_rental_date)) / (1000 * 60 * 60 * 24))
            return days > 90
        }
        return true
    })

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <p className="mt-4 text-text-secondary-light dark:text-text-secondary-dark font-medium uppercase tracking-widest text-xs">Carregando clientes...</p>
        </div>
    )

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text-primary-light dark:text-text-primary-dark tracking-tight">Clientes</h2>
                    <p className="text-text-secondary-light dark:text-text-secondary-dark font-medium mt-1">Gerencie sua base de clientes, histórico e inadimplência.</p>
                </div>
                <Link to="/customers/new" className="w-full md:w-auto px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-2xl font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                    <Plus size={20} />
                    Novo Cliente
                </Link>
            </div>

            {/* Controls */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary-light/50" />
                    <input
                        type="text"
                        placeholder="Buscar por nome, CPF ou telefone..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 rounded-2xl border border-border-light dark:border-border-dark outline-none focus:border-primary transition-colors font-medium shadow-sm"
                    />
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                    {[
                        { id: 'all', label: 'Todos', icon: CheckCircle }, // Changed icon just for variety or import User
                        { id: 'vip', label: 'VIP', icon: Crown },
                        { id: 'debt', label: 'Em Débito', icon: AlertCircle },
                        { id: 'active', label: 'Ativos', icon: Clock },
                        { id: 'inactive', label: 'Inativos', icon: History },
                    ].map(f => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id)}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all whitespace-nowrap
                                ${filter === f.id
                                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                    : 'bg-white dark:bg-slate-800 text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                        >
                            {f.id === 'debt' ? <AlertCircle size={14} className={filter === 'debt' ? 'text-white' : 'text-danger'} /> : <f.icon size={14} />}
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="app-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="app-table">
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th className="text-center">Status</th>
                                <th className="text-right">Financeiro</th>
                                <th>Contato</th>
                                <th className="text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light dark:divide-border-dark">
                            {filteredCustomers.map((customer) => {
                                const status = getLastRentalStatus(customer.last_rental_date)
                                const hasDebt = (customer.outstanding_balance || 0) > 0.01

                                return (
                                    <tr
                                        key={customer.id}
                                        className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                                        onClick={() => navigate(`/customers/${customer.id}/details`)}
                                    >
                                        <td>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-text-primary-light dark:text-text-primary-dark">{customer.name}</span>
                                                    {customer.is_vip && <Crown size={14} className="text-amber-500 fill-amber-500" />}
                                                </div>
                                                <span className="text-xs text-text-secondary-light dark:text-text-secondary-dark font-medium">{formatCPF(customer.cpf)}</span>
                                            </div>
                                        </td>
                                        <td className="text-center">
                                            <div className="inline-flex flex-col items-center">
                                                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${status.color}`}>
                                                    {status.label}
                                                </span>
                                                {status.sub && <span className="text-[9px] text-text-secondary-light dark:text-text-secondary-dark mt-1 font-bold">{status.sub}</span>}
                                            </div>
                                        </td>
                                        <td className="text-right">
                                            <div className="flex flex-col items-end">
                                                {hasDebt ? (
                                                    <span className="text-sm font-black text-danger flex items-center gap-1">
                                                        <AlertCircle size={12} />
                                                        -R$ {Number(customer.outstanding_balance).toFixed(2)}
                                                    </span>
                                                ) : (
                                                    <span className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                                                        <CheckCircle size={12} />
                                                        Em dia
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark font-medium mt-0.5">
                                                    Total: R$ {Number(customer.total_spent || 0).toFixed(2)}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-xs font-bold text-text-primary-light dark:text-text-primary-dark flex items-center gap-1.5">
                                                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                                                    {formatPhone(customer.whatsapp)}
                                                </span>
                                                <span className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark font-medium truncate max-w-[150px]">
                                                    {customer.customer_city || '-'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {customer.whatsapp && (
                                                    <a
                                                        href={`https://wa.me/55${customer.whatsapp.replace(/\D/g, '')}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="p-2 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-xl transition-all border border-emerald-200 shadow-sm"
                                                        title="WhatsApp"
                                                    >
                                                        <MessageCircle size={18} />
                                                    </a>
                                                )}
                                                <Link
                                                    to={`/customers/${customer.id}/details`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="p-2 text-primary hover:bg-primary/10 rounded-xl transition-all border border-primary/20 shadow-sm"
                                                    title="Ver perfil"
                                                >
                                                    <Eye size={18} />
                                                </Link>
                                                <Link
                                                    to={`/customers/${customer.id}`}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="p-2 text-text-secondary-light dark:text-text-secondary-dark hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all border border-border-light dark:border-border-dark shadow-sm"
                                                    title="Editar"
                                                >
                                                    <Edit size={18} />
                                                </Link>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDelete(customer.id); }}
                                                    className="p-2 text-danger hover:bg-danger/10 rounded-xl transition-all border border-danger/20 shadow-sm"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                            {filteredCustomers.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="p-20 text-center text-text-secondary-light dark:text-text-secondary-dark italic">
                                        <div className="flex flex-col items-center">
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-full mb-4">
                                                <Search size={40} className="text-text-secondary-light/20" />
                                            </div>
                                            <p className="text-text-secondary-light dark:text-text-secondary-dark font-bold uppercase tracking-widest text-xs">Nenhum cliente encontrado</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import PageTitle from '../components/PageTitle'
import {
    FileDown, TrendingUp, Package, Users, AlertCircle, Calendar,
    ChevronDown, ChevronRight, DollarSign, Truck, Download,
    Printer, ArrowLeft, Search, Filter, MessageCircle
} from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth, parseISO } from 'date-fns'

export default function Reports() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const [view, setView] = useState('list') // 'list' or 'report'
    const [activeReport, setActiveReport] = useState(null)
    const [expandedGroups, setExpandedGroups] = useState(['Financeiro'])
    const [dateRange, setDateRange] = useState('30')
    const [reportData, setReportData] = useState([])
    const [searchTerm, setSearchTerm] = useState('')
    const [filterCity, setFilterCity] = useState('')
    const [filterState, setFilterState] = useState('')

    // Report Definitions
    // Report Definitions
    const REPORTS = [
        // --- FINANCEIRO ---
        {
            id: 'fluxo_caixa',
            name: 'Fluxo de Caixa Operacional',
            group: 'Financeiro',
            description: 'Receitas, despesas e saldo do período.',
            icon: DollarSign,
            columns: ['Mês', 'Receitas', 'Despesas', 'Saldo'],
            query: async (userId, startDate, endDate) => {
                const { data: txs } = await supabase
                    .from('financial_transactions')
                    .select('*')
                    .eq('user_id', userId)
                    .gte('date', startDate)
                    .lte('date', endDate)
                    .not('category', 'eq', 'Caução')

                const months = {}
                txs?.forEach(tx => {
                    const month = format(parseISO(tx.date), 'MM/yyyy')
                    if (!months[month]) months[month] = { month, income: 0, expense: 0 }
                    if (tx.type === 'income') months[month].income += Number(tx.amount)
                    else months[month].expense += Number(tx.amount)
                })

                return Object.values(months).map(m => ({
                    'Mês': m.month,
                    'Receitas': new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(m.income),
                    'Despesas': new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(m.expense),
                    'Saldo': new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(m.income - m.expense)
                }))
            }
        },
        {
            id: 'receita_item',
            name: 'Receita por Item',
            group: 'Financeiro',
            description: 'Faturamento gerado por cada produto.',
            icon: TrendingUp,
            columns: ['Item', 'Qtd Alugada', 'Faturamento'],
            query: async (userId, startDate, endDate) => {
                const { data: rentals } = await supabase
                    .from('rentals')
                    .select('id, rental_items(quantity, unit_price, items(name))')
                    .eq('user_id', userId)
                    .neq('status', 'canceled')
                    .gte('created_at', startDate)
                    .lte('created_at', endDate)

                const itemStats = {}
                rentals?.forEach(r => {
                    r.rental_items?.forEach(ri => {
                        const name = ri.items?.name || 'Desconhecido'
                        if (!itemStats[name]) itemStats[name] = { count: 0, revenue: 0 }
                        itemStats[name].count += ri.quantity
                        itemStats[name].revenue += (ri.quantity * ri.unit_price)
                    })
                })

                return Object.entries(itemStats).map(([name, stats]) => ({
                    'Item': name,
                    'Qtd Alugada': stats.count,
                    'Faturamento': new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.revenue)
                })).sort((a, b) => b['Faturamento'] - a['Faturamento']) // Sort by revenue
            }
        },
        {
            id: 'valores_aberto',
            name: 'Valores em Aberto',
            group: 'Financeiro',
            description: 'Aluguéis ativos ou finalizados com saldo pendente (estimado).',
            icon: AlertCircle,
            columns: ['Cliente', 'Aluguel', 'Total', 'Pago (Entrada)', 'Pendente'],
            query: async (userId, startDate, endDate) => {
                const { data: rentals } = await supabase
                    .from('rentals')
                    .select('id, total_value, down_payment, customers(name), created_at')
                    .eq('user_id', userId)
                    .neq('status', 'canceled')
                    .gte('created_at', startDate)
                    .lte('created_at', endDate)

                return (rentals || [])
                    .map(r => {
                        const pending = (r.total_value || 0) - (r.down_payment || 0)
                        return { ...r, pending }
                    })
                    .filter(r => r.pending > 0)
                    .map(r => ({
                        'Cliente': r.customers?.name || 'N/A',
                        'Aluguel': `#${r.id.slice(0, 8)}`,
                        'Total': new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.total_value || 0),
                        'Pago (Entrada)': new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.down_payment || 0),
                        'Pendente': new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.pending)
                    }))
            }
        },

        // --- CLIENTES ---
        {
            id: 'top_clientes',
            name: 'Clientes Mais Recorrentes',
            group: 'Clientes',
            description: 'Quem mais aluga com você.',
            icon: Users,
            columns: ['Cliente', 'Qtd Locações', 'Último Aluguel'],
            query: async (userId, startDate, endDate) => {
                const { data: rentals } = await supabase
                    .from('rentals')
                    .select('client_id, created_at, customers(name)')
                    .eq('user_id', userId)
                    .neq('status', 'canceled')
                    .gte('created_at', startDate)
                    .lte('created_at', endDate)

                const stats = {}
                rentals?.forEach(r => {
                    const name = r.customers?.name || 'Desconhecido'
                    if (!stats[name]) stats[name] = { count: 0, last: r.created_at }
                    stats[name].count += 1
                    if (new Date(r.created_at) > new Date(stats[name].last)) stats[name].last = r.created_at
                })

                return Object.entries(stats)
                    .map(([name, s]) => ({
                        'Cliente': name,
                        'Qtd Locações': s.count,
                        'Último Aluguel': format(parseISO(s.last), 'dd/MM/yyyy')
                    }))
                    .sort((a, b) => b['Qtd Locações'] - a['Qtd Locações'])
            }
        },
        {
            id: 'novos_clientes',
            name: 'Novos Clientes',
            group: 'Clientes',
            description: 'Clientes cadastrados no período selecionado.',
            icon: Users,
            columns: ['Nome', 'Data Cadastro', 'WhatsApp', 'Cidade'],
            query: async (userId, startDate, endDate) => {
                const { data: customers } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('user_id', userId)
                    .gte('created_at', startDate)
                    .lte('created_at', endDate)
                    .order('created_at', { ascending: false })

                return (customers || []).map(c => ({
                    'Nome': c.name,
                    'Data Cadastro': c.created_at ? format(parseISO(c.created_at), 'dd/MM/yyyy') : '-',
                    'WhatsApp': c.whatsapp || '-',
                    'Cidade': c.customer_city || '-'
                }))
            }
        },
        {
            id: 'clientes_inativos',
            name: 'Clientes Inativos (>90 dias)',
            group: 'Clientes',
            description: 'Base de clientes sem aluguéis recentes (oportunidade de contato).',
            icon: AlertCircle,
            columns: ['Nome', 'Último Aluguel', 'Status'],
            query: async (userId) => {
                // Same logic as before
                const { data: customers, error } = await supabase.from('customers').select('id, name').eq('user_id', userId)
                if (error) return []
                const { data: latestRentals } = await supabase.from('rentals').select('client_id, created_at').eq('user_id', userId).neq('status', 'canceled').order('created_at', { ascending: false })
                const customerLatestRental = {}
                latestRentals?.forEach(r => { if (!customerLatestRental[r.client_id]) customerLatestRental[r.client_id] = r.created_at })
                const ninetyDaysAgo = subDays(new Date(), 90)
                return customers
                    .map(c => ({ ...c, last_date: customerLatestRental[c.id] }))
                    .filter(c => !c.last_date || parseISO(c.last_date) < ninetyDaysAgo)
                    .map(c => ({
                        'Nome': c.name,
                        'Último Aluguel': c.last_date ? format(parseISO(c.last_date), 'dd/MM/yyyy') : 'Nunca',
                        'Status': 'Inativo'
                    }))
            }
        },
        {
            id: 'agenda_contatos',
            name: 'Lista Geral de Contatos',
            group: 'Clientes',
            description: 'Exportação completa da base de clientes.',
            icon: Users,
            columns: ['Nome', 'WhatsApp', 'Email', 'Cidade', 'UF'],
            query: async (userId) => {
                const { data: customers } = await supabase.from('customers').select('*').eq('user_id', userId).order('name')
                return customers.map(c => ({
                    'Nome': c.name, 'WhatsApp': c.whatsapp || '-', 'Email': c.email || '-', 'Cidade': c.customer_city || '-', 'UF': c.customer_state || '-'
                }))
            }
        },

        // --- ESTOQUE ---
        {
            id: 'popularidade',
            name: 'Itens Mais Alugados',
            group: 'Estoque',
            description: 'Ranking de saída de itens.',
            icon: Package,
            columns: ['Item', 'Total Aluguéis', 'Popularidade'],
            query: async (userId, startDate, endDate) => {
                const { data: items } = await supabase
                    .from('rental_items')
                    .select('item_id, items(name)')
                    .eq('user_id', userId)
                    .gte('created_at', startDate)
                    .lte('created_at', endDate)

                const counts = {}
                items?.forEach(i => {
                    const name = i.items?.name || 'Item Removido'
                    counts[name] = (counts[name] || 0) + 1
                })

                const max = Math.max(...Object.values(counts), 1)
                return Object.entries(counts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([name, count]) => ({
                        'Item': name,
                        'Total Aluguéis': count,
                        'Popularidade': `${Math.round((count / max) * 100)}%`
                    }))
            }
        },
        {
            id: 'itens_parados',
            name: 'Estoque Parado',
            group: 'Estoque',
            description: 'Itens que não saíram no período (oportunidade de promoção).',
            icon: Package,
            columns: ['Item', 'Estoque Disp.', 'Status'],
            query: async (userId, startDate, endDate) => {
                const { data: allItems } = await supabase.from('items').select('*').eq('user_id', userId)
                const { data: rentedItems } = await supabase.from('rental_items').select('item_id').eq('user_id', userId).gte('created_at', startDate).lte('created_at', endDate)
                const rentedIds = new Set(rentedItems?.map(ri => ri.item_id) || [])
                return allItems
                    ?.filter(item => !rentedIds.has(item.id))
                    .map(item => ({ 'Item': item.name, 'Estoque Disp.': item.quantity || 0, 'Status': 'Sem saída' })) || []
            }
        },

        // --- LOGÍSTICA ---
        {
            id: 'entregas_periodo',
            name: 'Entregas Realizadas/Previstas',
            group: 'Logística',
            description: 'Controle de saídas por data.',
            icon: Truck,
            columns: ['Data Entrega', 'Cliente', 'Cidade', 'Status'],
            query: async (userId, startDate, endDate) => {
                const { data: rentals } = await supabase
                    .from('rentals')
                    .select('delivery_date, status, customers(name, customer_city)')
                    .eq('user_id', userId)
                    .gte('delivery_date', startDate)
                    .lte('delivery_date', endDate)
                    .order('delivery_date')

                return (rentals || []).map(r => ({
                    'Data Entrega': r.delivery_date ? format(parseISO(r.delivery_date), 'dd/MM/yyyy') : 'N/A',
                    'Cliente': r.customers?.name || 'N/A',
                    'Cidade': r.customers?.customer_city || '-',
                    'Status': r.status
                }))
            }
        },
        {
            id: 'coletas_periodo',
            name: 'Coletas (Devoluções)',
            group: 'Logística',
            description: 'Itens previstos para retornar.',
            icon: Truck,
            columns: ['Data Devolução', 'Cliente', 'Cidade', 'Status'],
            query: async (userId, startDate, endDate) => {
                const { data: rentals } = await supabase
                    .from('rentals')
                    .select('end_date, status, customers(name, customer_city)')
                    .eq('user_id', userId)
                    .gte('end_date', startDate)
                    .lte('end_date', endDate)
                    .order('end_date')

                return (rentals || []).map(r => ({
                    'Data Devolução': r.end_date ? format(parseISO(r.end_date), 'dd/MM/yyyy') : 'N/A',
                    'Cliente': r.customers?.name || 'N/A',
                    'Cidade': r.customers?.customer_city || '-',
                    'Status': r.status
                }))
            }
        },
        {
            id: 'avarias_history',
            name: 'Histórico de Avarias',
            group: 'Logística',
            description: 'Itens danificados e gravidade.',
            icon: AlertCircle,
            columns: ['Data', 'Item', 'Cliente', 'Gravidade'],
            query: async (userId, startDate, endDate) => {
                const { data: damages } = await supabase
                    .from('damage_logs')
                    .select('created_at, severity, items(name), customers(name)')
                    .eq('user_id', userId)
                    .gte('created_at', startDate)
                    .lte('created_at', endDate)

                return (damages || []).map(d => ({
                    'Data': d.created_at ? format(parseISO(d.created_at), 'dd/MM/yyyy') : 'N/A',
                    'Item': d.items?.name || 'N/A',
                    'Cliente': d.customers?.name || 'N/A',
                    'Gravidade': d.severity === 'total' ? 'Perda Total' : 'Parcial'
                }))
            }
        },

        // --- ATENDIMENTO ---
        {
            id: 'mensagens_enviadas',
            name: 'Volume de Mensagens',
            group: 'Atendimento',
            description: 'Quantidade de mensagens enviadas por dia.',
            icon: Users, // Using generic icon
            columns: ['Data', 'Total Enviado', 'Automáticas', 'Manuais'],
            query: async (userId, startDate, endDate) => {
                const { data: logs } = await supabase
                    .from('whatsapp_logs')
                    .select('created_at, template_name')
                    .eq('user_id', userId)
                    .gte('created_at', startDate)
                    .lte('created_at', endDate)

                const days = {}
                logs?.forEach(log => {
                    const day = format(parseISO(log.created_at), 'dd/MM/yyyy')
                    if (!days[day]) days[day] = { date: day, total: 0, auto: 0, manual: 0 }
                    days[day].total++
                    if (log.template_name === 'Manual' || !log.template_name) days[day].manual++
                    else days[day].auto++
                })

                return Object.values(days).sort((a, b) => b.total - a.total).map(d => ({
                    'Data': d.date,
                    'Total Enviado': d.total,
                    'Automáticas': d.auto,
                    'Manuais': d.manual
                }))
            }
        }
    ]

    const groups = ['Financeiro', 'Clientes', 'Estoque', 'Logística', 'Atendimento']

    const GROUP_DETAILS = {
        'Financeiro': {
            description: 'Acompanhe receitas, despesas, lucros e valores pendentes do seu negócio.',
            icon: DollarSign,
            color: 'bg-green-100 text-green-600'
        },
        'Clientes': {
            description: 'Entenda o comportamento dos seus clientes e identifique oportunidades.',
            icon: Users,
            color: 'bg-blue-100 text-blue-600'
        },
        'Estoque': {
            description: 'Controle o desempenho e a utilização dos seus itens alugáveis.',
            icon: Package,
            color: 'bg-orange-100 text-orange-600'
        },
        'Logística': {
            description: 'Monitore entregas, coletas e eficiência operacional.',
            icon: Truck,
            color: 'bg-purple-100 text-purple-600'
        },
        'Atendimento': {
            description: 'Acompanhe o histórico de comunicação com seus clientes.',
            icon: MessageCircle,
            color: 'bg-teal-100 text-teal-600'
        }
    }

    const runReport = async (report) => {
        setLoading(true)
        setActiveReport(report)
        setView('report')
        setFilterCity('')
        setFilterState('')

        let startDate = new Date('2000-01-01').toISOString()
        const endDate = new Date().toISOString()
        if (dateRange !== 'all') {
            startDate = subDays(new Date(), parseInt(dateRange)).toISOString()
        }

        try {
            const data = await report.query(user.id, startDate, endDate)
            setReportData(data)
        } catch (error) {
            console.error('Error running report:', error)
        } finally {
            setLoading(false)
        }
    }

    const toggleGroup = (group) => {
        setExpandedGroups(prev =>
            prev.includes(group) ? prev.filter(g => g !== group) : [...prev, group]
        )
    }

    const handleBack = () => {
        setView('list')
        setActiveReport(null)
        setReportData([])
        setFilterCity('')
        setFilterState('')
    }

    const filteredReports = REPORTS.filter(r =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.group.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (view === 'report' && activeReport) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500 pb-20">
                <PageTitle title={`Relatório: ${activeReport.name}`} />
                {/* Report Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={handleBack}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                        >
                            <ArrowLeft size={24} />
                        </button>
                        <div>
                            <h2 className="text-2xl font-bold flex items-center gap-2">
                                <activeReport.icon size={24} className="text-primary" />
                                {activeReport.name}
                            </h2>
                            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark">{activeReport.description}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <select
                            value={dateRange}
                            onChange={e => setDateRange(e.target.value)}
                            className="app-input w-40"
                        >
                            <option value="30">Últimos 30 dias</option>
                            <option value="90">Últimos 3 meses</option>
                            <option value="365">Último ano</option>
                            <option value="all">Todo o período</option>
                        </select>

                        {/* City/State Filters (Conditional) */}
                        {reportData.some(r => r['Cidade'] || r['UF']) && (
                            <>
                                <select
                                    value={filterState}
                                    onChange={e => {
                                        setFilterState(e.target.value)
                                        setFilterCity('') // Reset city when state changes
                                    }}
                                    className="app-input w-24"
                                >
                                    <option value="">UF</option>
                                    {[...new Set(reportData.map(r => r['UF']).filter(val => val && val !== '-'))].sort().map(uf => (
                                        <option key={uf} value={uf}>{uf}</option>
                                    ))}
                                </select>
                                <select
                                    value={filterCity}
                                    onChange={e => setFilterCity(e.target.value)}
                                    className="app-input w-40"
                                >
                                    <option value="">Cidade</option>
                                    {[...new Set(reportData
                                        .filter(r => !filterState || r['UF'] === filterState)
                                        .map(r => r['Cidade'])
                                        .filter(val => val && val !== '-'))]
                                        .sort().map(city => (
                                            <option key={city} value={city}>{city}</option>
                                        ))}
                                </select>
                            </>
                        )}
                        <button
                            onClick={() => window.print()}
                            className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
                            title="Imprimir"
                        >
                            <Printer size={20} />
                        </button>
                        <button
                            className="p-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
                            title="Exportar CSV"
                            onClick={() => {
                                const headers = activeReport.columns.join(',')
                                const rows = reportData.map(row => Object.values(row).join(','))
                                const csv = [headers, ...rows].join('\n')
                                const blob = new Blob([csv], { type: 'text/csv' })
                                const url = window.URL.createObjectURL(blob)
                                const a = document.createElement('a')
                                a.setAttribute('hidden', '')
                                a.setAttribute('href', url)
                                a.setAttribute('download', `${activeReport.id}_${format(new Date(), 'yyyyMMdd')}.csv`)
                                document.body.appendChild(a)
                                a.click()
                                document.body.removeChild(a)
                            }}
                        >
                            <Download size={20} />
                        </button>
                    </div>
                </div>

                {/* Print Header */}
                <div className="hidden print:block mb-8">
                    <h1 className="text-3xl font-bold">{activeReport.name}</h1>
                    <p className="text-gray-500">Relatório gerado em {format(new Date(), 'dd/MM/yyyy HH:mm')}</p>
                    <p className="text-sm">Período: {dateRange === 'all' ? 'Completo' : `Últimos ${dateRange} dias`}</p>
                </div>

                {/* Report Content */}
                <div className="app-card overflow-hidden">
                    {loading ? (
                        <div className="h-64 flex flex-col items-center justify-center gap-4">
                            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-sm font-medium opacity-50">Gerando relatório...</p>
                        </div>
                    ) : reportData.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-text-secondary-light opacity-50 font-medium">
                            <AlertCircle size={40} className="mb-4" />
                            Nenhum dado encontrado para este período.
                        </div>
                    ) : (
                        (() => {
                            const displayData = reportData.filter(row => {
                                const cityMatch = !filterCity || row['Cidade'] === filterCity
                                const stateMatch = !filterState || row['UF'] === filterState
                                return cityMatch && stateMatch
                            })

                            if (displayData.length > 0) {
                                return (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-border-light dark:border-border-dark">
                                                <tr>
                                                    {activeReport.columns.map(col => (
                                                        <th key={col} className="px-6 py-4 text-xs font-black uppercase tracking-wider text-text-secondary-light">
                                                            {col}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                                {displayData.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                                        {activeReport.columns.map(col => (
                                                            <td key={col} className="px-6 py-4 text-sm font-medium">
                                                                {row[col]}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            }
                            return (
                                <div className="h-64 flex flex-col items-center justify-center text-text-secondary-light opacity-50 font-medium">
                                    <Filter size={40} className="mb-4" />
                                    Nenhum dado corresponde aos filtros selecionados.
                                </div>
                            )
                        })()
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            <PageTitle title="Relatórios" />
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-black bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">Central de Relatórios</h2>
                    <p className="text-text-secondary-light dark:text-text-secondary-dark font-medium">Gerencie e analise o desempenho do seu negócio</p>
                </div>

                <div className="relative w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary-light" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar relatório..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="app-input pl-10 w-full"
                    />
                </div>
            </div>

            {/* Reports List */}
            <div className="space-y-4">
                {groups.map(group => {
                    const groupReports = filteredReports.filter(r => r.group === group)
                    if (groupReports.length === 0) return null
                    const isExpanded = expandedGroups.includes(group)
                    const details = GROUP_DETAILS[group] || {}
                    const Icon = details.icon || AlertCircle

                    return (
                        <div key={group} className="app-card overflow-hidden transition-all duration-300">
                            <button
                                onClick={() => toggleGroup(group)}
                                className={`w-full flex items-center justify-between p-5 text-left transition-colors ${isExpanded ? 'bg-slate-50/50 dark:bg-slate-800/50' : 'hover:bg-slate-50/30'
                                    }`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`p-3 rounded-xl ${details.color || 'bg-slate-100 text-slate-600'}`}>
                                        <Icon size={24} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg font-bold">{group}</span>
                                            <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full font-bold text-text-secondary-light">{groupReports.length}</span>
                                        </div>
                                        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark font-medium mt-0.5">{details.description}</p>
                                    </div>
                                </div>
                                {isExpanded ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
                            </button>

                            {isExpanded && (
                                <div className="p-2 bg-white dark:bg-slate-900 border-t border-border-light dark:border-border-dark">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {groupReports.map(report => (
                                            <div
                                                key={report.id}
                                                className="group p-4 flex items-center justify-between rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition-all cursor-pointer"
                                                onClick={() => runReport(report)}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="p-2 border border-border-light dark:border-border-dark rounded-lg group-hover:bg-white dark:group-hover:bg-slate-900 transition-colors">
                                                        <report.icon size={18} className="text-text-secondary-light" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-sm">{report.name}</h4>
                                                        <p className="text-xs text-text-secondary-light mt-0.5 line-clamp-1">{report.description}</p>
                                                    </div>
                                                </div>
                                                <button className="px-4 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-black uppercase hover:bg-primary text-white transition-all opacity-0 group-hover:opacity-100">
                                                    Visualizar
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Empty State */}
            {filteredReports.length === 0 && (
                <div className="app-card p-20 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-full">
                        <Search size={40} className="text-text-secondary-light" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold">Nenhum relatório encontrado</h3>
                        <p className="text-text-secondary-light">Tente buscar por termos diferentes ou navegue nas categorias.</p>
                    </div>
                </div>
            )}
        </div>
    )
}


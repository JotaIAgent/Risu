import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Plus, DollarSign, TrendingUp, TrendingDown, Calendar, Search, Filter, Trash2, ArrowUpRight, ArrowDownLeft, Briefcase, FileText, CreditCard, Wallet, Settings, RefreshCw, PlusCircle, Save } from 'lucide-react'
import { useDialog } from '../components/DialogProvider'
import TransactionModal from '../components/TransactionModal'
import PageTitle from '../components/PageTitle'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function Finance() {
    const { user } = useAuth()
    const { confirm, success, error: toastError } = useDialog()
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('dashboard') // 'dashboard', 'costs', 'settings'

    // Data States
    const [transactions, setTransactions] = useState([])
    const [accounts, setAccounts] = useState([])
    const [selectedAccount, setSelectedAccount] = useState('business')
    const [searchTerm, setSearchTerm] = useState('')
    const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM'))

    // New Data States
    const [recurringCosts, setRecurringCosts] = useState([])
    const [taxes, setTaxes] = useState([])
    const [fees, setFees] = useState([])

    // Forms States
    const [newCost, setNewCost] = useState({ name: '', category: 'general', amount: '', frequency: 'monthly' })
    const [newTax, setNewTax] = useState({ name: '', type: 'percent', value: '', base_calc: 'gross' })
    const [newFee, setNewFee] = useState({ name: '', fee_percent: '', fee_fixed: '' })

    const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false)

    // Metrics State
    const [metrics, setMetrics] = useState({
        grossRevenue: 0,
        netCashFlow: 0, // Real Cash Result
        managerialResult: 0, // Projected Result
        estTaxes: 0,
        estFees: 0,
        fixedCosts: 0,
        totalExpenses: 0
    })

    useEffect(() => {
        fetchData()
    }, [dateFilter, activeTab]) // Refetch when month changes or tab changes (to ensure fresh data)

    async function fetchData() {
        try {
            setLoading(true)
            const [year, month] = dateFilter.split('-')
            const startDate = `${year}-${month}-01`
            const endDate = new Date(year, month, 0).toISOString().split('T')[0]

            // 1. Fetch Accounts
            const { data: accData } = await supabase.from('accounts').select('*').eq('user_id', user.id).order('name')
            setAccounts(accData || [])

            // 2. Fetch Transactions (for selected month)
            const { data: transData } = await supabase
                .from('financial_transactions')
                .select('*, account:accounts!account_id(name, color, context), related_account:accounts!related_account_id(name, context)')
                .eq('user_id', user.id)
                .gte('date', startDate)
                .lte('date', endDate)
                .order('date', { ascending: false })
            setTransactions(transData || [])

            // 3. Fetch Settings (All Active)
            const { data: costsData } = await supabase.from('tenant_recurring_costs').select('*').eq('user_id', user.id).eq('active', true)
            setRecurringCosts(costsData || [])

            const { data: taxesData } = await supabase.from('tenant_taxes').select('*').eq('user_id', user.id).eq('active', true)
            setTaxes(taxesData || [])

            const { data: feesData } = await supabase.from('tenant_payment_fees').select('*').eq('user_id', user.id).eq('active', true)
            setFees(feesData || [])

        } catch (error) {
            console.error('Error fetching data:', error)
        } finally {
            setLoading(false)
        }
    }

    // --- Calculations ---
    useEffect(() => {
        if (!loading) calculateMetrics()
    }, [transactions, recurringCosts, taxes, fees, selectedAccount])

    const calculateMetrics = () => {
        // Filter transactions based on selection (Business/Personal)
        // For Managerial View, we usually focus on Business contexts
        const businessTrans = transactions.filter(t => t.account?.context === 'business' || t.related_account?.context === 'business')
        const filteredTrans = transactions // For the list view, we use the filter logic (below), but for KPIs we might want global context
        // Actually, let's use the 'selectedAccount' filter logic for consistency

        let relevantTrans = transactions
        if (selectedAccount === 'business') relevantTrans = transactions.filter(t => t.account?.context === 'business')
        if (selectedAccount === 'personal') relevantTrans = transactions.filter(t => t.account?.context === 'personal')
        // Note: Transfer logic is complex, sticking to simple type checks for now for Managerial View

        // 1. Gross Revenue (Cash Basis) - Income in context
        const grossRevenue = relevantTrans
            .filter(t => t.type === 'income' && t.category !== 'Caução')
            .reduce((sum, t) => sum + Number(t.amount), 0)

        // 2. Total Expenses (Cash Basis) - Expenses in context
        const totalExpenses = relevantTrans
            .filter(t => t.type === 'expense' && t.category !== 'Caução')
            .reduce((sum, t) => sum + Number(t.amount), 0)

        // 3. Net Cash Flow
        const netCashFlow = grossRevenue - totalExpenses

        // --- Managerial Estimates (Business Only mostly) ---
        // If viewing Personal, Estimate Taxes/Fees might not make sense, but code will run anyway?
        // Let's assume these rules apply to the 'grossRevenue' calculated above.

        // 4. Estimated Fees
        let estFees = 0
        // Since we don't have payment_method on transactions yet, we apply global rules
        // Strategy: Sum of all fee percentages applied to Gross Revenue + Fixed Fee per Income Transaction
        const totalFeePercent = fees.reduce((acc, fee) => acc + Number(fee.fee_percent), 0)
        const totalFeeFixed = fees.reduce((acc, fee) => acc + Number(fee.fee_fixed), 0)

        // If user has multiple payment methods, summing % is WRONG.
        // We will assume "Weighted Average" if they have multiples? No.
        // We will Apply the Highest % or just Sum? 
        // Let's simplify: Estimate = Revenue * (Avg Fee %)
        if (fees.length > 0) {
            // Very rough estimate since we lack per-transaction method
            const avgPercent = totalFeePercent / fees.length
            const incomeCount = relevantTrans.filter(t => t.type === 'income').length
            estFees = (grossRevenue * (avgPercent / 100)) + (incomeCount * (totalFeeFixed / fees.length))
        }

        // 5. Estimated Taxes
        let estTaxes = 0
        const revenueForTax = grossRevenue - estFees // Net Revenue
        taxes.forEach(tax => {
            const base = tax.base_calc === 'gross' ? grossRevenue : revenueForTax
            if (tax.type === 'percent') {
                estTaxes += base * (Number(tax.value) / 100)
            } else {
                estTaxes += Number(tax.value)
            }
        })

        // 6. Fixed Costs (Monthly)
        const monthlyFixed = recurringCosts.reduce((acc, cost) => {
            let val = Number(cost.amount)
            if (cost.frequency === 'yearly') val = val / 12
            return acc + val
        }, 0)

        // 7. Managerial Result
        // Revenue - Fees - Taxes - Fixed Costs - (Variable Expenses?)
        // Variable Expenses = Actual Expenses from Transactions MINUS what might be fixed costs?
        // This is tricky. Mixing Cash Flow (Transactions) and Accrual (Fixed Costs).
        // Let's display "Managerial Balance" as:
        // Revenue - Taxes - Fees - Fixed Costs. 
        // (Ignoring other variable expenses in this specific metric, or assuming 'Fixed Costs' covers the budget)
        // A safer bet: Revenue - Taxes - Fees - MAX(FixedCosts, ActualExpenses)?
        // Let's stick to the Admin Model: Revenue - Taxes - Fees - Costs.
        // EXCEPT: Tenant has many manual expenses (maintenance, petrol).
        // So Managerial Result = Revenue - Taxes - Fees - (Fixed Costs + Variable Expenses from Transactions)
        // To avoid double counting, we assume transactions marked as 'Contas' might be the fixed costs paid.
        // Let's keep it simple: Managerial Result = Revenue - Est. Taxes - Est. Fees - Total Expenses (Actual).
        // AND show "Fixed Costs" as a Budget Reference.

        const managerialResult = grossRevenue - estTaxes - estFees - totalExpenses

        setMetrics({
            grossRevenue,
            netCashFlow,
            managerialResult,
            estTaxes,
            estFees,
            fixedCosts: monthlyFixed,
            totalExpenses
        })
    }

    // --- Actions (CRUD) ---

    // Transactions
    async function handleDeleteTransaction(id) {
        if (await confirm('Excluir transação?')) {
            await supabase.from('financial_transactions').delete().eq('id', id)
            fetchData()
        }
    }

    // Recurring Costs
    async function handleAddCost(e) {
        e.preventDefault()
        const { error } = await supabase.from('tenant_recurring_costs').insert([{ ...newCost, user_id: user.id }])
        if (error) { toastError('Erro ao salvar'); return }
        success('Custo adicionado!')
        setNewCost({ name: '', category: 'general', amount: '', frequency: 'monthly' })
        fetchData()
    }
    async function handleDeleteCost(id) {
        if (await confirm('Remover custo fixo?')) {
            await supabase.from('tenant_recurring_costs').delete().eq('id', id)
            fetchData()
        }
    }

    // Taxes
    async function handleAddTax(e) {
        e.preventDefault()
        const { error } = await supabase.from('tenant_taxes').insert([{ ...newTax, user_id: user.id }])
        if (error) { toastError('Erro ao salvar'); return }
        success('Imposto salvo!')
        setNewTax({ name: '', type: 'percent', value: '', base_calc: 'gross' })
        fetchData()
    }
    async function handleDeleteTax(id) {
        if (await confirm('Remover imposto?')) {
            await supabase.from('tenant_taxes').delete().eq('id', id)
            fetchData()
        }
    }

    // Fees
    async function handleAddFee(e) {
        e.preventDefault()
        const { error } = await supabase.from('tenant_payment_fees').insert([{ ...newFee, user_id: user.id }])
        if (error) { toastError('Erro ao salvar'); return }
        success('Taxa salva!')
        setNewFee({ name: '', fee_percent: '', fee_fixed: '' })
        fetchData()
    }
    async function handleDeleteFee(id) {
        if (await confirm('Remover taxa?')) {
            await supabase.from('tenant_payment_fees').delete().eq('id', id)
            fetchData()
        }
    }

    // --- Filter Logic ---
    const filteredTransactions = transactions.filter(t => {
        const searchMatch = (t.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.category || '').toLowerCase().includes(searchTerm.toLowerCase())
        if (!searchMatch) return false

        if (selectedAccount === 'all') return true

        const isSource = t.account_id === selectedAccount ||
            (selectedAccount === 'business' && t.account?.context === 'business') ||
            (selectedAccount === 'personal' && t.account?.context === 'personal')

        if (isSource) return true
        if (t.type === 'transfer' && t.related_account_id) {
            if (selectedAccount === 'business' && t.related_account?.context === 'business') return true
            if (selectedAccount === 'personal' && t.related_account?.context === 'personal') return true
            if (t.related_account_id === selectedAccount) return true
        }
        return false
    })

    const getFlowAmount = (t) => {
        const val = Number(t.amount) || 0
        if (t.type === 'income') return val
        if (t.type === 'expense') return -val
        if (t.type === 'transfer') {
            const sourceInView = (selectedAccount === 'all') ||
                (selectedAccount === 'business' && t.account?.context === 'business') ||
                (selectedAccount === 'personal' && t.account?.context === 'personal') ||
                (t.account_id === selectedAccount)
            const destInView = (selectedAccount === 'all') ||
                (selectedAccount === 'business' && t.related_account?.context === 'business') ||
                (selectedAccount === 'personal' && t.related_account?.context === 'personal') ||
                (t.related_account_id === selectedAccount)
            if (sourceInView && !destInView) return -val
            if (!sourceInView && destInView) return val
            return 0
        }
        return 0
    }

    // --- Sub-Components ---
    const FinancialCard = ({ label, value, subValue, icon: Icon, colorClass }) => (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm relative overflow-hidden">
            <div className={`absolute top-0 right-0 p-4 opacity-10 ${colorClass}`}>
                <Icon size={64} />
            </div>
            <div className="relative z-10">
                <div className={`p-3 rounded-2xl w-fit mb-4 ${colorClass.replace('text-', 'bg-').replace('600', '100').replace('500', '100')} ${colorClass}`}>
                    <Icon size={24} />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
                <h3 className="text-2xl font-black text-[#13283b] dark:text-white">
                    {value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </h3>
                {subValue && <p className="text-xs font-bold text-slate-400 mt-2">{subValue}</p>}
            </div>
        </div>
    )

    const renderOverview = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <FinancialCard
                    label="Receita Bruta"
                    value={metrics.grossRevenue}
                    icon={TrendingUp}
                    colorClass="text-green-600"
                />
                <FinancialCard
                    label="Despesas Totais"
                    value={metrics.totalExpenses}
                    subValue={`Impostos Est.: ${metrics.estTaxes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                    icon={TrendingDown}
                    colorClass="text-red-600"
                />
                <FinancialCard
                    label="Fluxo de Caixa (Real)"
                    value={metrics.netCashFlow}
                    icon={DollarSign}
                    colorClass={metrics.netCashFlow >= 0 ? "text-blue-600" : "text-red-600"}
                />
                <FinancialCard
                    label="Resultado Gerencial"
                    value={metrics.managerialResult}
                    subValue="Receita - Despesas - Impostos/Taxas"
                    icon={Briefcase}
                    colorClass="text-purple-600"
                />
            </div>
        </div>
    )

    return (
        <div className="space-y-8 pb-20">
            <PageTitle title="Financeiro" />
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">Fluxo de Caixa</h2>
                    <p className="text-slate-400 text-sm font-medium">Gestão Financeira Completa</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Account Switcher */}
                    <div className="bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-100 dark:border-slate-800 flex">
                        {['business', 'personal', 'all'].map(scope => (
                            <button
                                key={scope}
                                onClick={() => setSelectedAccount(scope)}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedAccount === scope ? 'bg-[#13283b] text-white shadow-md' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                            >
                                {scope === 'all' ? 'Tudo' : scope === 'business' ? 'Empresa' : 'Pessoal'}
                            </button>
                        ))}
                    </div>

                    {/* Date Picker */}
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-100 dark:border-slate-800">
                        <input
                            type="month"
                            value={dateFilter}
                            onChange={e => setDateFilter(e.target.value)}
                            className="bg-transparent border-none outline-none text-sm font-bold text-[#13283b] dark:text-white px-2 w-32"
                            onClick={(e) => e.target.showPicker && e.target.showPicker()}
                        />
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex bg-white dark:bg-slate-900 p-1 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm w-fit overflow-x-auto">
                {[
                    { id: 'dashboard', label: 'Visão Geral', icon: Briefcase },
                    { id: 'costs', label: 'Custos Fixos', icon: Wallet },
                    { id: 'settings', label: 'Configurações', icon: Settings },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-[#13283b] text-white shadow-lg' : 'text-slate-400 hover:text-[#13283b]'}`}
                    >
                        <tab.icon size={16} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-300">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                    <p className="font-bold uppercase tracking-widest text-[10px]">Carregando Financeiro...</p>
                </div>
            ) : (
                <>
                    {activeTab === 'dashboard' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {renderOverview()}

                            <div className="app-card overflow-hidden">
                                <div className="p-6 border-b border-border-light dark:border-border-dark flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                    <div className="flex items-center gap-2 w-full md:w-auto">
                                        <Search className="text-text-secondary-light" size={20} />
                                        <input
                                            type="text"
                                            placeholder="Buscar..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="bg-transparent outline-none text-sm w-full md:w-64"
                                        />
                                    </div>
                                    <button
                                        onClick={() => setIsTransactionModalOpen(true)}
                                        className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg shadow-primary/20 transition-all"
                                    >
                                        Nova Transação <Plus size={16} />
                                    </button>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-[10px] text-slate-400 uppercase tracking-widest font-black">
                                            <tr>
                                                <th className="px-6 py-4 text-left">Data</th>
                                                <th className="px-6 py-4 text-left">Conta</th>
                                                <th className="px-6 py-4 text-left">Descrição</th>
                                                <th className="px-6 py-4 text-left">Categoria</th>
                                                <th className="px-6 py-4 text-right">Valor</th>
                                                <th className="px-6 py-4 text-center">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-light dark:divide-border-dark">
                                            {filteredTransactions.map(t => (
                                                <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                    <td className="px-6 py-4 text-xs font-bold text-slate-500">{format(new Date(t.date + 'T12:00:00'), 'dd/MM/yyyy')}</td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-2 h-2 rounded-full bg-${t.account?.context === 'business' ? 'blue' : 'purple'}-500`}></div>
                                                            <span className="font-bold text-xs text-[#13283b] dark:text-white">{t.account?.name}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-xs font-bold text-slate-600 dark:text-slate-300">{t.description}</td>
                                                    <td className="px-6 py-4"><span className="px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] uppercase font-black tracking-wide text-slate-500">{t.category}</span></td>
                                                    <td className={`px-6 py-4 text-xs font-black text-right ${getFlowAmount(t) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                        {getFlowAmount(t) > 0 ? '+' : ''} {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(getFlowAmount(t))}
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <button onClick={() => handleDeleteTransaction(t.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredTransactions.length === 0 && (
                                                <tr><td colSpan="6" className="px-6 py-12 text-center text-slate-400 text-xs font-medium">Nenhum lançamento.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'costs' && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="lg:col-span-2 space-y-4">
                                <h3 className="text-sm font-black text-[#13283b] uppercase tracking-widest">Custos Recorrentes Cadastrados</h3>
                                <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
                                    <table className="w-full text-left">
                                        <thead className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                            <tr>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Nome</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400">Valor</th>
                                                <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Ações</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                                            {recurringCosts.map(cost => (
                                                <tr key={cost.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                    <td className="px-6 py-4 font-bold text-[#13283b] dark:text-white text-xs">{cost.name}</td>
                                                    <td className="px-6 py-4 font-black text-[#13283b] dark:text-white text-xs">
                                                        {Number(cost.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                        <span className="text-[9px] text-slate-400 ml-1 font-medium">/{cost.frequency === 'monthly' ? 'mês' : 'ano'}</span>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button onClick={() => handleDeleteCost(cost.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={16} /></button>
                                                    </td>
                                                </tr>
                                            ))}
                                            {recurringCosts.length === 0 && (
                                                <tr><td colSpan="3" className="px-6 py-12 text-center text-slate-400 text-xs">Nenhum custo fixo cadastrado.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-sm font-black text-[#13283b] uppercase tracking-widest">Novo Custo</h3>
                                <form onSubmit={handleAddCost} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Descrição</label>
                                        <input required type="text" className="app-input" placeholder="Ex: Aluguel" value={newCost.name} onChange={e => setNewCost({ ...newCost, name: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Valor</label>
                                        <input required type="number" step="0.01" className="app-input" placeholder="0.00" value={newCost.amount} onChange={e => setNewCost({ ...newCost, amount: e.target.value })} />
                                    </div>
                                    <button type="submit" className="w-full py-4 bg-[#13283b] text-white rounded-xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] shadow-lg">Adicionar Custo</button>
                                </form>
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Taxes */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-black text-[#13283b] uppercase tracking-widest">Impostos (Estimativa)</h3>
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                                    <form onSubmit={handleAddTax} className="grid grid-cols-1 gap-4 mb-6 pb-6 border-b border-slate-50 dark:border-slate-800">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nome</label>
                                            <input required type="text" className="app-input" placeholder="Ex: DAS" value={newTax.name} onChange={e => setNewTax({ ...newTax, name: e.target.value })} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Valor</label>
                                                <input required type="number" step="0.01" className="app-input" value={newTax.value} onChange={e => setNewTax({ ...newTax, value: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Tipo</label>
                                                <select className="app-input" value={newTax.type} onChange={e => setNewTax({ ...newTax, type: e.target.value })}>
                                                    <option value="percent">%</option>
                                                    <option value="fixed">R$</option>
                                                </select>
                                            </div>
                                        </div>
                                        <button type="submit" className="flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-slate-800 text-[#13283b] dark:text-white rounded-xl font-bold text-xs">
                                            <PlusCircle size={14} /> Adicionar
                                        </button>
                                    </form>
                                    <div className="space-y-2">
                                        {taxes.map(t => (
                                            <div key={t.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
                                                <span className="text-xs font-bold text-[#13283b] dark:text-white">{t.name}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-black">{t.value} {t.type === 'percent' ? '%' : 'R$'}</span>
                                                    <button onClick={() => handleDeleteTax(t.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Fees */}
                            <div className="space-y-4">
                                <h3 className="text-sm font-black text-[#13283b] uppercase tracking-widest">Taxas (Global)</h3>
                                <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm space-y-4">
                                    <form onSubmit={handleAddFee} className="grid grid-cols-1 gap-4 mb-6 pb-6 border-b border-slate-50 dark:border-slate-800">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Descrição</label>
                                            <input required type="text" className="app-input" placeholder="Ex: Taxa Média Maquininha" value={newFee.name} onChange={e => setNewFee({ ...newFee, name: e.target.value })} />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">%</label>
                                                <input required type="number" step="0.01" className="app-input" value={newFee.fee_percent} onChange={e => setNewFee({ ...newFee, fee_percent: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Fixo (R$)</label>
                                                <input required type="number" step="0.01" className="app-input" value={newFee.fee_fixed} onChange={e => setNewFee({ ...newFee, fee_fixed: e.target.value })} />
                                            </div>
                                        </div>
                                        <button type="submit" className="flex items-center justify-center gap-2 py-3 bg-slate-100 dark:bg-slate-800 text-[#13283b] dark:text-white rounded-xl font-bold text-xs">
                                            <PlusCircle size={14} /> Adicionar
                                        </button>
                                    </form>
                                    <div className="space-y-2">
                                        {fees.map(f => (
                                            <div key={f.id} className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-xl">
                                                <span className="text-xs font-bold text-[#13283b] dark:text-white">{f.name}</span>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-xs font-black">{f.fee_percent}% + R$ {f.fee_fixed}</span>
                                                    <button onClick={() => handleDeleteFee(f.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            <TransactionModal
                isOpen={isTransactionModalOpen}
                onClose={() => setIsTransactionModalOpen(false)}
                onSuccess={() => { fetchData() }}
                accounts={accounts}
            />
        </div>
    )
}

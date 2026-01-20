import { useState, useEffect } from 'react'
import {
    CreditCard,
    TrendingUp,
    TrendingDown,
    Download,
    DollarSign,
    PieChart,
    Calendar,
    ArrowUpRight,
    RefreshCw,
    Settings,
    FileText,
    Wallet,
    PlusCircle,
    Trash2,
    Save
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useDialog } from '../components/DialogProvider'

const ADMIN_EMAILS = ['joaopedro.faggionato@gmail.com', 'joaopedrofaggionato@gmail.com', 'faggionato.rentals@gmail.com']

// Mock de dados para initial state (caso tabelas ainda não existam)
const DEFAULT_METRICS = {
    grossMrr: 0,
    netProfit: 0,
    totalTaxes: 0,
    totalFees: 0,
    totalCosts: 0,
    activeSubscribers: 0,
    arpu: 0,
    profitMargin: 0
}

const FinancialCard = ({ label, value, trend, trendLabel, icon: Icon, colorClass = "text-[#13283b]" }) => (
    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 relative overflow-hidden group hover:-translate-y-1 transition-all duration-300">
        <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 group-hover:bg-slate-100/50 transition-all text-[#13283b]" />
        <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-slate-50 rounded-2xl group-hover:scale-110 transition-transform">
                    <Icon size={24} className={colorClass} />
                </div>
                {trend !== undefined && (
                    <div className={`flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-full border ${trend >= 0 ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                        {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                        {Math.abs(trend)}%
                    </div>
                )}
            </div>
            <div className="space-y-1">
                <p className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400 mb-1">{label}</p>
                <h3 className="text-3xl font-black text-[#13283b] tracking-tighter">{value}</h3>
                {trendLabel && <p className="text-[9px] text-slate-400 font-bold mt-2">{trendLabel}</p>}
            </div>
        </div>
    </div>
)

export default function AdminFinance() {
    const { success, error: toastError, confirm } = useDialog()
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState('overview')
    const [metrics, setMetrics] = useState(DEFAULT_METRICS)

    // Data States
    const [subscriptions, setSubscriptions] = useState([])
    const [taxes, setTaxes] = useState([])
    const [fees, setFees] = useState([])
    const [costs, setCosts] = useState([])

    // New Item States
    const [newCost, setNewCost] = useState({ name: '', category: 'infra', amount: '', frequency: 'monthly', due_day: 1 })
    const [newTax, setNewTax] = useState({ name: '', type: 'percent', value: '', base_calc: 'gross' })

    useEffect(() => {
        fetchAllData()
    }, [])

    const fetchAllData = async () => {
        try {
            setLoading(true)

            // 1. Fetch Subscriptions (Receita)
            const { data: subs } = await supabase.from('saas_subscriptions').select('*, profiles(full_name, email)')

            // 2. Fetch Taxes
            const { data: taxData } = await supabase.from('saas_taxes').select('*').eq('active', true)

            // 3. Fetch Fees
            const { data: feeData } = await supabase.from('saas_payment_fees').select('*').eq('active', true)

            // 4. Fetch Costs
            const { data: costData } = await supabase.from('saas_recurring_costs').select('*').eq('active', true)

            // Filter out orphans and admin
            const validSubs = subs?.filter(s => s.profiles && !ADMIN_EMAILS.includes(s.profiles.email)) || []

            if (subs) setSubscriptions(validSubs)
            if (taxData) setTaxes(taxData)
            if (feeData) setFees(feeData)
            if (costData) setCosts(costData)

            calculateMetrics(validSubs, taxData || [], feeData || [], costData || [])

        } catch (err) {
            console.error('Error fetching finance data:', err)
            // Silent fail for non-existent tables (user hasn't migrated yet)
        } finally {
            setLoading(false)
        }
    }

    const calculateMetrics = (subs, txs, fs, csts) => {
        // 1. Receita Bruta (MRR) - Normalized by billing cycle
        const activeSubs = subs.filter(s => {
            const isActive = s.status === 'active'
            const isTrialing = s.status === 'trialing'
            const isCanceledButActive = s.status === 'canceled' && s.current_period_end && new Date(s.current_period_end) > new Date()
            return isActive || isTrialing || isCanceledButActive
        })
        const grossMrr = activeSubs.reduce((acc, sub) => {
            const amount = sub.custom_amount_cents || sub.amount_cents || 0
            const cycle = (sub.billing_cycle || sub.plan_type || 'monthly').toLowerCase()

            let divisor = 1
            if (cycle.includes('annual') || cycle.includes('anual')) divisor = 12
            else if (cycle.includes('quarter') || cycle.includes('trimestre')) divisor = 3
            else if (cycle.includes('semester') || cycle.includes('semestre')) divisor = 6

            return acc + (amount / divisor)
        }, 0) / 100

        // 2. Taxas de Gateway (Estimativa baseada no método de pagamento)
        // Se a fee não existir pro método, usa média de 2%
        let totalFees = 0
        activeSubs.forEach(sub => {
            const amount = (sub.custom_amount_cents || sub.amount_cents || 0) / 100
            // Find fee rule for this payment method (assuming 'credit_card' as default if null)
            const method = sub.payment_method || 'credit_card'
            const rule = fs.find(f => f.payment_method === method) || fs.find(f => f.payment_method === 'all')

            let feeVal = 0
            if (rule) {
                // Ensure we calculate fee on the FULL amount paid, even if we track MRR as normalized
                const fullAmount = (sub.custom_amount_cents || sub.amount_cents || 0) / 100
                feeVal = (fullAmount * (rule.fee_percent / 100)) + parseFloat(rule.fee_fixed)

                // For MRR purposes, we should also normalize the fee if we want a "Monthly Net Profit"
                const cycle = (sub.billing_cycle || sub.plan_type || 'monthly').toLowerCase()
                let divisor = 1
                if (cycle.includes('annual') || cycle.includes('anual')) divisor = 12
                else if (cycle.includes('quarter') || cycle.includes('trimestre')) divisor = 3

                totalFees += (feeVal / divisor)
            }
        })

        // 3. Receita Líquida Operacional (Gross - Fees)
        const netRevenue = grossMrr - totalFees

        // 4. Impostos
        let totalTaxes = 0
        txs.forEach(tax => {
            const base = tax.base_calc === 'gross' ? grossMrr : netRevenue
            if (tax.type === 'percent') {
                totalTaxes += base * (tax.value / 100)
            } else {
                totalTaxes += parseFloat(tax.value)
            }
        })

        // 5. Custos Recorrentes
        // Normaliza custos anuais para mensal
        const totalCosts = csts.reduce((acc, cost) => {
            let val = parseFloat(cost.amount)
            if (cost.frequency === 'yearly') val = val / 12
            return acc + val
        }, 0)

        // 6. Lucro Líquido Final
        const netProfit = netRevenue - totalTaxes - totalCosts
        const profitMargin = grossMrr > 0 ? (netProfit / grossMrr) * 100 : 0
        const arpu = activeSubs.length > 0 ? grossMrr / activeSubs.length : 0

        setMetrics({
            grossMrr,
            netProfit,
            totalTaxes,
            totalFees,
            totalCosts,
            activeSubscribers: activeSubs.length,
            arpu,
            profitMargin
        })
    }

    // --- Actions ---

    // --- Actions ---

    // 1. Costs
    const handleAddCost = async (e) => {
        e.preventDefault()
        try {
            const { error } = await supabase.from('saas_recurring_costs').insert([newCost])
            if (error) throw error
            success('Custo adicionado com sucesso!')
            setNewCost({ name: '', category: 'infra', amount: '', frequency: 'monthly', due_day: 1 })
            fetchAllData()
        } catch (err) {
            toastError('Erro ao salvar custo.')
        }
    }

    const handleDeleteCost = async (id) => {
        if (await confirm('Remover este custo recorrente?')) {
            await supabase.from('saas_recurring_costs').delete().eq('id', id)
            fetchAllData()
        }
    }

    // 2. Taxes
    const handleAddTax = async (e) => {
        e.preventDefault()
        try {
            const { error } = await supabase.from('saas_taxes').insert([newTax])
            if (error) throw error
            success('Regra de imposto salva!')
            setNewTax({ name: '', type: 'percent', value: '', base_calc: 'gross' })
            fetchAllData()
        } catch (err) {
            toastError('Erro ao salvar regra.')
        }
    }

    const handleDeleteTax = async (id) => {
        if (await confirm('Remover esta regra de imposto?')) {
            await supabase.from('saas_taxes').delete().eq('id', id)
            fetchAllData()
        }
    }

    // 3. Fees
    const [newFee, setNewFee] = useState({ provider_name: '', payment_method: 'credit_card', fee_percent: '', fee_fixed: '' })

    const handleAddFee = async (e) => {
        e.preventDefault()
        try {
            // Validate if method already exists to avoid duplicates
            if (fees.some(f => f.payment_method === newFee.payment_method)) {
                if (!await confirm('Já existe uma regra para este método. Deseja adicionar outra? (Pode gerar duplicidade de cálculo)')) return
            }

            const { error } = await supabase.from('saas_payment_fees').insert([newFee])
            if (error) throw error
            success('Taxa de gateway salva!')
            setNewFee({ provider_name: '', payment_method: 'credit_card', fee_percent: '', fee_fixed: '' })
            fetchAllData()
        } catch (err) {
            toastError('Erro ao salvar taxa.')
        }
    }

    const handleDeleteFee = async (id) => {
        if (await confirm('Remover esta taxa de gateway?')) {
            await supabase.from('saas_payment_fees').delete().eq('id', id)
            fetchAllData()
        }
    }

    // --- Renders ---

    const renderOverview = () => (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <FinancialCard
                    label="Receita Bruta (MRR)"
                    value={metrics.grossMrr.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    icon={CreditCard}
                    colorClass="text-blue-600"
                />
                <FinancialCard
                    label="Despesas Totais"
                    value={metrics.totalCosts.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    icon={TrendingDown}
                    colorClass="text-red-500"
                    trendLabel={`+ Impostos: ${metrics.totalTaxes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`}
                />
                <FinancialCard
                    label="Lucro Líquido"
                    value={metrics.netProfit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    icon={DollarSign}
                    colorClass={metrics.netProfit >= 0 ? "text-green-600" : "text-red-600"}
                    trend={metrics.profitMargin}
                    trendLabel={`Margem Real: ${metrics.profitMargin.toFixed(1)}%`}
                />
                <FinancialCard
                    label="Burn Rate Mensal"
                    value={(metrics.totalCosts + metrics.totalTaxes + metrics.totalFees).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    icon={Wallet}
                    colorClass="text-orange-500"
                    trendLabel="Custo para manter operando"
                />
            </div>

            {/* Sub-metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase text-slate-400">Total Taxas Gateway</p>
                        <p className="text-xl font-black text-[#13283b]">{metrics.totalFees.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase text-slate-400">Total Impostos (Est.)</p>
                        <p className="text-xl font-black text-[#13283b]">{metrics.totalTaxes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase text-slate-400">ARPU (Ticket Médio)</p>
                        <p className="text-xl font-black text-[#13283b]">{metrics.arpu.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                </div>
            </div>
        </div>
    )

    const renderCosts = () => (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* List */}
            <div className="lg:col-span-2 space-y-4">
                <h3 className="text-lg font-black text-[#13283b] uppercase tracking-tighter">Custos Recorrentes</h3>
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr>
                                <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400">Nome</th>
                                <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400">Categoria</th>
                                <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400">Valor</th>
                                <th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {costs.map(cost => (
                                <tr key={cost.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-8 py-4 font-bold text-[#13283b]">{cost.name}</td>
                                    <td className="px-8 py-4 text-xs font-bold text-slate-500 uppercase">{cost.category}</td>
                                    <td className="px-8 py-4 font-black text-[#13283b]">
                                        {parseFloat(cost.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        <span className="text-[9px] text-slate-400 ml-1 font-medium">/{cost.frequency === 'monthly' ? 'mês' : 'ano'}</span>
                                    </td>
                                    <td className="px-8 py-4 text-right">
                                        <button onClick={() => handleDeleteCost(cost.id)} className="text-red-400 hover:text-red-600 transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {costs.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="px-8 py-12 text-center text-slate-400 text-xs font-medium">Nenhum custo cadastrado.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Form */}
            <div className="space-y-4">
                <h3 className="text-lg font-black text-[#13283b] uppercase tracking-tighter">Novo Custo</h3>
                <form onSubmit={handleAddCost} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/50 space-y-4">
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nome da Despesa</label>
                        <input required type="text" className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-[#13283b] text-sm focus:bg-white border border-transparent focus:border-slate-200 outline-none transition-all"
                            placeholder="Ex: Servidor AWS"
                            value={newCost.name} onChange={e => setNewCost({ ...newCost, name: e.target.value })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Valor</label>
                            <input required type="number" step="0.01" className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-[#13283b] text-sm focus:bg-white border border-transparent focus:border-slate-200 outline-none transition-all"
                                placeholder="0.00"
                                value={newCost.amount} onChange={e => setNewCost({ ...newCost, amount: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Categoria</label>
                            <select className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-[#13283b] text-sm outline-none"
                                value={newCost.category} onChange={e => setNewCost({ ...newCost, category: e.target.value })}
                            >
                                <option value="infra">Infraestrutura</option>
                                <option value="marketing">Marketing</option>
                                <option value="staff">Equipe</option>
                                <option value="tools">Ferramentas</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Frequência</label>
                        <select className="w-full px-4 py-3 bg-slate-50 rounded-xl font-bold text-[#13283b] text-sm outline-none"
                            value={newCost.frequency} onChange={e => setNewCost({ ...newCost, frequency: e.target.value })}
                        >
                            <option value="monthly">Mensal</option>
                            <option value="yearly">Anual</option>
                            <option value="one_off">Pontual</option>
                        </select>
                    </div>
                    <button type="submit" className="w-full py-4 bg-[#13283b] text-white rounded-xl font-black uppercase tracking-widest text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-lg">
                        Adicionar Custo
                    </button>
                </form>
            </div>
        </div>
    )

    const renderSettings = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Taxes */}
            <div className="space-y-4">
                <h3 className="text-lg font-black text-[#13283b] uppercase tracking-tighter">Regras de Impostos</h3>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                    <form onSubmit={handleAddTax} className="grid grid-cols-1 gap-4 mb-6 pb-6 border-b border-slate-50">
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Nome do Imposto</label>
                            <input required type="text" placeholder="Ex: Simples Nacional" className="w-full px-4 py-2 bg-slate-50 rounded-xl text-sm font-bold text-[#13283b]"
                                value={newTax.name} onChange={e => setNewTax({ ...newTax, name: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Valor (%)</label>
                                <input required type="number" step="0.01" className="w-full px-4 py-2 bg-slate-50 rounded-xl text-sm font-bold text-[#13283b]"
                                    value={newTax.value} onChange={e => setNewTax({ ...newTax, value: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Base</label>
                                <select className="w-full px-4 py-2 bg-slate-50 rounded-xl text-sm font-bold text-[#13283b]"
                                    value={newTax.base_calc} onChange={e => setNewTax({ ...newTax, base_calc: e.target.value })}
                                >
                                    <option value="gross">Receita Bruta</option>
                                    <option value="net">Receita Líquida</option>
                                </select>
                            </div>
                        </div>
                        <button type="submit" className="flex items-center justify-center gap-2 py-2 bg-slate-100 text-[#13283b] rounded-xl font-bold text-xs hover:bg-[#13283b] hover:text-white transition-all">
                            <PlusCircle size={14} /> Adicionar Regra
                        </button>
                    </form>

                    <div className="space-y-2">
                        {taxes.map(tax => (
                            <div key={tax.id} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl group">
                                <div>
                                    <p className="text-xs font-bold text-[#13283b]">{tax.name}</p>
                                    <p className="text-[9px] font-bold text-slate-400">{tax.base_calc === 'gross' ? '% sobre Bruto' : '% sobre Líquido'}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-black text-[#13283b]">{tax.value}%</span>
                                    <button onClick={() => handleDeleteTax(tax.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Fees */}
            <div className="space-y-4">
                <h3 className="text-lg font-black text-[#13283b] uppercase tracking-tighter">Taxas de Gateway</h3>
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                    <form onSubmit={handleAddFee} className="grid grid-cols-1 gap-4 mb-6 pb-6 border-b border-slate-50">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Gateway</label>
                                <input required type="text" placeholder="Ex: Stripe" className="w-full px-4 py-2 bg-slate-50 rounded-xl text-sm font-bold text-[#13283b]"
                                    value={newFee.provider_name} onChange={e => setNewFee({ ...newFee, provider_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Método</label>
                                <select className="w-full px-4 py-2 bg-slate-50 rounded-xl text-sm font-bold text-[#13283b]"
                                    value={newFee.payment_method} onChange={e => setNewFee({ ...newFee, payment_method: e.target.value })}
                                >
                                    <option value="credit_card">Cartão de Crédito</option>
                                    <option value="pix">Pix</option>
                                    <option value="boleto">Boleto</option>
                                    <option value="all">Todos</option>
                                </select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Taxa (%)</label>
                                <input required type="number" step="0.01" className="w-full px-4 py-2 bg-slate-50 rounded-xl text-sm font-bold text-[#13283b]"
                                    value={newFee.fee_percent} onChange={e => setNewFee({ ...newFee, fee_percent: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Taxa Fixa (R$)</label>
                                <input required type="number" step="0.01" className="w-full px-4 py-2 bg-slate-50 rounded-xl text-sm font-bold text-[#13283b]"
                                    value={newFee.fee_fixed} onChange={e => setNewFee({ ...newFee, fee_fixed: e.target.value })}
                                />
                            </div>
                        </div>
                        <button type="submit" className="flex items-center justify-center gap-2 py-2 bg-slate-100 text-[#13283b] rounded-xl font-bold text-xs hover:bg-[#13283b] hover:text-white transition-all">
                            <PlusCircle size={14} /> Adicionar Taxa
                        </button>
                    </form>

                    <div className="space-y-2">
                        {fees.map(fee => (
                            <div key={fee.id} className="flex justify-between items-center bg-slate-50 p-4 rounded-xl group">
                                <div className="flex items-center gap-3">
                                    <CreditCard size={16} className="text-slate-400" />
                                    <div>
                                        <p className="text-xs font-bold text-[#13283b] capitalize">{fee.provider_name}</p>
                                        <p className="text-[9px] font-bold text-slate-400 capitalize">{fee.payment_method === 'credit_card' ? 'Cartão de Crédito' : fee.payment_method}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-black text-[#13283b]">{fee.fee_percent}% + R$ {fee.fee_fixed}</span>
                                    <button onClick={() => handleDeleteFee(fee.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {fees.length === 0 && <p className="text-xs text-slate-400 text-center py-4">Nenhuma taxa configurada.</p>}
                    </div>
                </div>
            </div>
        </div>
    )

    return (
        <div className="space-y-8 w-full">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-4xl font-black text-[#13283b] uppercase tracking-tighter mb-1">Gestão Financeira</h2>
                    <p className="text-slate-400 font-medium tracking-wide text-sm">Controle de lucros, custos e impostos do SaaS.</p>
                </div>
                <div className="flex bg-white p-1 rounded-2xl border border-slate-100 shadow-sm">
                    {['overview', 'revenue', 'costs', 'settings'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-[#13283b] text-white shadow-lg' : 'text-slate-400 hover:text-[#13283b]'
                                }`}
                        >
                            {tab === 'overview' ? 'Visão Geral' : tab === 'revenue' ? 'Receitas' : tab === 'costs' ? 'Custos' : 'Configurações'}
                        </button>
                    ))}
                </div>
            </header>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-4 text-slate-300">
                    <RefreshCw className="w-8 h-8 animate-spin" />
                    <p className="font-bold uppercase tracking-widest text-[10px]">Calculando Indicadores...</p>
                </div>
            ) : (
                <>
                    {activeTab === 'overview' && renderOverview()}
                    {activeTab === 'costs' && renderCosts()}
                    {activeTab === 'settings' && renderSettings()}
                    {activeTab === 'revenue' && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <h3 className="text-lg font-black text-[#13283b] uppercase tracking-tighter">Detalhamento de Receita</h3>
                            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50/50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400">Assinante</th>
                                            <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400">Plano</th>
                                            <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400">Valor Bruto</th>
                                            <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400">MRR (Mensal)</th>
                                            <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400">Taxas (Est. Mensal)</th>
                                            <th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">Líquido Mensal</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {subscriptions.filter(s => {
                                            const isActive = s.status === 'active'
                                            const isTrialing = s.status === 'trialing'
                                            const isCanceledButActive = s.status === 'canceled' && s.current_period_end && new Date(s.current_period_end) > new Date()
                                            return isActive || isTrialing || isCanceledButActive
                                        }).map(sub => {
                                            const gross = (sub.custom_amount_cents || sub.amount_cents || 0) / 100
                                            const cycle = (sub.billing_cycle || sub.plan_type || 'monthly').toLowerCase()
                                            const isCanceledButActive = sub.status === 'canceled' && sub.current_period_end && new Date(sub.current_period_end) > new Date()

                                            let divisor = 1
                                            if (cycle.includes('annual') || cycle.includes('anual')) divisor = 12
                                            else if (cycle.includes('quarter') || cycle.includes('trimestre')) divisor = 3

                                            const mrr = gross / divisor

                                            // Calculate Fee for this row (Normalized)
                                            let feeVal = 0
                                            const method = sub.payment_method || 'credit_card'
                                            const rule = fees.find(f => f.payment_method === method) || fees.find(f => f.payment_method === 'all')

                                            if (rule) {
                                                const fullFee = (gross * (rule.fee_percent / 100)) + parseFloat(rule.fee_fixed)
                                                feeVal = fullFee / divisor
                                            }

                                            return (
                                                <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-6 py-4">
                                                        <p className="font-bold text-[#13283b] text-xs">{sub.profiles?.full_name || sub.profiles?.email || 'Desconhecido'}</p>
                                                        <p className="text-[9px] font-bold text-slate-400">{new Date(sub.created_at).toLocaleDateString()}</p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wide border ${cycle.includes('anual') || cycle.includes('annual') ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-100 text-slate-500 border-slate-200'
                                                            }`}>
                                                            {sub.plan_type || sub.billing_cycle || 'Mensal'}
                                                        </span>
                                                        {isCanceledButActive && (
                                                            <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100 text-[7px] font-black uppercase">
                                                                Pendente Exp.
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4 font-bold text-slate-400 text-xs">
                                                        {gross.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </td>
                                                    <td className="px-6 py-4 font-black text-[#13283b] text-xs">
                                                        {mrr.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </td>
                                                    <td className="px-6 py-4 font-bold text-red-400 text-xs">
                                                        - {feeVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </td>
                                                    <td className="px-6 py-4 font-black text-green-600 text-xs text-right">
                                                        {(mrr - feeVal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

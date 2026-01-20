
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import {
    Search,
    Filter,
    MoreHorizontal,
    UserPlus,
    CheckCircle2,
    XCircle,
    Clock,
    PauseCircle,
    PlayCircle,
    RefreshCw,
    Lock,
    Unlock,
    DollarSign,
    CreditCard as CardIcon,
    History as HistoryIcon,
    Mail,
    AlertTriangle,
    ExternalLink,
    Eye,
    MessageSquare,
    Pencil
} from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { validateCPF, validateCNPJ } from '../lib/validators'
import { useDialog } from '../components/DialogProvider'

const BRAZILIAN_STATES = [
    // ... existing state list logic
]

const ADMIN_EMAILS = ['joaopedro.faggionato@gmail.com', 'joaopedrofaggionato@gmail.com', 'faggionato.rentals@gmail.com']

const StatusBadge = ({ status }) => {
    const styles = {
        active: 'bg-green-50 text-green-600 border-green-100',
        past_due: 'bg-amber-50 text-amber-600 border-amber-100',
        canceled: 'bg-red-50 text-red-600 border-red-100',
        canceled_active: 'bg-indigo-50 text-indigo-600 border-indigo-100',
        suspended: 'bg-slate-100 text-slate-500 border-slate-200',
        trial: 'bg-blue-50 text-blue-600 border-blue-100'
    }

    const labels = {
        active: 'Ativo',
        past_due: 'Inadimplente',
        canceled: 'Expirado',
        canceled_active: 'Pendente Exp.',
        suspended: 'Suspenso',
        trial: 'Trial'
    }

    return (
        <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${styles[status] || styles.suspended}`}>
            {labels[status] || status}
        </span>
    )
}

const HealthScore = ({ subscriber }) => {
    // Calculo Dinâmico de Saúde
    const subscription = subscriber.saas_subscriptions?.[0] || {}
    let score = 85 // Base

    if (subscriber.is_suspended) score = 10
    if (subscription.status === 'past_due') score -= 50
    if (subscription.status === 'canceled') score -= 80

    // Penalidade por falta de login (simulado se last_login_at não estiver preenchido)
    const lastLogin = subscriber.last_login_at ? new Date(subscriber.last_login_at) : new Date(subscriber.created_at)
    const daysSinceLogin = Math.floor((new Date() - lastLogin) / (1000 * 60 * 60 * 24))
    if (daysSinceLogin > 7) score -= 20
    if (daysSinceLogin > 15) score -= 20

    const finalScore = Math.max(0, Math.min(100, score))
    const isGood = finalScore >= 70
    const isMedium = finalScore >= 40 && finalScore < 70
    const colorClass = isGood ? 'bg-green-500' : isMedium ? 'bg-amber-500' : 'bg-red-500'
    const label = isGood ? 'Saudável' : isMedium ? 'Atenção' : 'Risco de Churn'

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
                <div className="flex-1 max-w-[60px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                        className={`h-full ${colorClass} transition-all duration-1000`}
                        style={{ width: `${finalScore}%` }}
                    />
                </div>
                <span className="text-[10px] font-bold text-slate-400">{finalScore}%</span>
            </div>
            <span className={`text-[8px] font-black uppercase tracking-tighter ${isGood ? 'text-green-600' : isMedium ? 'text-amber-600' : 'text-red-600'}`}>
                {label}
            </span>
        </div>
    )
}

export default function AdminSubscribers() {
    const location = useLocation()
    const [subscribers, setSubscribers] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState(location.state?.search || '')
    const [filter, setFilter] = useState('all')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [newSub, setNewSub] = useState({
        email: '',
        full_name: '',
        // Legal
        person_type: 'PF',
        tax_id: '',
        // Contact
        whatsapp: '',
        company_name: '',
        city: '',
        state: '',
        // Admin Control
        account_type: 'common',
        initial_status: 'active',
        // Finance
        plan_type: 'mensal',
        custom_amount_cents: 9990,
        billing_cycle: 'monthly',
        // Security
        temp_password: '',
        send_invite: true
    })
    const [selectedSub, setSelectedSub] = useState(null)
    const { success, error: toastError, alert, confirm } = useDialog()
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
    const [isPlanModalOpen, setIsPlanModalOpen] = useState(false)
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
    const [isFinanceModalOpen, setIsFinanceModalOpen] = useState(false)
    const [isBillingModalOpen, setIsBillingModalOpen] = useState(false)
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editSub, setEditSub] = useState(null)
    const [loadingCities, setLoadingCities] = useState(false)
    const [cities, setCities] = useState([])
    const [billingHistory, setBillingHistory] = useState([])
    const [loadingBilling, setLoadingBilling] = useState(false)

    const fetchCities = async (uf) => {
        setLoadingCities(true)
        try {
            const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`)
            const data = await response.json()
            const cityList = data.map(city => city.nome).sort()
            setCities(cityList)
        } catch (err) {
            console.error('Error fetching cities:', err)
        } finally {
            setLoadingCities(false)
        }
    }

    useEffect(() => {
        if (newSub.state) {
            fetchCities(newSub.state)
        }
    }, [newSub.state])

    useEffect(() => {
        if (editSub?.state) {
            fetchCities(editSub.state)
        }
    }, [editSub?.state])

    useEffect(() => {
        fetchSubscribers()
    }, [])

    const fetchSubscribers = async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select(`
                    id,
                    email,
                    full_name,
                    is_suspended,
                    created_at,
                    last_login_at,
                    person_type,
                    tax_id,
                    whatsapp,
                    company_name,
                    city,
                    state,
                    account_type,
                    terms_accepted,
                    referral_source,
                    main_objective,
                    company_size,
                    saas_subscriptions (
                        id,
                        status,
                        plan_type,
                        amount_cents,
                        custom_amount_cents,
                        billing_cycle,
                        current_period_end,
                        payment_method,
                        origin,
                        updated_at
                    )
                `)
                .eq('role', 'user')
                .not('email', 'in', `(${ADMIN_EMAILS.join(',')})`)
                .order('created_at', { ascending: false })

            if (error) throw error
            setSubscribers(data)
        } catch (err) {
            console.error('Error fetching subscribers:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleToggleSuspension = async (id, currentStatus) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ is_suspended: !currentStatus })
                .eq('id', id)

            if (error) throw error
            fetchSubscribers()
        } catch (err) {
            toastError('Erro ao alterar status')
        }
    }

    const handleSendBilling = (sub) => {
        setSelectedSub(sub)
        setIsBillingModalOpen(true)
    }

    const handleUpdatePlan = async (e) => {
        e.preventDefault()
        // Here we would update saas_subscriptions
        success('Plano atualizado com sucesso! (Simulado)')
        setIsPlanModalOpen(false)
        fetchSubscribers()
    }

    const fetchBillingHistory = async (email) => {
        if (!email) return
        setLoadingBilling(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-billing-info`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ email })
            })

            const result = await response.json()
            if (result.invoices) setBillingHistory(result.invoices)
            else if (result.error) console.error('Billing error:', result.error)
        } catch (err) {
            console.error('Failed to fetch billing:', err)
        } finally {
            setLoadingBilling(false)
        }
    }

    const handleViewFinance = (sub) => {
        setSelectedSub(sub)
        setBillingHistory([])
        setIsFinanceModalOpen(true)
        fetchBillingHistory(sub.email)
    }

    const handleCancelSubscription = async () => {
        try {
            const { error } = await supabase
                .from('saas_subscriptions')
                .update({ status: 'canceled' })
                .eq('user_id', selectedSub.id)

            if (error) throw error
            success('Assinatura cancelada com sucesso.')
            setIsCancelModalOpen(false)
            fetchSubscribers()
        } catch (err) {
            toastError('Erro ao cancelar assinatura')
        }
    }

    const handleEditClick = (sub) => {
        setEditSub({
            ...sub,
            person_type: sub.person_type || 'PF',
            tax_id: sub.tax_id || '',
            whatsapp: sub.whatsapp || '',
            company_name: sub.company_name || '',
            city: sub.city || '',
            state: sub.state || '',
            referral_source: sub.referral_source || '',
            main_objective: sub.main_objective || '',
            company_size: sub.company_size || ''
        })
        setIsEditModalOpen(true)
    }

    const handleUpdateProfile = async (e) => {
        e.preventDefault()

        const isTaxIdValid = editSub.person_type === 'PF'
            ? validateCPF(editSub.tax_id)
            : validateCNPJ(editSub.tax_id)

        if (!isTaxIdValid && editSub.tax_id) {
            toastError(`O ${editSub.person_type === 'PF' ? 'CPF' : 'CNPJ'} informado não é válido.`)
            return
        }

        setLoading(true)
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: editSub.full_name,
                    person_type: editSub.person_type,
                    tax_id: editSub.tax_id,
                    whatsapp: editSub.whatsapp,
                    company_name: editSub.company_name,
                    city: editSub.city,
                    state: editSub.state,
                    referral_source: editSub.referral_source,
                    main_objective: editSub.main_objective,
                    company_size: editSub.company_size,
                    updated_at: new Date().toISOString()
                })
                .eq('id', editSub.id)

            if (error) throw error

            setIsEditModalOpen(false)
            setEditSub(null)
            fetchSubscribers()
            success('Perfil atualizado com sucesso!')
        } catch (err) {
            console.error('Error updating profile:', err)
            toastError('Erro ao atualizar: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleManualRegister = async (e) => {
        e.preventDefault()

        const isTaxIdValid = newSub.person_type === 'PF'
            ? validateCPF(newSub.tax_id)
            : validateCNPJ(newSub.tax_id)

        if (!isTaxIdValid) {
            toastError(`O ${newSub.person_type === 'PF' ? 'CPF' : 'CNPJ'} informado não é válido.`)
            return
        }

        setLoading(true)
        try {
            // Create isolated client to avoid clobbering admin session
            // We use the ANON key because we are simulating a public signup but with extra metadata
            const tempClient = createClient(
                import.meta.env.VITE_SUPABASE_URL,
                import.meta.env.VITE_SUPABASE_ANON_KEY,
                { auth: { persistSession: false } }
            )

            const passwordToUse = newSub.temp_password || Math.random().toString(36).slice(-8) + 'Aa1!'

            const { data, error } = await tempClient.auth.signUp({
                email: newSub.email,
                password: passwordToUse,
                options: {
                    data: {
                        full_name: newSub.full_name,
                        person_type: newSub.person_type,
                        tax_id: newSub.tax_id,
                        whatsapp: newSub.whatsapp,
                        company_name: newSub.company_name,
                        city: newSub.city,
                        state: newSub.state,
                        // Admin Fields (Admin triggers will pick these up)
                        account_type: newSub.account_type,
                        billing_cycle: newSub.billing_cycle,
                        custom_amount_cents: parseInt(newSub.custom_amount_cents),
                        // Force terms acceptance for manual entry
                        terms_accepted: true
                    }
                }
            })

            if (error) throw error

            // Post-creation Admin Overrides
            if (data.user) {
                // If status is not active, we update it immediately using the MAIN ADMIN client
                if (newSub.initial_status !== 'active') {
                    if (newSub.initial_status === 'suspended') {
                        await supabase.from('profiles').update({ is_suspended: true }).eq('id', data.user.id)
                    } else {
                        // Trial or Canceled
                        await supabase.from('saas_subscriptions').update({ status: newSub.initial_status }).eq('user_id', data.user.id)
                    }
                }
            }

            // Logic to Show/Copy Password if generated
            if (!newSub.temp_password) {
                // In a real app we might show a modal here or send an email. 
                // For now, we included the password in the "invite" logic conceptualization.
                console.log('Generated Password:', passwordToUse)
            }

            setIsModalOpen(false)
            setNewSub({
                email: '', full_name: '', person_type: 'PF', tax_id: '',
                whatsapp: '', company_name: '', city: '', state: '',
                account_type: 'common', initial_status: 'active',
                plan_type: 'mensal', custom_amount_cents: 9990, billing_cycle: 'monthly',
                temp_password: '', send_invite: true
            })
            fetchSubscribers()
            success('Assinante cadastrado com sucesso! (' + passwordToUse + ')')
        } catch (err) {
            console.error('Error manual register:', err)
            toastError('Erro ao cadastrar: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const filteredSubscribers = subscribers.filter(sub => {
        const matchesSearch = sub.email?.toLowerCase().includes(search.toLowerCase()) ||
            sub.full_name?.toLowerCase().includes(search.toLowerCase())

        const subscription = sub.saas_subscriptions?.[0] || {}
        const status = sub.is_suspended ? 'suspended' : subscription.status || 'active'

        if (filter === 'all') return matchesSearch
        return matchesSearch && status === filter
    })

    return (
        <div className="flex flex-col flex-1 space-y-12 w-full">
            <header className="flex justify-between items-start">
                <div>
                    <h2 className="text-4xl font-black text-[#13283b] uppercase tracking-tighter mb-2">Assinantes</h2>
                    <p className="text-slate-400 font-medium tracking-wide text-lg">Centro de Sucesso do Cliente e Gestão de Churn.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="bg-[#13283b] text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] transition-all flex items-center gap-2"
                >
                    <UserPlus size={16} />
                    Cadastrar Manualmente
                </button>
            </header>

            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30 flex flex-col flex-1 mb-12 relative">
                <div className="p-8 border-b border-slate-50 flex flex-wrap gap-6 items-center justify-between bg-slate-50/30 rounded-t-[2.5rem]">
                    <div className="relative flex-1 min-w-[300px]">
                        <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar por empresa, nome ou email..."
                            className="w-full pl-14 pr-6 py-4 bg-white border border-slate-100 rounded-2xl text-sm focus:ring-4 ring-slate-100 transition-all shadow-sm text-[#13283b]"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-100 shadow-sm">
                        {['all', 'active', 'past_due', 'trial'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${filter === f ? 'bg-[#13283b] text-white' : 'text-slate-400 hover:text-[#13283b] hover:bg-slate-50'
                                    }`}
                            >
                                {f === 'all' ? 'Ver Todos' : f === 'past_due' ? 'Atrasados' : f}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="overflow-x-auto text-slate-400">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white">
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Cliente / Info</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Plano & Valor</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-center">Status / Meio</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Saúde (CS)</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 bg-white">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-8 py-20 text-center">
                                        <div className="flex flex-col items-center gap-4 text-slate-300">
                                            <RefreshCw className="w-8 h-8 animate-spin" />
                                            <p className="font-bold uppercase tracking-widest text-[10px]">Buscando base de assinantes...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredSubscribers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-8 py-20 text-center text-slate-300 italic font-bold uppercase tracking-widest text-[10px]">
                                        Nenhum registro encontrado.
                                    </td>
                                </tr>
                            ) : filteredSubscribers.map((sub) => {
                                const subscription = sub.saas_subscriptions?.[0] || {}

                                // Melhoria na lógica de status: respeita o DB e verifica expiração
                                const dbStatus = subscription.status
                                const isExpired = subscription.current_period_end && new Date(subscription.current_period_end) < new Date()

                                let status = 'suspended'
                                if (!sub.is_suspended) {
                                    if (dbStatus === 'canceled' && !isExpired) status = 'canceled_active'
                                    else if (dbStatus === 'canceled' && isExpired) status = 'canceled'
                                    else if (dbStatus === 'past_due') status = 'past_due'
                                    else if (dbStatus === 'trialing') status = 'trial'
                                    else if (isExpired && dbStatus !== 'active') status = 'canceled'
                                    else if (dbStatus === 'active') status = 'active'
                                    else status = 'active'
                                }

                                if (!subscription.id) status = 'suspended'
                                // Mock health score for demo
                                const score = sub.is_suspended ? 10 : status === 'active' ? 85 : 30

                                return (
                                    <tr key={sub.id} className="hover:bg-slate-50/50 transition-all group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-[#13283b] text-base group-hover:scale-110 transition-all border border-slate-100">
                                                    {sub.full_name?.charAt(0) || 'U'}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-[#13283b] tracking-tight">
                                                        {sub.full_name || sub.email?.split('@')[0] || 'Usuário Sem Nome'}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-medium">{sub.email}</span>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-[8px] font-bold uppercase py-0.5 px-1.5 bg-slate-100 text-slate-500 rounded">Desde {new Date(sub.created_at).toLocaleDateString()}</span>
                                                        <span className="text-[8px] font-bold uppercase py-0.5 px-1.5 bg-blue-50 text-blue-500 rounded">{subscription.origin || 'site'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-black text-[#13283b] uppercase tracking-wider">
                                                    {subscription.plan_type || subscription.billing_cycle || 'Mensal'}
                                                </span>
                                                <span className="text-[10px] font-bold text-green-600">
                                                    R$ {((subscription.custom_amount_cents || subscription.amount_cents || 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </span>
                                                {(subscription.billing_cycle === 'annual' || subscription.billing_cycle === 'quarterly' || subscription.plan_type === 'anual' || subscription.plan_type === 'trimestral') && (
                                                    <span className="text-[8px] font-black text-slate-400 uppercase">
                                                        MRR: R$ {(((subscription.custom_amount_cents || subscription.amount_cents || 0) / (subscription.billing_cycle === 'annual' || subscription.plan_type === 'anual' ? 12 : 3)) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <StatusBadge status={status} />
                                                {status === 'canceled_active' && (
                                                    <span className="text-[8px] font-black text-indigo-400 uppercase">
                                                        Até {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}
                                                    </span>
                                                )}
                                                <span className="text-[9px] font-black text-slate-300 uppercase flex items-center gap-1">
                                                    <CardIcon size={10} /> {subscription.payment_method || 'Cartão'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <HealthScore subscriber={sub} />
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-4 group-hover:translate-x-0">
                                                {/* Detalhes / Dashboard */}
                                                <button
                                                    onClick={() => { setSelectedSub(sub); setIsDetailsModalOpen(true); }}
                                                    className="w-9 h-9 bg-slate-100 text-[#13283b] rounded-xl flex items-center justify-center hover:bg-[#13283b] hover:text-white transition-all border border-slate-200 shadow-sm"
                                                    title="Ver Detalhes"
                                                >
                                                    <Eye size={16} />
                                                </button>

                                                {/* Editar Cadastro */}
                                                <button
                                                    onClick={() => handleEditClick(sub)}
                                                    className="w-9 h-9 bg-slate-100 text-[#13283b] rounded-xl flex items-center justify-center hover:bg-[#13283b] hover:text-white transition-all border border-slate-200 shadow-sm"
                                                    title="Editar Cadastro"
                                                >
                                                    <Pencil size={16} />
                                                </button>

                                                {/* Ajustar Plano */}
                                                <button
                                                    onClick={() => { setSelectedSub(sub); setIsPlanModalOpen(true); }}
                                                    className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all border border-blue-100 shadow-sm"
                                                    title="Ajustar Plano"
                                                >
                                                    <DollarSign size={16} />
                                                </button>

                                                {/* Ver Financeiro */}
                                                <button
                                                    onClick={() => handleViewFinance(sub)}
                                                    className="w-9 h-9 bg-slate-100 text-[#13283b] rounded-xl flex items-center justify-center hover:bg-[#13283b] hover:text-white transition-all border border-slate-200 shadow-sm"
                                                    title="Ver Financeiro"
                                                >
                                                    <HistoryIcon size={16} />
                                                </button>

                                                {/* Enviar Cobrança */}
                                                <button
                                                    onClick={() => handleSendBilling(sub)}
                                                    className="w-9 h-9 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all border border-indigo-100 shadow-sm"
                                                    title="Enviar Cobrança"
                                                >
                                                    <Mail size={16} />
                                                </button>

                                                {/* Suspender / Ativar */}
                                                <button
                                                    onClick={() => handleToggleSuspension(sub.id, sub.is_suspended)}
                                                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all border shadow-sm ${sub.is_suspended ? 'bg-green-50 text-green-600 border-green-100 hover:bg-green-600 hover:text-white' : 'bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-600 hover:text-white'}`}
                                                    title={sub.is_suspended ? "Reativar Cliente" : "Suspender Acesso"}
                                                >
                                                    {sub.is_suspended ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
                                                </button>

                                                {/* Cancelar Assinatura */}
                                                <button
                                                    onClick={() => { setSelectedSub(sub); setIsCancelModalOpen(true); }}
                                                    className="w-9 h-9 bg-red-50 text-red-500 rounded-xl flex items-center justify-center hover:bg-red-600 hover:text-white transition-all border border-red-100 shadow-sm"
                                                    title="Cancelar Assinatura"
                                                >
                                                    <AlertTriangle size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modais de Ação & Gestão */}

            {/* 0. Modal de Cadastro Manual */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-[#13283b]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-xl p-10 shadow-2xl animate-in fade-in zoom-in duration-300 max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-8 flex-shrink-0">
                            <h3 className="text-xl font-black text-[#13283b] uppercase tracking-tighter">Novo Assinante Manual</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-300 hover:text-red-500">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleManualRegister} className="space-y-8 overflow-y-auto pr-4 custom-scrollbar">
                            {/* 1. Identificação */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary border-b border-slate-50 pb-2">Identificação & Acesso</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome Completo</label>
                                        <input
                                            required
                                            type="text"
                                            className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] focus:bg-white focus:border-slate-100 outline-none transition-all"
                                            placeholder="Ex: João Silva"
                                            value={newSub?.full_name || ''}
                                            onChange={e => setNewSub({ ...newSub, full_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Email</label>
                                        <input
                                            required
                                            type="email"
                                            className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] focus:bg-white focus:border-slate-100 outline-none transition-all"
                                            placeholder="email@empresa.com"
                                            value={newSub?.email || ''}
                                            onChange={e => setNewSub({ ...newSub, email: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 2. Controle Administrativo */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary border-b border-slate-50 pb-2">Controle Administrativo</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Tipo de Conta</label>
                                        <select
                                            className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] outline-none transition-all"
                                            value={newSub?.account_type || 'common'}
                                            onChange={e => setNewSub({ ...newSub, account_type: e.target.value })}
                                        >
                                            <option value="common">Usuário Comum</option>
                                            <option value="premium">Usuário Premium</option>
                                            <option value="partner">Parceiro</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Status Inicial</label>
                                        <select
                                            className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] outline-none transition-all"
                                            value={newSub?.initial_status || 'active'}
                                            onChange={e => setNewSub({ ...newSub, initial_status: e.target.value })}
                                        >
                                            <option value="active">Ativo</option>
                                            <option value="trial">Trial (Teste)</option>
                                            <option value="suspended">Suspenso</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Financeiro */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary border-b border-slate-50 pb-2">Financeiro & Plano</h4>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Plano Base</label>
                                        <select
                                            className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] outline-none transition-all"
                                            value={newSub?.plan_type || 'mensal'}
                                            onChange={e => setNewSub({ ...newSub, plan_type: e.target.value })}
                                        >
                                            <option value="mensal">Mensal</option>
                                            <option value="trimestral">Trimestral</option>
                                            <option value="anual">Anual</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Ciclo Pagto</label>
                                        <select
                                            className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] outline-none transition-all"
                                            value={newSub?.billing_cycle || 'monthly'}
                                            onChange={e => setNewSub({ ...newSub, billing_cycle: e.target.value })}
                                        >
                                            <option value="monthly">Mensal</option>
                                            <option value="quarterly">Trimestral</option>
                                            <option value="annual">Anual</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Valor (Cents)</label>
                                        <input
                                            type="number"
                                            className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] focus:bg-white focus:border-slate-100 outline-none transition-all"
                                            placeholder="9990"
                                            value={newSub?.custom_amount_cents || 9990}
                                            onChange={e => setNewSub({ ...newSub, custom_amount_cents: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 4. Dados Legais */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary border-b border-slate-50 pb-2">Dados Legais</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Tipo</label>
                                        <select
                                            className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] outline-none transition-all"
                                            value={newSub?.person_type || 'PF'}
                                            onChange={e => setNewSub({ ...newSub, person_type: e.target.value })}
                                        >
                                            <option value="PF">Pessoa Física</option>
                                            <option value="PJ">Pessoa Jurídica</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 group-focus-within:text-secondary">CPF / CNPJ</label>
                                        <input
                                            required
                                            type="text"
                                            className={`w-full px-6 py-4 bg-slate-50 border ${newSub.tax_id && !(newSub.person_type === 'PF' ? validateCPF(newSub.tax_id) : validateCNPJ(newSub.tax_id)) ? 'border-red-500 bg-red-50' : 'border-transparent'} rounded-2xl text-sm font-bold text-[#13283b] focus:bg-white focus:border-slate-100 outline-none transition-all`}
                                            placeholder="000.000.000-00"
                                            value={newSub?.tax_id || ''}
                                            onChange={e => setNewSub({ ...newSub, tax_id: e.target.value })}
                                        />
                                        {newSub.tax_id && !(newSub.person_type === 'PF' ? validateCPF(newSub.tax_id) : validateCNPJ(newSub.tax_id)) && (
                                            <p className="text-[9px] text-red-500 font-bold ml-2">Documento Inválido</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 5. Contato & Localização */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary border-b border-slate-50 pb-2">Contato & Localização</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">WhatsApp</label>
                                        <input
                                            type="text"
                                            className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] focus:bg-white focus:border-slate-100 outline-none transition-all"
                                            placeholder="(00) 00000-0000"
                                            value={newSub?.whatsapp || ''}
                                            onChange={e => setNewSub({ ...newSub, whatsapp: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome Empresa</label>
                                        <input
                                            type="text"
                                            className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] focus:bg-white focus:border-slate-100 outline-none transition-all"
                                            placeholder="Opcional"
                                            value={newSub?.company_name || ''}
                                            onChange={e => setNewSub({ ...newSub, company_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 group-focus-within:text-secondary">Estado (UF)</label>
                                        <select
                                            className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] outline-none transition-all"
                                            value={newSub?.state || ''}
                                            onChange={e => setNewSub({ ...newSub, state: e.target.value })}
                                        >
                                            <option value="">Selecione</option>
                                            {BRAZILIAN_STATES.map(state => (
                                                <option key={state.uf} value={state.uf}>{state.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 group-focus-within:text-secondary">Cidade</label>
                                        <select
                                            disabled={!newSub.state || loadingCities}
                                            className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] outline-none transition-all disabled:opacity-50"
                                            value={newSub?.city || ''}
                                            onChange={e => setNewSub({ ...newSub, city: e.target.value })}
                                        >
                                            <option value="">{loadingCities ? 'Carregando...' : 'Selecione'}</option>
                                            {cities.map(city => (
                                                <option key={city} value={city}>{city}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* 6. Segurança Inicial */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-secondary border-b border-slate-50 pb-2">Segurança Inicial</h4>
                                <div className="space-y-4 rounded-2xl bg-indigo-50 p-6 border border-indigo-100">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-indigo-400 ml-2">Senha Temporária</label>
                                        <input
                                            type="text"
                                            className="w-full px-6 py-4 bg-white border border-transparent rounded-2xl text-sm font-bold text-[#13283b] focus:border-indigo-200 outline-none transition-all placeholder:text-slate-300"
                                            placeholder="Deixe vazio para gerar automática"
                                            value={newSub?.temp_password || ''}
                                            onChange={e => setNewSub({ ...newSub, temp_password: e.target.value })}
                                        />
                                        <p className="text-[10px] text-indigo-400 px-2 font-medium">Se vazio, o sistema vai gerar uma senha aleatória segura (Ex: Xy9#mP2z)</p>
                                    </div>

                                    <div className="flex items-center gap-3 px-2">
                                        <input
                                            type="checkbox"
                                            id="send_invite"
                                            checked={newSub.send_invite}
                                            onChange={e => setNewSub({ ...newSub, send_invite: e.target.checked })}
                                            className="w-5 h-5 accent-indigo-600 rounded-lg cursor-pointer"
                                        />
                                        <label htmlFor="send_invite" className="text-xs font-bold text-[#13283b] cursor-pointer selection:bg-none">
                                            Enviar email de convite com dados de acesso
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex-shrink-0">
                                <button type="submit" disabled={loading} className="w-full bg-[#13283b] text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
                                    {loading ? 'Processando Cadastro...' : 'Confirmar Cadastro Manual'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Editar Perfil */}
            {isEditModalOpen && editSub && (
                <div className="fixed inset-0 bg-[#13283b]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-xl p-10 shadow-2xl animate-in fade-in zoom-in duration-300 max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center mb-8 flex-shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-[#13283b] uppercase tracking-tighter">Editar Perfil</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ajustando dados de {editSub.full_name}</p>
                            </div>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-slate-300 hover:text-red-500">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleUpdateProfile} className="space-y-6 overflow-y-auto pr-4 custom-scrollbar">
                            {/* Categoria: Identificação */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#13283b] border-b border-slate-50 pb-2">Identificação Principal</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Nome Completo</label>
                                        <input
                                            required
                                            type="text"
                                            className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] focus:bg-white focus:border-slate-100 outline-none transition-all"
                                            value={editSub.full_name}
                                            onChange={e => setEditSub({ ...editSub, full_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">E-mail (Não editável)</label>
                                        <input
                                            disabled
                                            type="email"
                                            className="w-full px-6 py-4 bg-slate-100 border border-transparent rounded-2xl text-sm font-bold text-slate-400 opacity-70"
                                            value={editSub.email}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Categoria: Dados Legais */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#13283b] border-b border-slate-50 pb-2">Dados Legais</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Tipo de Pessoa</label>
                                        <select
                                            className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] outline-none transition-all"
                                            value={editSub.person_type}
                                            onChange={e => setEditSub({ ...editSub, person_type: e.target.value })}
                                        >
                                            <option value="PF">Pessoa Física</option>
                                            <option value="PJ">Pessoa Jurídica</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">CPF / CNPJ</label>
                                        <input
                                            type="text"
                                            className={`w-full px-6 py-4 bg-slate-50 border ${editSub.tax_id && !(editSub.person_type === 'PF' ? validateCPF(editSub.tax_id) : validateCNPJ(editSub.tax_id)) ? 'border-red-500 bg-red-50' : 'border-transparent'} rounded-2xl text-sm font-bold text-[#13283b] focus:bg-white focus:border-slate-100 outline-none transition-all`}
                                            value={editSub.tax_id}
                                            onChange={e => setEditSub({ ...editSub, tax_id: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Categoria: Contato & Endereço */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#13283b] border-b border-slate-50 pb-2">Contato & Localização</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">WhatsApp</label>
                                        <input
                                            type="text"
                                            className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] focus:bg-white focus:border-slate-100 outline-none transition-all"
                                            value={editSub.whatsapp}
                                            onChange={e => setEditSub({ ...editSub, whatsapp: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Empresa</label>
                                        <input
                                            type="text"
                                            className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] focus:bg-white focus:border-slate-100 outline-none transition-all"
                                            value={editSub.company_name}
                                            onChange={e => setEditSub({ ...editSub, company_name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">UF</label>
                                        <select
                                            className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] outline-none transition-all"
                                            value={editSub.state}
                                            onChange={e => setEditSub({ ...editSub, state: e.target.value })}
                                        >
                                            <option value="">Selecione</option>
                                            {BRAZILIAN_STATES.map(state => (
                                                <option key={state.uf} value={state.uf}>{state.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Cidade</label>
                                        <select
                                            disabled={!editSub.state || loadingCities}
                                            className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] outline-none transition-all disabled:opacity-50"
                                            value={editSub.city}
                                            onChange={e => setEditSub({ ...editSub, city: e.target.value })}
                                        >
                                            <option value="">{loadingCities ? 'Carregando...' : 'Selecione'}</option>
                                            {cities.map(city => (
                                                <option key={city} value={city}>{city}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex-shrink-0">
                                <button type="submit" disabled={loading} className="w-full bg-[#13283b] text-white py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50">
                                    {loading ? 'Salvando...' : 'Salvar Alterações'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 1. Modal de Detalhes (Visualização 360) */}
            {isDetailsModalOpen && selectedSub && (
                <div className="fixed inset-0 bg-[#13283b]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl p-10 shadow-2xl animate-in fade-in zoom-in duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-black text-[#13283b] uppercase tracking-tighter">Detalhes do Assinante</h3>
                            <button onClick={() => setIsDetailsModalOpen(false)} className="text-slate-300 hover:text-red-500">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="space-y-8 overflow-y-auto pr-2 custom-scrollbar max-h-[70vh]">

                            {/* 1. Visão Geral */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#13283b] border-b border-slate-100 pb-2">Perfil & Acesso</h4>
                                    <div className="bg-slate-50 p-6 rounded-2xl space-y-3">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-slate-400">Nome</p>
                                            <p className="text-sm font-bold text-[#13283b]">{selectedSub.full_name}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-slate-400">Email</p>
                                            <p className="text-xs font-medium text-slate-600">{selectedSub.email}</p>
                                        </div>
                                        <div className="flex gap-4 pt-2">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Tipo de Conta</p>
                                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${selectedSub.account_type === 'partner' ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                                    selectedSub.account_type === 'premium' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                                                        'bg-slate-100 text-slate-500 border-slate-200'
                                                    }`}>
                                                    {selectedSub.account_type === 'partner' ? 'Parceiro' : selectedSub.account_type === 'premium' ? 'Premium' : 'Comum'}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Status</p>
                                                <StatusBadge status={selectedSub.saas_subscriptions?.[0]?.status} is_suspended={selectedSub.is_suspended} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#13283b] border-b border-slate-100 pb-2">Plano & Financeiro</h4>
                                    <div className="bg-slate-50 p-6 rounded-2xl space-y-3">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-widest text-slate-400">Plano</p>
                                                <p className="text-sm font-bold text-[#13283b] capitalize">{selectedSub.saas_subscriptions?.[0]?.plan_type || 'Mensal'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-widest text-slate-400">Ciclo</p>
                                                <p className="text-sm font-bold text-[#13283b] capitalize">
                                                    {selectedSub.saas_subscriptions?.[0]?.billing_cycle === 'annual' ? 'Anual' :
                                                        selectedSub.saas_subscriptions?.[0]?.billing_cycle === 'quarterly' ? 'Trimestral' : 'Mensal'}
                                                </p>
                                            </div>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-slate-400">Valor Recorrente</p>
                                            <p className="text-lg font-black text-secondary">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                                                    (selectedSub.saas_subscriptions?.[0]?.custom_amount_cents || selectedSub.saas_subscriptions?.[0]?.amount_cents || 9990) / 100
                                                )}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-slate-400">Próxima Cobrança</p>
                                            <p className="text-xs font-medium text-slate-600">
                                                {selectedSub.saas_subscriptions?.[0]?.current_period_end
                                                    ? new Date(selectedSub.saas_subscriptions?.[0]?.current_period_end).toLocaleDateString('pt-BR')
                                                    : 'Não definido'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Dados Detalhados */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#13283b] border-b border-slate-100 pb-2">Dados Legais</h4>
                                    <div className="space-y-3 px-2">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-widest text-slate-400">Tipo Pessoa</p>
                                                <p className="text-sm font-bold text-[#13283b]">{selectedSub.person_type === 'PJ' ? 'Jurídica' : 'Física'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-widest text-slate-400">Documento</p>
                                                <p className="text-sm font-bold text-[#13283b] font-mono">{selectedSub.tax_id || '-'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-black uppercase tracking-widest text-[#13283b] border-b border-slate-100 pb-2">Contato & Local</h4>
                                    <div className="space-y-3 px-2">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-widest text-slate-400">WhatsApp</p>
                                            <p className="text-sm font-bold text-[#13283b]">{selectedSub.whatsapp || '-'}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-widest text-slate-400">Cidade/UF</p>
                                                <p className="text-sm font-bold text-[#13283b]">{selectedSub.city ? `${selectedSub.city}/${selectedSub.state}` : '-'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-widest text-slate-400">Empresa</p>
                                                <p className="text-sm font-bold text-[#13283b]">{selectedSub.company_name || '-'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3. Metadados de Marketing */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#13283b] border-b border-slate-100 pb-2">Inteligência & Origem</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-6 rounded-2xl">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-slate-400">Origem</p>
                                        <p className="text-xs font-bold text-[#13283b] capitalize">{selectedSub.referral_source || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-slate-400">Objetivo</p>
                                        <p className="text-xs font-bold text-[#13283b] capitalize">{selectedSub.main_objective || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-slate-400">Tamanho Op.</p>
                                        <p className="text-xs font-bold text-[#13283b]">{selectedSub.company_size || '-'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-slate-400">Termos</p>
                                        <p className="text-xs font-bold text-[#13283b]">{selectedSub.terms_accepted ? 'Aceito ✅' : 'Pendente ❌'}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 px-2">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-slate-400">Cadastrado em</p>
                                        <p className="text-xs font-bold text-slate-600">{new Date(selectedSub.created_at).toLocaleDateString('pt-BR')} às {new Date(selectedSub.created_at).toLocaleTimeString('pt-BR')}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest text-slate-400">Último Login</p>
                                        <p className="text-xs font-bold text-slate-600">
                                            {selectedSub.last_login_at
                                                ? `${new Date(selectedSub.last_login_at).toLocaleDateString('pt-BR')} às ${new Date(selectedSub.last_login_at).toLocaleTimeString('pt-BR')}`
                                                : 'Nunca acessou'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-100 flex justify-end">
                            <button onClick={() => setIsDetailsModalOpen(false)} className="bg-[#13283b] text-white px-8 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">
                                Fechar Detalhes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Modal de Ajustar Plano */}
            {isPlanModalOpen && selectedSub && (
                <div className="fixed inset-0 bg-[#13283b]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-in fade-in zoom-in duration-300">
                        <h3 className="text-xl font-black text-[#13283b] uppercase tracking-tighter mb-8">Ajustar Plano</h3>
                        <form onSubmit={handleUpdatePlan} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Novo Plano</label>
                                <select className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] outline-none transition-all">
                                    <option value="monthly">MENSAL (R$ 99,90)</option>
                                    <option value="quarterly">TRIMESTRAL (R$ 250,00)</option>
                                    <option value="annual">ANUAL (R$ 990,00)</option>
                                </select>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button type="button" onClick={() => setIsPlanModalOpen(false)} className="flex-1 px-6 py-4 rounded-2xl font-black uppercase text-[10px] text-slate-400 bg-slate-50">Cancelar</button>
                                <button type="submit" className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-black uppercase text-[10px] shadow-lg">Salvar Plano</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* 3. Modal de Confirmação de Cancelamento */}
            {isCancelModalOpen && selectedSub && (
                <div className="fixed inset-0 bg-red-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-in fade-in zoom-in duration-300 text-center">
                        <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle size={40} />
                        </div>
                        <h3 className="text-xl font-black text-[#13283b] uppercase tracking-tighter mb-4">Cancelar Assinatura?</h3>
                        <p className="text-slate-500 text-sm mb-8 leading-relaxed">
                            Você está prestes a cancelar permanentemente a assinatura de <span className="font-bold text-[#13283b]">{selectedSub.full_name}</span>. Esta ação não pode ser desfeita.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button onClick={handleCancelSubscription} className="w-full bg-red-500 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:bg-red-600 transition-all">
                                Sim, Cancelar Assinatura
                            </button>
                            <button onClick={() => setIsCancelModalOpen(false)} className="w-full py-4 text-[10px] font-black uppercase text-slate-400">
                                Manter Assinatura
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. Modal de Resumo Financeiro */}
            {isFinanceModalOpen && selectedSub && (
                <div className="fixed inset-0 bg-[#13283b]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-in fade-in zoom-in duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-black text-[#13283b] uppercase tracking-tighter">Resumo Financeiro</h3>
                            <button onClick={() => setIsFinanceModalOpen(false)} className="text-slate-300 hover:text-red-500">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 italic text-slate-500 text-xs">
                                Informações detalhadas do plano e faturamento de <span className="font-bold text-[#13283b]">{selectedSub.full_name}</span>.
                            </div>

                            <div className="bg-white border border-slate-100 rounded-2xl p-6 space-y-4 shadow-sm">
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase text-slate-400">Plano Atual</span>
                                    <span className="text-sm font-black text-[#13283b] uppercase">{selectedSub.saas_subscriptions?.[0]?.plan_type || 'Free'}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase text-slate-400">Valor Assinado</span>
                                    <span className="text-sm font-black text-green-600">R$ {(selectedSub.saas_subscriptions?.[0]?.amount_cents / 100 || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-black uppercase text-slate-400">Meio de Pagamento</span>
                                    <span className="text-sm font-bold text-slate-600 flex items-center gap-2">
                                        <CardIcon size={14} /> {selectedSub.saas_subscriptions?.[0]?.payment_method || 'Não definido'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center bg-blue-50/50 -mx-6 px-6 py-3 border-y border-blue-50">
                                    <span className="text-[10px] font-black uppercase text-blue-400">Expira / Renova em</span>
                                    <span className="text-sm font-black text-blue-600">
                                        {selectedSub.saas_subscriptions?.[0]?.current_period_end
                                            ? new Date(selectedSub.saas_subscriptions[0].current_period_end).toLocaleDateString('pt-BR')
                                            : 'Vigência indeterminada'}
                                    </span>
                                </div>
                            </div>

                            {/* Histórico de Pagamentos Real */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#13283b] flex items-center gap-2">
                                    <HistoryIcon size={14} /> Histórico de Faturas
                                </h4>
                                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                    {loadingBilling ? (
                                        <div className="py-8 text-center text-slate-400 text-[10px] font-bold uppercase animate-pulse">
                                            Carregando do Stripe...
                                        </div>
                                    ) : billingHistory.length > 0 ? (
                                        billingHistory.map((invoice, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white transition-all">
                                                <div>
                                                    <p className="text-[10px] font-black text-[#13283b]">
                                                        {new Date(invoice.date * 1000).toLocaleDateString('pt-BR')}
                                                    </p>
                                                    <p className="text-[9px] font-bold text-slate-400 uppercase">
                                                        {invoice.number || 'Fatura Stripe'}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs font-black text-[#13283b]">R$ {(invoice.amount_paid / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                                    <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${invoice.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {invoice.status === 'paid' ? 'Paga' : 'Pendente'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="py-8 text-center text-slate-300 text-[10px] font-bold uppercase italic">
                                            Nenhum histórico encontrado
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-8">
                            <button
                                onClick={() => setIsFinanceModalOpen(false)}
                                className="w-full bg-[#13283b] text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                            >
                                Fechar Resumo
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 5. Modal de Envio de Cobrança */}
            {isBillingModalOpen && selectedSub && (
                <div className="fixed inset-0 bg-[#13283b]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-in fade-in zoom-in duration-300">
                        <div className="flex justify-between items-center mb-8">
                            <h3 className="text-xl font-black text-[#13283b] uppercase tracking-tighter">Enviar Cobrança</h3>
                            <button onClick={() => setIsBillingModalOpen(false)} className="text-slate-300 hover:text-red-500">
                                <XCircle size={24} />
                            </button>
                        </div>

                        <p className="text-slate-500 text-sm mb-8">
                            Selecione por onde deseja enviar a cobrança para <span className="font-bold text-[#13283b]">{selectedSub.full_name}</span>:
                        </p>

                        <div className="grid grid-cols-1 gap-4">
                            <button
                                onClick={() => {
                                    const msg = encodeURIComponent(`Olá ${selectedSub.full_name}, notamos que sua fatura do Gestão Aluguel está disponível. Podemos ajudar com o pagamento?`);
                                    window.open(`https://wa.me/?text=${msg}`, '_blank');
                                    setIsBillingModalOpen(false);
                                }}
                                className="flex items-center gap-4 p-6 bg-green-50 rounded-[2rem] border border-green-100 hover:bg-green-600 group transition-all"
                            >
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-green-600 group-hover:scale-110 transition-all shadow-sm">
                                    <MessageSquare size={24} />
                                </div>
                                <div className="text-left">
                                    <p className="font-black text-green-600 group-hover:text-white uppercase text-[10px] tracking-widest">WhatsApp</p>
                                    <p className="text-green-800 text-sm font-bold group-hover:text-green-50">Enviar via Mensagem</p>
                                </div>
                            </button>

                            <button
                                onClick={() => {
                                    const subject = encodeURIComponent("Fatura Pendente - Gestão Aluguel");
                                    const body = encodeURIComponent(`Olá ${selectedSub.full_name},\n\nSua fatura está disponível para pagamento.\n\nEquipe Gestão Aluguel`);
                                    window.location.href = `mailto:${selectedSub.email}?subject=${subject}&body=${body}`;
                                    setIsBillingModalOpen(false);
                                }}
                                className="flex items-center gap-4 p-6 bg-blue-50 rounded-[2rem] border border-blue-100 hover:bg-blue-600 group transition-all"
                            >
                                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-all shadow-sm">
                                    <Mail size={24} />
                                </div>
                                <div className="text-left">
                                    <p className="font-black text-blue-600 group-hover:text-white uppercase text-[10px] tracking-widest">E-mail</p>
                                    <p className="text-blue-800 text-sm font-bold group-hover:text-blue-50">Enviar via Correio</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useDialog } from '../components/DialogProvider'
import {
    User,
    Building2,
    Clock,
    Bell,
    Save,
    Lock,
    MapPin,
    AlertCircle,
    CreditCard as CardIcon
} from 'lucide-react'
import SubscriptionManager from '../components/SubscriptionManager'



export default function Settings() {
    const { user, signOut } = useAuth()
    const { success, error: toastError, confirm } = useDialog()
    const [searchParams] = useSearchParams()
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile') // profile, company, rental, notifications, subscription

    // Form States
    const [profileData, setProfileData] = useState({
        full_name: '',
        phone: '', // Saved in profiles or tenant_settings? Let's verify. Usually profile has name/email.
        avatar_url: ''
    })

    const [companyData, setCompanyData] = useState({
        company_name: '',
        trading_name: '',
        cnpj_cpf: '',
        finance_email: '',
        responsible_name: '',
        address: {
            cep: '',
            street: '',
            number: '',
            complement: '',
            neighborhood: '',
            city: '',
            state: ''
        },
        primary_color: '#13283b',
        secondary_color: '#f8fafc',
        display_name: ''
    })

    const [rentalData, setRentalData] = useState({
        default_pickup_time: '09:00',
        default_return_time: '18:00',
        late_fee_fixed: 0,
        late_fee_daily_percent: 0,
        security_deposit_enabled: false,
        security_deposit_default: 0,
        block_late_items: false
    })


    const [notificationData, setNotificationData] = useState({
        email_new_rental: true,
        email_payment: true,
        whatsapp_overdue: false
    })

    // Password Change State
    const [passwordData, setPasswordData] = useState({
        current: '',
        new: '',
        confirm: ''
    })


    useEffect(() => {
        if (user) loadSettings()
    }, [user])

    useEffect(() => {
        const tab = searchParams.get('tab')
        if (tab) setActiveTab(tab)
    }, [searchParams])

    const loadSettings = async () => {
        try {
            setLoading(true)

            // 1. Load Profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, avatar_url') // Phone might be in tenant_settings or profile. Let's put phone in tenant_settings for now or just profile? Profile usually.
                .eq('id', user.id)
                .single()

            if (profile) {
                setProfileData(prev => ({ ...prev, ...profile }))
            }

            // 2. Load Tenant Settings
            const { data: settings } = await supabase
                .from('tenant_settings')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle()

            if (settings) {
                setCompanyData({
                    company_name: settings.company_name || '',
                    trading_name: settings.trading_name || '',
                    cnpj_cpf: settings.cnpj_cpf || '',
                    finance_email: settings.finance_email || '',
                    responsible_name: settings.responsible_name || '',
                    address: settings.address || {},
                    primary_color: settings.primary_color || '#13283b',
                    secondary_color: settings.secondary_color || '#f8fafc',
                    display_name: settings.display_name || ''
                })

                setRentalData({
                    default_pickup_time: settings.default_pickup_time || '09:00',
                    default_return_time: settings.default_return_time || '18:00',
                    late_fee_fixed: settings.late_fee_fixed || 0,
                    late_fee_daily_percent: settings.late_fee_daily_percent || 0,
                    security_deposit_enabled: settings.security_deposit_enabled || false,
                    security_deposit_default: settings.security_deposit_default || 0,
                    block_late_items: settings.block_late_items || false
                })

                if (settings.notification_preferences) {
                    setNotificationData(prev => ({ ...prev, ...settings.notification_preferences }))
                }
            }



        } catch (err) {
            console.error('Error loading settings:', err)
            toastError('Erro ao carregar configurações.')
        } finally {
            setLoading(false)
        }
    }

    const handleSaveProfile = async (e) => {
        e.preventDefault()
        try {
            setLoading(true)
            // Update auth.users metadata if needed? No, just profiles table.
            const { error } = await supabase
                .from('profiles')
                .update({ full_name: profileData.full_name })
                .eq('id', user.id)

            if (error) throw error
            success('Perfil atualizado!')
        } catch (err) {
            toastError('Erro ao salvar perfil')
        } finally {
            setLoading(false)
        }
    }

    const handleChangePassword = async (e) => {
        e.preventDefault()
        if (passwordData.new !== passwordData.confirm) return toastError('As senhas não conferem')

        try {
            setLoading(true)
            const { error } = await supabase.auth.updateUser({ password: passwordData.new })
            if (error) throw error
            success('Senha alterada com sucesso!')
            setPasswordData({ current: '', new: '', confirm: '' })
        } catch (err) {
            toastError('Erro ao alterar senha: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const handleSaveCompany = async (e) => {
        e.preventDefault()
        try {
            setLoading(true)
            const { error } = await supabase
                .from('tenant_settings')
                .upsert({
                    user_id: user.id,
                    company_name: companyData.company_name,
                    trading_name: companyData.trading_name,
                    cnpj_cpf: companyData.cnpj_cpf,
                    finance_email: companyData.finance_email,
                    responsible_name: companyData.responsible_name,
                    address: companyData.address,
                    primary_color: companyData.primary_color,
                    secondary_color: companyData.secondary_color,
                    display_name: companyData.display_name
                })

            if (error) throw error
            success('Dados da empresa salvos!')
        } catch (err) {
            console.error(err)
            toastError('Erro ao salvar dados da empresa')
        } finally {
            setLoading(false)
        }
    }

    const handleSaveRental = async (e) => {
        e.preventDefault()
        try {
            setLoading(true)
            const { error } = await supabase
                .from('tenant_settings')
                .upsert({
                    user_id: user.id,
                    ...rentalData
                })

            if (error) throw error
            success('Regras de locação atualizadas!')
        } catch (err) {
            toastError('Erro ao salvar regras')
        } finally {
            setLoading(false)
        }
    }

    const handleSaveNotifications = async () => {
        try {
            setLoading(true)
            const { error } = await supabase
                .from('tenant_settings')
                .upsert({
                    user_id: user.id,
                    notification_preferences: notificationData
                })

            if (error) throw error
            success('Preferências salvas!')
        } catch (err) {
            toastError('Erro ao salvar preferências')
        } finally {
            setLoading(false)
        }
    }



    const handleCEPLookup = async (cep) => {
        const cleanCEP = cep.replace(/\D/g, '')
        if (cleanCEP.length !== 8) return

        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`)
            const data = await response.json()
            if (!data.erro) {
                setCompanyData(prev => ({
                    ...prev,
                    address: {
                        ...prev.address,
                        street: data.logradouro,
                        neighborhood: data.bairro,
                        city: data.localidade,
                        state: data.uf,
                        cep: cep
                    }
                }))
            }
        } catch (err) {
            console.error('CEP Error', err)
        }
    }

    return (
        <div className="max-w-5xl mx-auto pb-20 md:pb-6 space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-[#13283b] uppercase tracking-tighter">Configurações</h1>
                    <p className="text-slate-400 font-medium tracking-wide text-sm">Gerencie sua conta e regras do sistema.</p>
                </div>
            </header>

            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar Navigation */}
                <aside className="w-full md:w-64 flex-shrink-0 space-y-2">
                    <nav className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden p-2">
                        {[
                            { id: 'profile', label: 'Meu Perfil', icon: User },
                            { id: 'company', label: 'Dados da Empresa', icon: Building2 },
                            { id: 'rental', label: 'Regras de Locação', icon: Clock },
                            { id: 'notifications', label: 'Notificações', icon: Bell },
                            { id: 'subscription', label: 'Assinatura e Planos', icon: CardIcon },
                        ].map(item => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === item.id
                                    ? 'bg-[#13283b] text-white shadow-lg shadow-slate-200'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-[#13283b]'
                                    }`}
                            >
                                <item.icon size={18} />
                                {item.label}
                            </button>
                        ))}
                    </nav>

                </aside>

                {/* Content Area */}
                <main className="flex-1 bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/30 p-6 md:p-8 min-h-[500px]">

                    {/* Tab: PROFILE */}
                    {activeTab === 'profile' && (
                        <div className="space-y-8 animate-fadeIn">
                            <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-2xl font-black text-slate-300">
                                    {profileData.full_name?.charAt(0) || <User />}
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-[#13283b]">Seu Perfil</h2>
                                    <p className="text-slate-400 text-sm font-medium">Informações pessoais e segurança.</p>
                                </div>
                            </div>

                            <form onSubmit={handleSaveProfile} className="space-y-6 max-w-lg">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Nome Completo</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-[#13283b] outline-none focus:border-[#13283b] transition-colors"
                                        value={profileData.full_name}
                                        onChange={e => setProfileData({ ...profileData, full_name: e.target.value })}
                                    />
                                </div>
                                <div className="opacity-60 cursor-not-allowed">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Email (Não editável)</label>
                                    <input
                                        type="email"
                                        disabled
                                        className="w-full bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-500 outline-none"
                                        value={user?.email}
                                    />
                                </div>
                                <button type="submit" disabled={loading} className="px-6 py-3 bg-[#13283b] text-white rounded-xl font-bold text-sm hover:shadow-lg transition-all flex items-center gap-2">
                                    <Save size={18} /> Salvar Alterações
                                </button>
                            </form>

                            <div className="border-t border-slate-100 pt-8">
                                <h3 className="text-lg font-black text-[#13283b] mb-4 flex items-center gap-2">
                                    <Lock size={20} className="text-amber-500" /> Segurança
                                </h3>
                                <form onSubmit={handleChangePassword} className="space-y-4 max-w-lg bg-amber-50/50 p-6 rounded-2xl border border-amber-100">
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-amber-800/60 mb-1 block">Nova Senha</label>
                                        <input
                                            type="password"
                                            placeholder="Mínimo 6 caracteres"
                                            className="w-full bg-white border border-amber-200 rounded-xl px-4 py-3 text-sm font-bold text-amber-900 outline-none focus:border-amber-500 transition-colors"
                                            value={passwordData.new}
                                            onChange={e => setPasswordData({ ...passwordData, new: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-amber-800/60 mb-1 block">Confirmar Senha</label>
                                        <input
                                            type="password"
                                            placeholder="Repita a nova senha"
                                            className="w-full bg-white border border-amber-200 rounded-xl px-4 py-3 text-sm font-bold text-amber-900 outline-none focus:border-amber-500 transition-colors"
                                            value={passwordData.confirm}
                                            onChange={e => setPasswordData({ ...passwordData, confirm: e.target.value })}
                                        />
                                    </div>
                                    <button type="submit" disabled={loading} className="w-full px-6 py-3 bg-amber-500 text-white rounded-xl font-bold text-sm hover:bg-amber-600 transition-all shadow-md shadow-amber-200">
                                        Atualizar Senha
                                    </button>
                                </form>
                            </div>

                            <div className="border-t border-red-100 pt-8 mt-12">
                                <h3 className="text-lg font-black text-red-600 mb-4 flex items-center gap-2">
                                    <AlertCircle size={20} /> Zona de Perigo
                                </h3>
                                <div className="bg-red-50 p-6 rounded-2xl border border-red-100 flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-red-900">Excluir minha conta</h4>
                                        <p className="text-sm text-red-700/70">Essa ação é irreversível e apagará todos os seus dados.</p>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            const isConfirmed = await confirm({
                                                title: 'Tem certeza absoluta?',
                                                message: 'Todos os seus imóveis, inquilinos, contratos e pagamentos serão apagados permanentemente. Não há como desfazer.',
                                                confirmText: 'Sim, excluir tudo',
                                                cancelText: 'Cancelar',
                                                type: 'danger'
                                            })

                                            if (isConfirmed) {
                                                try {
                                                    setLoading(true)
                                                    const { error } = await supabase.functions.invoke('delete-account')
                                                    if (error) throw error

                                                    await signOut()
                                                    window.location.href = '/'
                                                } catch (err) {
                                                    console.error(err)
                                                    toastError('Erro ao excluir conta: ' + err.message)
                                                } finally {
                                                    setLoading(false)
                                                }
                                            }
                                        }}
                                        className="px-6 py-3 bg-white border-2 border-red-100 text-red-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-600 hover:text-white hover:border-red-600 transition-all"
                                    >
                                        Excluir Conta
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab: COMPANY */}
                    {activeTab === 'company' && (
                        <div className="space-y-8 animate-fadeIn">
                            <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
                                <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-500">
                                    <Building2 size={32} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-[#13283b]">Dados da Empresa</h2>
                                    <p className="text-slate-400 text-sm font-medium">Informações legais para contratos e notas.</p>
                                </div>
                            </div>

                            <form onSubmit={handleSaveCompany} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Razão Social</label>
                                    <input
                                        type="text"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-[#13283b] outline-none focus:border-[#13283b] transition-all"
                                        value={companyData.company_name}
                                        onChange={e => setCompanyData({ ...companyData, company_name: e.target.value })}
                                        placeholder="Ex: Minha Locadora LTDA"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Nome Fantasia (Exibição)</label>
                                    <input
                                        type="text"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-[#13283b] outline-none focus:border-[#13283b] transition-all"
                                        value={companyData.display_name}
                                        onChange={e => setCompanyData({ ...companyData, display_name: e.target.value })}
                                        placeholder="Ex: AlugaTudo"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">CNPJ / CPF</label>
                                    <input
                                        type="text"
                                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-[#13283b] outline-none focus:border-[#13283b] transition-all"
                                        value={companyData.cnpj_cpf}
                                        onChange={e => setCompanyData({ ...companyData, cnpj_cpf: e.target.value })}
                                        placeholder="00.000.000/0001-00"
                                    />
                                </div>

                                <div className="md:col-span-2 border-t border-slate-100 pt-4 mt-2">
                                    <h4 className="text-sm font-black text-[#13283b] flex items-center gap-2 mb-4">
                                        <MapPin size={16} className="text-blue-500" /> Endereço Comercial
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">CEP</label>
                                            <input
                                                type="text"
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-[#13283b] outline-none focus:border-[#13283b] transition-all"
                                                value={companyData.address.cep}
                                                onChange={e => {
                                                    const val = e.target.value
                                                    setCompanyData(prev => ({ ...prev, address: { ...prev.address, cep: val } }))
                                                    if (val.replace(/\D/g, '').length === 8) handleCEPLookup(val)
                                                }}
                                                placeholder="00000-000"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Rua / Logradouro</label>
                                            <input
                                                type="text"
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-[#13283b] outline-none focus:border-[#13283b] transition-all"
                                                value={companyData.address.street}
                                                onChange={e => setCompanyData(prev => ({ ...prev, address: { ...prev.address, street: e.target.value } }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Número</label>
                                            <input
                                                type="text"
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-[#13283b] outline-none focus:border-[#13283b] transition-all"
                                                value={companyData.address.number}
                                                onChange={e => setCompanyData(prev => ({ ...prev, address: { ...prev.address, number: e.target.value } }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Bairro</label>
                                            <input
                                                type="text"
                                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-[#13283b] outline-none focus:border-[#13283b] transition-all"
                                                value={companyData.address.neighborhood}
                                                onChange={e => setCompanyData(prev => ({ ...prev, address: { ...prev.address, neighborhood: e.target.value } }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Cidade - UF</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-[#13283b] outline-none focus:border-[#13283b] transition-all flex-1"
                                                    value={companyData.address.city}
                                                    onChange={e => setCompanyData(prev => ({ ...prev, address: { ...prev.address, city: e.target.value } }))}
                                                />
                                                <input
                                                    type="text"
                                                    className="w-16 bg-white border border-slate-200 rounded-xl px-0 text-center text-sm font-bold text-[#13283b] outline-none focus:border-[#13283b] transition-all"
                                                    value={companyData.address.state}
                                                    onChange={e => setCompanyData(prev => ({ ...prev, address: { ...prev.address, state: e.target.value } }))}
                                                    maxLength={2}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="md:col-span-2 pt-4">
                                    <button type="submit" disabled={loading} className="w-full md:w-auto px-8 py-3 bg-[#13283b] text-white rounded-xl font-bold text-sm hover:shadow-lg transition-all flex items-center justify-center gap-2">
                                        <Save size={18} /> Salvar Dados da Empresa
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Tab: RENTAL RULES */}
                    {activeTab === 'rental' && (
                        <div className="space-y-8 animate-fadeIn">
                            <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
                                <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500">
                                    <Clock size={32} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-[#13283b]">Regras de Locação</h2>
                                    <p className="text-slate-400 text-sm font-medium">Defina horários, multas e garantias.</p>
                                </div>
                            </div>

                            <form onSubmit={handleSaveRental} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                                    <h4 className="font-black text-[#13283b] text-sm uppercase flex items-center gap-2">
                                        <Clock size={16} /> Horários Padrão
                                    </h4>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Retirada Padrão</label>
                                        <input
                                            type="time"
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-[#13283b] outline-none focus:border-[#13283b] transition-all"
                                            value={rentalData.default_pickup_time}
                                            onChange={e => setRentalData({ ...rentalData, default_pickup_time: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1 block">Devolução Padrão</label>
                                        <input
                                            type="time"
                                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-[#13283b] outline-none focus:border-[#13283b] transition-all"
                                            value={rentalData.default_return_time}
                                            onChange={e => setRentalData({ ...rentalData, default_return_time: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="bg-red-50 p-6 rounded-2xl border border-red-100 space-y-4">
                                    <h4 className="font-black text-red-800 text-sm uppercase flex items-center gap-2">
                                        <CreditCard size={16} /> Multas e Juros
                                    </h4>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-red-800/70 mb-1 block">Multa Fixa (R$)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full bg-white border border-red-200 rounded-xl px-4 py-3 text-sm font-bold text-red-900 outline-none focus:border-red-500 transition-all"
                                            value={rentalData.late_fee_fixed}
                                            onChange={e => setRentalData({ ...rentalData, late_fee_fixed: e.target.value })}
                                            placeholder="0.00"
                                        />
                                        <p className="text-[10px] text-red-400 font-bold mt-1">Valor cobrado uma única vez no atraso.</p>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase tracking-widest text-red-800/70 mb-1 block">Juros Diário (%)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="w-full bg-white border border-red-200 rounded-xl px-4 py-3 text-sm font-bold text-red-900 outline-none focus:border-red-500 transition-all"
                                            value={rentalData.late_fee_daily_percent}
                                            onChange={e => setRentalData({ ...rentalData, late_fee_daily_percent: e.target.value })}
                                            placeholder="1.0"
                                        />
                                        <p className="text-[10px] text-red-400 font-bold mt-1">Porcentagem sobre o valor total por dia.</p>
                                    </div>
                                </div>

                                <div className="md:col-span-2 bg-blue-50 p-6 rounded-2xl border border-blue-100 flex flex-col md:flex-row items-center justify-between gap-6">
                                    <div>
                                        <h4 className="font-black text-blue-900 text-sm uppercase mb-1">Bloqueio por Atraso</h4>
                                        <p className="text-xs text-blue-700 font-medium">Impedir novas locações se o cliente tiver itens pendentes em atraso.</p>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={rentalData.block_late_items}
                                            onChange={e => setRentalData({ ...rentalData, block_late_items: e.target.checked })}
                                        />
                                        <div className="w-11 h-6 bg-blue-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                    </label>
                                </div>

                                <div className="md:col-span-2 pt-4">
                                    <button type="submit" disabled={loading} className="w-full md:w-auto px-8 py-3 bg-[#13283b] text-white rounded-xl font-bold text-sm hover:shadow-lg transition-all flex items-center justify-center gap-2">
                                        <Save size={18} /> Salvar Regras de Negócio
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Tab: NOTIFICATIONS */}
                    {activeTab === 'notifications' && (
                        <div className="space-y-8 animate-fadeIn">
                            <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
                                <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-500">
                                    <Bell size={32} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-[#13283b]">Notificações</h2>
                                    <p className="text-slate-400 text-sm font-medium">Escolha o que você quer receber.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {[
                                    { key: 'email_new_rental', label: 'Nova Locação Criada', desc: 'Receber email quando uma locação for aberta.', icon: Mail },
                                    { key: 'email_payment', label: 'Pagamento Confirmado', desc: 'Receber email ao registrar um pagamento.', icon: CreditCard },
                                    { key: 'whatsapp_overdue', label: 'Avisos de Atraso (WhatsApp)', desc: 'Enviar msg automática para você se houver atrasos.', icon: Phone },
                                ].map(notif => (
                                    <div key={notif.key} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl hover:shadow-md transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-slate-50 text-slate-400 rounded-lg">
                                                <notif.icon size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-[#13283b] text-sm">{notif.label}</h4>
                                                <p className="text-xs text-slate-400">{notif.desc}</p>
                                            </div>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input
                                                type="checkbox"
                                                className="sr-only peer"
                                                checked={notificationData[notif.key]}
                                                onChange={e => setNotificationData({ ...notificationData, [notif.key]: e.target.checked })}
                                            />
                                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                        </label>
                                    </div>
                                ))}

                                <div className="pt-6">
                                    <button
                                        onClick={handleSaveNotifications}
                                        disabled={loading}
                                        className="w-full md:w-auto px-8 py-3 bg-[#13283b] text-white rounded-xl font-bold text-sm hover:shadow-lg transition-all flex items-center justify-center gap-2"
                                    >
                                        <Save size={18} /> Salvar Preferências
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Tab: SUBSCRIPTION */}
                    {activeTab === 'subscription' && (
                        <SubscriptionManager user={user} />
                    )}



                </main>
            </div>

        </div>
    )
}

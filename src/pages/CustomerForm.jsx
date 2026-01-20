
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useDialog } from '../components/DialogProvider'
import { ArrowLeft, Crown } from 'lucide-react'

export default function CustomerForm() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const { alert: dialogAlert, success, error: toastError } = useDialog()

    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        whatsapp: '',
        cpf: '',
        customer_city: '',
        observations: '',
        whatsapp_opt_in: true,
        is_vip: false
    })

    const [states, setStates] = useState([])
    const [cities, setCities] = useState([])
    const [loadingLocations, setLoadingLocations] = useState(false)

    useEffect(() => {
        fetchStates()
        if (id) {
            loadCustomer()
        }
    }, [id])

    async function fetchStates() {
        try {
            const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome')
            const data = await response.json()
            setStates(data)
        } catch (error) {
            console.error('Error fetching states:', error)
        }
    }

    async function fetchCities(uf) {
        if (!uf) return
        try {
            setLoadingLocations(true)
            const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios?orderBy=nome`)
            const data = await response.json()
            setCities(data)
        } catch (error) {
            console.error('Error fetching cities:', error)
        } finally {
            setLoadingLocations(false)
        }
    }

    useEffect(() => {
        if (formData.customer_state) {
            fetchCities(formData.customer_state)
        }
    }, [formData.customer_state])

    async function loadCustomer() {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('customers')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            if (data) setFormData({
                name: data.name,
                email: data.email || '',
                whatsapp: data.whatsapp || '',
                cpf: data.cpf || '',
                customer_state: data.customer_state || '',
                customer_city: data.customer_city || '',
                observations: data.observations || '',
                whatsapp_opt_in: data.whatsapp_opt_in ?? true,
                is_vip: data.is_vip ?? false
            })
        } catch (error) {
            console.error('Error loading customer:', error)
            toastError('Erro ao carregar dados do cliente')
            navigate('/customers')
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!user) return

        try {
            setLoading(true)
            const customerData = {
                name: formData.name,
                email: formData.email,
                whatsapp: formData.whatsapp,
                cpf: formData.cpf,
                customer_state: formData.customer_state,
                customer_city: formData.customer_city,
                observations: formData.observations,
                whatsapp_opt_in: formData.whatsapp_opt_in,
                is_vip: formData.is_vip,
                user_id: user.id
            }

            if (id) {
                const { error } = await supabase
                    .from('customers')
                    .update(customerData)
                    .eq('id', id)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('customers')
                    .insert([customerData])
                if (error) throw error
            }

            success(id ? 'Cliente atualizado com sucesso!' : 'Cliente cadastrado com sucesso!')
            navigate('/customers')
        } catch (error) {
            console.error('Error saving customer:', error)
            toastError('Erro ao salvar cliente')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-xl mx-auto space-y-8 pb-12">
            <div>
                <h2 className="text-2xl font-black tracking-tight text-text-primary-light dark:text-text-primary-dark uppercase">
                    {id ? 'Editar Cadastro' : 'Novo Cliente'}
                </h2>
                <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm font-medium mt-1">
                    Preencha as informações para {id ? 'atualizar' : 'cadastrar'} seu cliente.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="app-card p-6 md:p-8 space-y-6">
                <div className="space-y-2">
                    <label className="app-label" htmlFor="name">Nome Completo</label>
                    <input
                        id="name"
                        type="text"
                        className="app-input"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        required
                        placeholder="Ex: João Silva"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="app-label" htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            className="app-input"
                            value={formData.email || ''}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            placeholder="cliente@exemplo.com"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="app-label" htmlFor="whatsapp">WhatsApp</label>
                        <input
                            id="whatsapp"
                            type="text"
                            className="app-input font-bold text-secondary"
                            value={formData.whatsapp}
                            onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                            placeholder="(11) 99999-9999"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-2">
                        <label className="app-label" htmlFor="cpf">CPF / CNPJ</label>
                        <input
                            id="cpf"
                            type="text"
                            className="app-input"
                            value={formData.cpf || ''}
                            onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                            placeholder="000.000.000-00"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider ml-1">
                            Estado (UF)
                        </label>
                        <div className="relative">
                            <select
                                value={formData.customer_state}
                                onChange={(e) => setFormData({ ...formData, customer_state: e.target.value, customer_city: '' })}
                                className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
                            >
                                <option value="">UF</option>
                                {states.map(s => (
                                    <option key={s.id} value={s.sigla}>{s.nome}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider ml-1">
                            Cidade
                        </label>
                        <div className="relative">
                            <select
                                value={formData.customer_city}
                                onChange={(e) => setFormData({ ...formData, customer_city: e.target.value })}
                                disabled={!formData.customer_state || loadingLocations}
                                className="w-full px-4 py-3 rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-slate-900 focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none disabled:opacity-50"
                            >
                                <option value="">{loadingLocations ? '...' : 'Cidade'}</option>
                                {cities.map(c => (
                                    <option key={c.id} value={c.nome}>{c.nome}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="app-label" htmlFor="observations">Observações</label>
                    <textarea
                        id="observations"
                        className="app-input min-h-[100px] py-3"
                        value={formData.observations || ''}
                        onChange={e => setFormData({ ...formData, observations: e.target.value })}
                        placeholder="Notas importantes sobre o cliente..."
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* VIP Toggle */}
                    <div className={`p-4 rounded-2xl border transition-all flex items-center gap-4 ${formData.is_vip ? 'bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-700/30' : 'bg-slate-50 dark:bg-slate-800 border-border-light dark:border-border-dark'}`}>
                        <div className="relative">
                            <input
                                type="checkbox"
                                id="is_vip"
                                className="sr-only"
                                checked={formData.is_vip}
                                onChange={e => setFormData({ ...formData, is_vip: e.target.checked })}
                            />
                            <label
                                htmlFor="is_vip"
                                className={`block w-12 h-6 rounded-full cursor-pointer transition-colors relative ${formData.is_vip ? 'bg-amber-400' : 'bg-slate-300 dark:bg-slate-700'}`}
                            >
                                <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${formData.is_vip ? 'translate-x-6' : ''}`}></span>
                            </label>
                        </div>

                        <div className="flex-1">
                            <div className={`text-sm font-black uppercase tracking-tight flex items-center gap-2 ${formData.is_vip ? 'text-amber-600 dark:text-amber-400' : 'text-text-secondary-light/60'}`}>
                                <Crown size={16} className={formData.is_vip ? 'fill-current' : ''} />
                                Cliente VIP
                            </div>
                            <p className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark font-medium leading-tight mt-0.5">
                                Destaca este cliente e habilita descontos especiais.
                            </p>
                        </div>
                    </div>

                    {/* Opt-in Toggle */}
                    <div className={`p-4 rounded-2xl border transition-all flex items-center gap-4 ${formData.whatsapp_opt_in ? 'bg-secondary/5 border-secondary/20' : 'bg-slate-50 dark:bg-slate-800 border-border-light dark:border-border-dark'}`}>
                        <div className="relative">
                            <input
                                type="checkbox"
                                id="opt_in"
                                className="sr-only"
                                checked={formData.whatsapp_opt_in}
                                onChange={e => setFormData({ ...formData, whatsapp_opt_in: e.target.checked })}
                            />
                            <label
                                htmlFor="opt_in"
                                className={`block w-12 h-6 rounded-full cursor-pointer transition-colors relative ${formData.whatsapp_opt_in ? 'bg-secondary' : 'bg-slate-300 dark:bg-slate-700'}`}
                            >
                                <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${formData.whatsapp_opt_in ? 'translate-x-6' : ''}`}></span>
                            </label>
                        </div>

                        <div className="flex-1">
                            <div className={`text-sm font-black uppercase tracking-tight ${formData.whatsapp_opt_in ? 'text-secondary' : 'text-text-secondary-light/60'}`}>
                                Envio Automático
                            </div>
                            <p className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark font-medium leading-tight mt-0.5">
                                Permite o envio automático de mensagens.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 pt-4">
                    <button
                        type="submit"
                        className="bg-primary hover:bg-primary-hover text-white py-4 px-8 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-primary/30 transition-all disabled:opacity-50 flex-1"
                        disabled={loading}
                    >
                        {loading ? 'Salvando...' : (id ? 'Atualizar Cliente' : 'Cadastrar Cliente')}
                    </button>
                    <button
                        type="button"
                        className="border border-border-light dark:border-border-dark hover:bg-slate-50 dark:hover:bg-slate-800 py-4 px-8 rounded-2xl font-bold transition-all"
                        onClick={() => navigate('/customers')}
                    >
                        Cancelar
                    </button>
                </div>
            </form>
        </div>
    )
}

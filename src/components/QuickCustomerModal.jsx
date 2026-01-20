
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { X, User, Phone, Save } from 'lucide-react'
import { useDialog } from '../components/DialogProvider'

export default function QuickCustomerModal({ isOpen, onClose, onSuccess }) {
    const { user } = useAuth()
    const { success, error: toastError } = useDialog()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        whatsapp: '',
        cpf: '',
        customer_state: '',
        customer_city: '',
        observations: '',
        whatsapp_opt_in: true
    })

    const [states, setStates] = useState([])
    const [cities, setCities] = useState([])
    const [loadingLocations, setLoadingLocations] = useState(false)

    useEffect(() => {
        if (isOpen) {
            fetchStates()
        }
    }, [isOpen])

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

    if (!isOpen) return null

    async function handleSubmit(e) {
        e.preventDefault()
        if (!user) return

        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('customers')
                .insert([{
                    name: formData.name,
                    email: formData.email,
                    whatsapp: formData.whatsapp,
                    cpf: formData.cpf,
                    customer_state: formData.customer_state,
                    customer_city: formData.customer_city,
                    observations: formData.observations,
                    whatsapp_opt_in: formData.whatsapp_opt_in,
                    user_id: user.id
                }])
                .select()
                .single()

            if (error) throw error

            onSuccess(data)
            onClose()
            setFormData({
                name: '',
                email: '',
                whatsapp: '',
                cpf: '',
                customer_city: '',
                observations: '',
                whatsapp_opt_in: true
            })
        } catch (error) {
            console.error('Error saving customer:', error)
            toastError('Erro ao cadastrar cliente')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-border-light dark:border-border-dark overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-6 border-b border-border-light dark:border-border-dark flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight text-text-primary-light dark:text-text-primary-dark">Novo Cliente</h3>
                        <p className="text-[10px] font-bold text-text-secondary-light uppercase tracking-widest mt-0.5">Cadastro completo e imediato</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-text-secondary-light">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="app-label">Nome Completo</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary-light/40" size={18} />
                                <input
                                    type="text"
                                    className="app-input pl-12"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    required
                                    placeholder="Ex: João da Silva"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="app-label">WhatsApp</label>
                                <div className="relative">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary-light/40" size={18} />
                                    <input
                                        type="text"
                                        className="app-input pl-12 font-bold text-secondary"
                                        value={formData.whatsapp}
                                        onChange={e => setFormData({ ...formData, whatsapp: e.target.value })}
                                        placeholder="(00) 00000-0000"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="app-label">CPF / CNPJ</label>
                                <input
                                    type="text"
                                    className="app-input"
                                    value={formData.cpf}
                                    onChange={e => setFormData({ ...formData, cpf: e.target.value })}
                                    placeholder="000.000.000-00"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="app-label">Estado (UF)</label>
                                <select
                                    className="app-input appearance-none"
                                    value={formData.customer_state}
                                    onChange={e => setFormData({ ...formData, customer_state: e.target.value, customer_city: '' })}
                                >
                                    <option value="">UF</option>
                                    {states.map(s => (
                                        <option key={s.id} value={s.sigla}>{s.nome}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="app-label">Cidade</label>
                                <select
                                    className="app-input appearance-none disabled:opacity-50"
                                    value={formData.customer_city}
                                    onChange={e => setFormData({ ...formData, customer_city: e.target.value })}
                                    disabled={!formData.customer_state || loadingLocations}
                                >
                                    <option value="">{loadingLocations ? '...' : 'Cidade'}</option>
                                    {cities.map(c => (
                                        <option key={c.id} value={c.nome}>{c.nome}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="app-label">Email (Opcional)</label>
                            <input
                                type="email"
                                className="app-input"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                placeholder="cliente@email.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="app-label">Observações</label>
                            <textarea
                                className="app-input min-h-[80px] py-3 text-sm"
                                value={formData.observations}
                                onChange={e => setFormData({ ...formData, observations: e.target.value })}
                                placeholder="Notas importantes..."
                            />
                        </div>

                        <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${formData.whatsapp_opt_in ? 'bg-secondary/5 border-secondary/20' : 'bg-slate-50 dark:bg-slate-800 border-border-light dark:border-border-dark'}`}>
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${formData.whatsapp_opt_in ? 'bg-secondary/20 text-secondary' : 'bg-slate-200 text-slate-400'}`}>
                                    <Phone size={16} />
                                </div>
                                <div>
                                    <span className="text-xs font-black uppercase tracking-tight block">Autoriza Envios</span>
                                    <span className="text-[10px] text-text-secondary-light font-medium">Contratos e notificações via WhatsApp</span>
                                </div>
                            </div>
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    id="quick_opt_in"
                                    className="sr-only"
                                    checked={formData.whatsapp_opt_in}
                                    onChange={e => setFormData({ ...formData, whatsapp_opt_in: e.target.checked })}
                                />
                                <label
                                    htmlFor="quick_opt_in"
                                    className={`block w-12 h-6 rounded-full cursor-pointer transition-colors relative ${formData.whatsapp_opt_in ? 'bg-secondary' : 'bg-slate-300 dark:bg-slate-700'}`}
                                >
                                    <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${formData.whatsapp_opt_in ? 'translate-x-6' : ''}`}></span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-border-light dark:border-border-dark">
                        <button
                            type="submit"
                            className="flex-1 bg-primary hover:bg-primary-hover text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-primary/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            disabled={loading || !formData.name}
                        >
                            <Save size={18} />
                            {loading ? 'Salvando...' : 'Finalizar Cadastro'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-4 border border-border-light dark:border-border-dark hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl font-bold transition-all text-text-secondary-light"
                        >
                            Sair
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

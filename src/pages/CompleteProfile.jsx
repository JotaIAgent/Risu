import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { validateCPF, validateCNPJ } from '../lib/validators'
import { User, ShieldCheck, Phone, MapPin, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react'

const BRAZILIAN_STATES = [
    { uf: 'AC', name: 'Acre' }, { uf: 'AL', name: 'Alagoas' }, { uf: 'AP', name: 'Amapá' },
    { uf: 'AM', name: 'Amazonas' }, { uf: 'BA', name: 'Bahia' }, { uf: 'CE', name: 'Ceará' },
    { uf: 'DF', name: 'Distrito Federal' }, { uf: 'ES', name: 'Espírito Santo' }, { uf: 'GO', name: 'Goiás' },
    { uf: 'MA', name: 'Maranhão' }, { uf: 'MT', name: 'Mato Grosso' }, { uf: 'MS', name: 'Mato Grosso do Sul' },
    { uf: 'MG', name: 'Minas Gerais' }, { uf: 'PA', name: 'Pará' }, { uf: 'PB', name: 'Paraíba' },
    { uf: 'PR', name: 'Paraná' }, { uf: 'PE', name: 'Pernambuco' }, { uf: 'PI', name: 'Piauí' },
    { uf: 'RJ', name: 'Rio de Janeiro' }, { uf: 'RN', name: 'Rio Grande do Norte' }, { uf: 'RS', name: 'Rio Grande do Sul' },
    { uf: 'RO', name: 'Rondônia' }, { uf: 'RR', name: 'Roraima' }, { uf: 'SC', name: 'Santa Catarina' },
    { uf: 'SP', name: 'São Paulo' }, { uf: 'SE', name: 'Sergipe' }, { uf: 'TO', name: 'Tocantins' }
]

export default function CompleteProfile() {
    const { user, profile, loading: authLoading, refreshProfile } = useAuth()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [loadingCities, setLoadingCities] = useState(false)
    const [cities, setCities] = useState([])

    const [formData, setFormData] = useState({
        person_type: 'PF',
        tax_id: '',
        whatsapp: '',
        company_name: '',
        city: '',
        state: '',
        terms_accepted: false,
        privacy_accepted: false
    })

    useEffect(() => {
        // If profile is already complete, redirect to dashboard
        if (profile?.tax_id && profile?.whatsapp && profile?.city && profile?.state) {
            navigate('/')
        }
    }, [profile, navigate])

    if (authLoading || (!user && window.location.hash)) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#0a1118] gap-4">
                <div className="text-[#13283b] dark:text-white font-black uppercase tracking-widest animate-pulse">
                    Finalizando autenticação...
                </div>
                <p className="text-xs text-slate-400">Isso pode levar alguns segundos.</p>
                {/* Failsafe Button after 5s usually, but showing immediately for responsiveness if stuck */}
                <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-6 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-50 transition-colors shadow-sm"
                >
                    Demorando muito? Recarregar
                </button>
            </div>
        )
    }

    if (!user) {
        // Should have been handled by useEffect redirect, but just in case
        return null
    }

    const handleInputChange = (e) => {
        const { id, value, type, checked } = e.target
        setFormData(prev => ({
            ...prev,
            [id]: type === 'checkbox' ? checked : value
        }))

        if (id === 'state' && value) {
            fetchCities(value)
        }
    }

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

    const isTaxIdValid = () => {
        if (!formData.tax_id) return true
        if (formData.person_type === 'PF') return validateCPF(formData.tax_id)
        return validateCNPJ(formData.tax_id)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!formData.terms_accepted || !formData.privacy_accepted) {
            setError('Você deve aceitar os termos e a política de privacidade.')
            return
        }

        if (!formData.tax_id || !isTaxIdValid()) {
            setError('Documento inválido.')
            return
        }

        if (!formData.whatsapp || !formData.state || !formData.city) {
            setError('Preencha todos os campos obrigatórios.')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const userId = user?.id || (await supabase.auth.getUser()).data.user?.id

            if (!userId) {
                throw new Error('Usuário não identificado. Recarregue a página.')
            }

            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    person_type: formData.person_type,
                    tax_id: formData.tax_id,
                    whatsapp: formData.whatsapp,
                    company_name: formData.company_name,
                    city: formData.city,
                    state: formData.state,
                    terms_accepted: true,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId)

            if (updateError) throw updateError

            // Refresh profile state in AuthContext before navigating
            await refreshProfile()
            navigate('/')
        } catch (err) {
            console.error('Error updating profile:', err)
            setError('Erro ao salvar dados. Tente novamente.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-[#0a1118]">
            <div className="w-full max-w-2xl">
                <div className="text-center mb-10">
                    <h1 className="text-3xl font-black text-[#13283b] dark:text-white uppercase tracking-tighter mb-2">
                        Quase lá, {user?.user_metadata?.full_name?.split(' ')[0]}!
                    </h1>
                    <p className="text-slate-500 font-medium">Finalize seu cadastro para acessar o sistema.</p>
                </div>

                <div className="bg-white dark:bg-[#13283b] rounded-[2.5rem] p-10 shadow-2xl overflow-hidden relative">
                    {/* Decorative Top */}
                    <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-secondary to-primary" />

                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 text-sm font-bold flex items-center gap-2">
                            <AlertTriangle size={18} />
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Legal Info */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-black uppercase tracking-widest text-[#13283b] dark:text-white flex items-center gap-2">
                                <ShieldCheck size={18} className="text-secondary" /> Dados Legais
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Tipo</label>
                                    <div className="flex gap-2 mt-1">
                                        <button
                                            type="button"
                                            onClick={() => setFormData(p => ({ ...p, person_type: 'PF' }))}
                                            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all border ${formData.person_type === 'PF' ? 'bg-secondary text-white border-secondary' : 'bg-slate-50 text-slate-400 border-transparent'}`}
                                        >
                                            Pessoa Física
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFormData(p => ({ ...p, person_type: 'PJ' }))}
                                            className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all border ${formData.person_type === 'PJ' ? 'bg-secondary text-white border-secondary' : 'bg-slate-50 text-slate-400 border-transparent'}`}
                                        >
                                            Jurídica
                                        </button>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">
                                        {formData.person_type === 'PF' ? 'CPF' : 'CNPJ'}
                                    </label>
                                    <input
                                        required
                                        id="tax_id"
                                        className="w-full mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold text-[#13283b] dark:text-white outline-none border border-transparent focus:border-slate-200 transaction-all"
                                        value={formData.tax_id}
                                        onChange={handleInputChange}
                                        placeholder={formData.person_type === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Contact & Location */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-black uppercase tracking-widest text-[#13283b] dark:text-white flex items-center gap-2">
                                <Phone size={18} className="text-secondary" /> Contato
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">WhatsApp</label>
                                    <input
                                        required
                                        id="whatsapp"
                                        className="w-full mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold text-[#13283b] dark:text-white outline-none border border-transparent focus:border-slate-200 transaction-all"
                                        value={formData.whatsapp}
                                        onChange={handleInputChange}
                                        placeholder="(00) 90000-0000"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Empresa (Opcional)</label>
                                    <input
                                        id="company_name"
                                        className="w-full mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold text-[#13283b] dark:text-white outline-none border border-transparent focus:border-slate-200 transaction-all"
                                        value={formData.company_name}
                                        onChange={handleInputChange}
                                        placeholder="Nome da Loja"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Estado</label>
                                    <select
                                        id="state"
                                        className="w-full mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold text-[#13283b] dark:text-white outline-none border border-transparent focus:border-slate-200 transaction-all"
                                        value={formData.state}
                                        onChange={handleInputChange}
                                    >
                                        <option value="">UF</option>
                                        {BRAZILIAN_STATES.map(s => <option key={s.uf} value={s.uf}>{s.uf}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Cidade</label>
                                    <select
                                        id="city"
                                        disabled={!formData.state || loadingCities}
                                        className="w-full mt-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm font-bold text-[#13283b] dark:text-white outline-none border border-transparent focus:border-slate-200 transaction-all disabled:opacity-50"
                                        value={formData.city}
                                        onChange={handleInputChange}
                                    >
                                        <option value="">{loadingCities ? '...' : 'Cidade'}</option>
                                        {cities.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Terms */}
                        <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    id="terms_accepted"
                                    checked={formData.terms_accepted}
                                    onChange={handleInputChange}
                                    className="w-5 h-5 rounded border-slate-300 text-secondary focus:ring-secondary"
                                />
                                <span className="text-xs font-bold text-slate-500">Li e aceito os Termos de Uso.</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    id="privacy_accepted"
                                    checked={formData.privacy_accepted}
                                    onChange={handleInputChange}
                                    className="w-5 h-5 rounded border-slate-300 text-secondary focus:ring-secondary"
                                />
                                <span className="text-xs font-bold text-slate-500">Concordo com a Política de Privacidade.</span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#13283b] hover:bg-black text-white py-4 rounded-xl font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
                        >
                            {loading ? 'Salvando...' : 'Finalizar Cadastro'}
                            <ArrowRight size={18} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}


import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, User, ShieldCheck, Phone, Info, ChevronRight, ChevronLeft, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { validateCPF, validateCNPJ } from '../lib/validators'
import { translateAuthError } from '../lib/auth-translations'

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

export default function Signup() {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [loadingCities, setLoadingCities] = useState(false)
    const [cities, setCities] = useState([])
    const [error, setError] = useState(null)
    const navigate = useNavigate()

    // Form State
    const [formData, setFormData] = useState({
        // Step 1: Account
        full_name: '',
        email: '',
        password: '',
        confirmPassword: '',
        // Step 2: Legal
        person_type: 'PF',
        tax_id: '',
        // Step 3: Contact/Location
        whatsapp: '',
        company_name: '',
        city: '',
        state: '',
        // Step 4: Profile/Acceptance
        referral_source: '',
        main_objective: '',
        company_size: '',
        terms_accepted: false,
        privacy_accepted: false
    })

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
        if (!formData.tax_id) return true // Don't show error if empty
        if (formData.person_type === 'PF') return validateCPF(formData.tax_id)
        return validateCNPJ(formData.tax_id)
    }

    const nextStep = () => {
        // Validation for Step 1
        if (step === 1) {
            if (!formData.full_name || !formData.email || !formData.password || !formData.confirmPassword) {
                setError('Preencha todos os campos obrigatórios.')
                return
            }
            if (formData.password !== formData.confirmPassword) {
                setError('As senhas não coincidem.')
                return
            }
            if (formData.password.length < 6) {
                setError('A senha deve ter no mínimo 6 caracteres.')
                return
            }
        }

        // Validation for Step 2
        if (step === 2) {
            if (!formData.tax_id) {
                setError('CPF/CNPJ é obrigatório.')
                return
            }
            if (!isTaxIdValid()) {
                setError(`O ${formData.person_type === 'PF' ? 'CPF' : 'CNPJ'} informado não é válido.`)
                return
            }
        }

        setError(null)
        setStep(prev => prev + 1)
    }

    const prevStep = () => {
        setError(null)
        setStep(prev => prev - 1)
    }

    const handleSignup = async (e) => {
        e.preventDefault()
        if (!formData.terms_accepted || !formData.privacy_accepted) {
            setError('Você deve aceitar os termos e a política de privacidade.')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const { error: signUpError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.full_name,
                        person_type: formData.person_type,
                        tax_id: formData.tax_id,
                        whatsapp: formData.whatsapp,
                        company_name: formData.company_name,
                        city: formData.city,
                        state: formData.state,
                        terms_accepted: formData.terms_accepted,
                        referral_source: formData.referral_source,
                        main_objective: formData.main_objective,
                        company_size: formData.company_size,
                        // Enforce standard user defaults
                        account_type: 'common',
                        is_suspended: false // Explicitly set to false,
                    },
                    emailRedirectTo: window.location.origin + '/guide'
                }
            })

            if (signUpError) throw signUpError

            // Redirect to email confirmation page
            navigate('/confirm-email', { state: { email: formData.email } })
        } catch (err) {
            setError(translateAuthError(err.message))
            setLoading(false)
        }
    }



    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-[#0a1118] transition-colors duration-500 font-sans">
            <div className="w-full max-w-2xl">
                <Link to="/" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-8 hover:text-[#13283b] transition-all">
                    <ArrowLeft size={14} />
                    Início
                </Link>

                <div className="bg-white dark:bg-[#13283b] rounded-[3rem] shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800 overflow-hidden">
                    {/* Progress Bar */}
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 flex">
                        {[1, 2, 3, 4].map(s => (
                            <div
                                key={s}
                                className={`flex-1 transition-all duration-500 ${step >= s ? 'bg-secondary' : 'bg-transparent'}`}
                            />
                        ))}
                    </div>

                    <div className="p-10 md:p-14">
                        <header className="mb-10 flex justify-between items-end">
                            <div>
                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-secondary mb-2 block">Passo {step} de 4</span>
                                <h1 className="text-3xl font-black text-[#13283b] dark:text-white uppercase tracking-tighter">
                                    {step === 1 && 'Dados de Conta'}
                                    {step === 2 && 'Dados Legais'}
                                    {step === 3 && 'Contato & Local'}
                                    {step === 4 && 'Perfil do Negócio'}
                                </h1>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl text-secondary">
                                {step === 1 && <User size={24} />}
                                {step === 2 && <ShieldCheck size={24} />}
                                {step === 3 && <Phone size={24} />}
                                {step === 4 && <Info size={24} />}
                            </div>
                        </header>

                        {error && (
                            <div className="bg-red-50 border border-red-100 text-red-500 p-5 rounded-2xl mb-8 text-xs font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
                                <AlertTriangle size={18} />
                                {error}
                            </div>
                        )}





                        <form onSubmit={handleSignup} className="space-y-8">
                            {/* STEP 1: ACCOUNT */}
                            {step === 1 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <div className="group space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block group-focus-within:text-secondary transition-colors">Nome Completo <span className="text-red-400">*</span></label>
                                        <input
                                            required
                                            id="full_name"
                                            className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-[1.5rem] text-sm font-bold text-[#13283b] dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-slate-200 dark:focus:border-slate-700 outline-none transition-all placeholder:text-slate-300"
                                            placeholder="Seu nome completo"
                                            value={formData.full_name}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="group space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block group-focus-within:text-secondary transition-colors">Seu Melhor Email <span className="text-red-400">*</span></label>
                                        <input
                                            required
                                            id="email"
                                            type="email"
                                            className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-[1.5rem] text-sm font-bold text-[#13283b] dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-slate-200 dark:focus:border-slate-700 outline-none transition-all placeholder:text-slate-300"
                                            placeholder="email@exemplo.com"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="group space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block group-focus-within:text-secondary transition-colors">Senha de Acesso <span className="text-red-400">*</span></label>
                                            <input
                                                required
                                                id="password"
                                                type="password"
                                                className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-[1.5rem] text-sm font-bold text-[#13283b] dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-slate-200 dark:focus:border-slate-700 outline-none transition-all placeholder:text-slate-300"
                                                placeholder="••••••••"
                                                value={formData.password}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                        <div className="group space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block group-focus-within:text-secondary transition-colors">Confirmar Senha <span className="text-red-400">*</span></label>
                                            <input
                                                required
                                                id="confirmPassword"
                                                type="password"
                                                className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-[1.5rem] text-sm font-bold text-[#13283b] dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-slate-200 dark:focus:border-slate-700 outline-none transition-all placeholder:text-slate-300"
                                                placeholder="••••••••"
                                                value={formData.confirmPassword}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: LEGAL */}
                            {step === 2 && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <div className="space-y-4">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block">Tipo de Pessoa <span className="text-red-400">*</span></label>
                                        <div className="grid grid-cols-2 gap-4">
                                            <button
                                                type="button"
                                                onClick={() => setFormData(p => ({ ...p, person_type: 'PF' }))}
                                                className={`py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest border transition-all ${formData.person_type === 'PF' ? 'bg-secondary text-white border-secondary shadow-lg shadow-secondary/20' : 'bg-slate-50 text-slate-400 border-transparent hover:border-slate-200'}`}
                                            >
                                                Pessoa Física
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFormData(p => ({ ...p, person_type: 'PJ' }))}
                                                className={`py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest border transition-all ${formData.person_type === 'PJ' ? 'bg-secondary text-white border-secondary shadow-lg shadow-secondary/20' : 'bg-slate-50 text-slate-400 border-transparent hover:border-slate-200'}`}
                                            >
                                                Pessoa Jurídica
                                            </button>
                                        </div>
                                    </div>
                                    <div className="group space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block group-focus-within:text-secondary transition-colors">
                                            {formData.person_type === 'PF' ? 'CPF' : 'CNPJ'} <span className="text-red-400">*</span>
                                        </label>
                                        <input
                                            required
                                            id="tax_id"
                                            className={`w-full px-6 py-5 bg-slate-50 dark:bg-slate-800/50 border ${!isTaxIdValid() && formData.tax_id ? 'border-red-500 bg-red-50/50' : 'border-transparent'} rounded-[1.5rem] text-sm font-bold text-[#13283b] dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-slate-200 dark:focus:border-slate-700 outline-none transition-all placeholder:text-slate-300`}
                                            placeholder={formData.person_type === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
                                            value={formData.tax_id}
                                            onChange={handleInputChange}
                                        />
                                        {!isTaxIdValid() && formData.tax_id && (
                                            <p className="text-[10px] text-red-500 font-bold ml-2 flex items-center gap-1 animate-in fade-in slide-in-from-left-1">
                                                <AlertTriangle size={12} /> {formData.person_type === 'PF' ? 'CPF' : 'CNPJ'} inválido
                                            </p>
                                        )}
                                        <p className="text-[9px] text-slate-400 font-medium px-4">Utilizamos esse dado para emissão de faturas e compliance antifraude.</p>
                                    </div>
                                </div>
                            )}

                            {/* STEP 3: CONTACT & LOCATION */}
                            {step === 3 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="group space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block group-focus-within:text-secondary transition-colors">WhatsApp p/ Suporte</label>
                                            <input
                                                id="whatsapp"
                                                className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-[1.5rem] text-sm font-bold text-[#13283b] dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-slate-200 dark:focus:border-slate-700 outline-none transition-all placeholder:text-slate-300"
                                                placeholder="(00) 00000-0000"
                                                value={formData.whatsapp}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                        <div className="group space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block group-focus-within:text-secondary transition-colors">Nome da Empresa</label>
                                            <input
                                                id="company_name"
                                                className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-[1.5rem] text-sm font-bold text-[#13283b] dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-slate-200 dark:focus:border-slate-700 outline-none transition-all placeholder:text-slate-300"
                                                placeholder="Opcional"
                                                value={formData.company_name}
                                                onChange={handleInputChange}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="group space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block group-focus-within:text-secondary transition-colors">Estado (UF)</label>
                                            <select
                                                id="state"
                                                className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-[1.5rem] text-sm font-bold text-[#13283b] dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-slate-200 dark:focus:border-slate-700 outline-none transition-all"
                                                value={formData.state}
                                                onChange={handleInputChange}
                                            >
                                                <option value="">Selecione</option>
                                                {BRAZILIAN_STATES.map(state => (
                                                    <option key={state.uf} value={state.uf}>{state.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="group space-y-2">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block group-focus-within:text-secondary transition-colors">Cidade</label>
                                            <select
                                                id="city"
                                                disabled={!formData.state || loadingCities}
                                                className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-[1.5rem] text-sm font-bold text-[#13283b] dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-slate-200 dark:focus:border-slate-700 outline-none transition-all disabled:opacity-50"
                                                value={formData.city}
                                                onChange={handleInputChange}
                                            >
                                                <option value="">{loadingCities ? 'Carregando cidades...' : 'Selecione a cidade'}</option>
                                                {cities.map(city => (
                                                    <option key={city} value={city}>{city}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* STEP 4: PROFILE */}
                            {step === 4 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <div className="group space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block group-focus-within:text-secondary transition-colors">Como nos conheceu?</label>
                                        <select
                                            id="referral_source"
                                            className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-[1.5rem] text-sm font-bold text-[#13283b] dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-slate-200 dark:focus:border-slate-700 outline-none transition-all"
                                            value={formData.referral_source}
                                            onChange={handleInputChange}
                                        >
                                            <option value="">Selecione uma opção</option>
                                            <option value="instagram">Instagram / Facebook</option>
                                            <option value="google">Google Search</option>
                                            <option value="indication">Indicação de Amigo</option>
                                            <option value="youtube">YouTube</option>
                                            <option value="other">Outros</option>
                                        </select>
                                    </div>

                                    <div className="group space-y-2">
                                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2 block group-focus-within:text-secondary transition-colors">Tamanho da sua Operação</label>
                                        <select
                                            id="company_size"
                                            className="w-full px-6 py-5 bg-slate-50 dark:bg-slate-800/50 border border-transparent rounded-[1.5rem] text-sm font-bold text-[#13283b] dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-slate-200 dark:focus:border-slate-700 outline-none transition-all"
                                            value={formData.company_size}
                                            onChange={handleInputChange}
                                        >
                                            <option value="">Selecione</option>
                                            <option value="1">Apenas eu (Autônomo)</option>
                                            <option value="2-5">2 a 5 funcionários</option>
                                            <option value="6-20">6 a 20 funcionários</option>
                                            <option value="21+">Mais de 20 funcionários</option>
                                        </select>
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-slate-50 dark:border-slate-800">
                                        <label className="flex items-start gap-4 cursor-pointer group">
                                            <div className="relative flex items-center mt-1">
                                                <input
                                                    required
                                                    type="checkbox"
                                                    id="terms_accepted"
                                                    className="peer sr-only"
                                                    checked={formData.terms_accepted}
                                                    onChange={handleInputChange}
                                                />
                                                <div className="w-6 h-6 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-lg peer-checked:bg-secondary peer-checked:border-secondary transition-all" />
                                                <CheckCircle2 className="absolute text-white w-4 h-4 left-1 opacity-0 peer-checked:opacity-100 transition-all" />
                                            </div>
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 group-hover:text-[#13283b] dark:group-hover:text-white transition-colors leading-relaxed">
                                                Li e aceito os <Link to="/terms" className="text-secondary hover:underline">Termos de Uso</Link> do sistema.
                                            </span>
                                        </label>

                                        <label className="flex items-start gap-4 cursor-pointer group">
                                            <div className="relative flex items-center mt-1">
                                                <input
                                                    required
                                                    type="checkbox"
                                                    id="privacy_accepted"
                                                    className="peer sr-only"
                                                    checked={formData.privacy_accepted}
                                                    onChange={handleInputChange}
                                                />
                                                <div className="w-6 h-6 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-lg peer-checked:bg-secondary peer-checked:border-secondary transition-all" />
                                                <CheckCircle2 className="absolute text-white w-4 h-4 left-1 opacity-0 peer-checked:opacity-100 transition-all" />
                                            </div>
                                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 group-hover:text-[#13283b] dark:group-hover:text-white transition-colors leading-relaxed">
                                                Concordo com a <Link to="/privacy" className="text-secondary hover:underline">Política de Privacidade</Link>.
                                            </span>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* NAVIGATION */}
                            <div className="flex gap-4 pt-6">
                                {step > 1 && (
                                    <button
                                        type="button"
                                        onClick={prevStep}
                                        className="flex-1 px-8 py-5 bg-slate-50 dark:bg-slate-800/50 text-slate-400 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                                    >
                                        <ChevronLeft size={16} />
                                        Anterior
                                    </button>
                                )}

                                {step < 4 ? (
                                    <button
                                        type="button"
                                        onClick={nextStep}
                                        className="flex-[2] bg-[#13283b] dark:bg-white dark:text-[#13283b] text-white py-5 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                                    >
                                        Próximo Passo
                                        <ChevronRight size={16} />
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-[2] bg-secondary text-white py-5 rounded-[1.5rem] font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-secondary/30 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                                    >
                                        {loading ? 'Processando Cadastro...' : 'Finalizar e Acessar Agora'}
                                    </button>
                                )}
                            </div>
                        </form>

                        <div className="mt-12 pt-8 border-t border-slate-50 dark:border-slate-800/50 text-center">
                            <p className="text-xs font-bold text-slate-400">
                                Já possui conta?{' '}
                                <Link to="/login" className="text-secondary uppercase tracking-widest ml-1 hover:underline underline-offset-4">Fazer Login</Link>
                            </p>
                        </div>
                    </div>
                </div>

                <div className="text-center mt-12 space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 dark:text-slate-600">
                        Ambiente 100% Seguro & Criptografado
                    </p>
                </div>
            </div>
        </div>
    )
}

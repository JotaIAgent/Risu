import { useState, useEffect } from 'react'
import {
    Settings,
    Save,
    ToggleRight,
    Globe,
    Lock,
    RefreshCw,
    Shield,
    Bell,
    Mail,
    FileText,
    AlertTriangle,
    UserX,
    Server
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useDialog } from '../components/DialogProvider'

export default function AdminSettings() {
    const { success, error: toastError } = useDialog()
    const [loading, setLoading] = useState(false)
    const [fetching, setFetching] = useState(true)

    // State matches saas_config table
    const [config, setConfig] = useState({
        saas_name: '',
        support_email: '',
        maintenance_mode: false,
        allow_new_registrations: true,
        churn_risk_days: 30,
        suspension_days_after_due: 5,
        terms_of_use_text: '',
        privacy_policy_text: ''
    })

    useEffect(() => {
        fetchConfig()
    }, [])

    const fetchConfig = async () => {
        try {
            setFetching(true)
            const { data, error } = await supabase
                .from('saas_config')
                .select('*')
                .eq('id', 1)
                .single()

            if (error) throw error
            if (data) {
                setConfig({
                    saas_name: data.saas_name || '',
                    support_email: data.support_email || '',
                    maintenance_mode: data.maintenance_mode || false,
                    allow_new_registrations: data.allow_new_registrations !== false, // default true
                    churn_risk_days: data.churn_risk_days || 30,
                    suspension_days_after_due: data.suspension_days_after_due || 5,
                    terms_of_use_text: data.terms_of_use_text || '',
                    privacy_policy_text: data.privacy_policy_text || ''
                })
            }
        } catch (err) {
            console.error('Error fetching config:', err)
            toastError('Erro ao carregar configurações.')
        } finally {
            setFetching(false)
        }
    }

    const saveSettings = async () => {
        try {
            setLoading(true)
            const { error } = await supabase
                .from('saas_config')
                .update({
                    saas_name: config.saas_name,
                    support_email: config.support_email,
                    maintenance_mode: config.maintenance_mode,
                    allow_new_registrations: config.allow_new_registrations,
                    churn_risk_days: config.churn_risk_days,
                    suspension_days_after_due: config.suspension_days_after_due,
                    terms_of_use_text: config.terms_of_use_text,
                    privacy_policy_text: config.privacy_policy_text,
                    updated_at: new Date()
                })
                .eq('id', 1)

            if (error) throw error
            success('Configurações globais atualizadas com sucesso.')
        } catch (err) {
            console.error(err)
            toastError('Erro ao salvar configs.')
        } finally {
            setLoading(false)
        }
    }

    const Section = ({ title, description, icon: Icon, children }) => (
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30 overflow-hidden">
            <div className="p-10 border-b border-slate-50 flex items-center gap-4 bg-slate-50/20">
                <div className="p-3 bg-white rounded-xl shadow-sm">
                    <Icon size={20} className="text-[#13283b]" />
                </div>
                <div>
                    <h3 className="text-sm font-black uppercase tracking-widest text-[#13283b]">{title}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{description}</p>
                </div>
            </div>
            <div className="p-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {children}
                </div>
            </div>
        </div>
    )

    if (fetching) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <RefreshCw className="animate-spin text-slate-300" size={32} />
        </div>
    )

    return (
        <div className="space-y-12 w-full pb-20">
            <header className="flex justify-between items-start">
                <div>
                    <h2 className="text-4xl font-black text-[#13283b] uppercase tracking-tighter mb-2">Configurações</h2>
                    <p className="text-slate-400 font-medium tracking-wide text-lg">Central de Parâmetros Globais do Ecossistema Risu.</p>
                </div>
                <button
                    onClick={saveSettings}
                    disabled={loading}
                    className="bg-[#13283b] text-white px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-[#13283b]/30 hover:scale-[1.05] transition-all disabled:opacity-50 flex items-center gap-3"
                >
                    {loading ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
                    Sincronizar Globals
                </button>
            </header>

            <div className="grid grid-cols-1 gap-10">

                {/* IDENTIDADE DO SAAS */}
                <Section
                    title="Identidade & Suporte"
                    description="Como o sistema se apresenta para os tenants."
                    icon={Globe}
                >
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Nome da Plataforma</label>
                        <input
                            type="text"
                            readOnly
                            className="w-full px-6 py-4 bg-slate-100/50 border border-transparent rounded-3xl text-sm font-bold text-slate-500 focus:bg-white focus:border-slate-100 transition-all outline-none cursor-not-allowed"
                            value={config.saas_name}
                        />
                        <p className="text-[9px] text-slate-300 font-bold px-2">Definido no arquivo de ambiente (ENV).</p>
                    </div>
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Email de Suporte</label>
                        <div className="relative">
                            <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                className="w-full pl-14 pr-6 py-4 bg-slate-50 border border-transparent rounded-3xl text-sm font-bold text-[#13283b] focus:bg-white focus:border-slate-100 transition-all outline-none"
                                value={config.support_email}
                                onChange={(e) => setConfig({ ...config, support_email: e.target.value })}
                            />
                        </div>
                    </div>
                </Section>

                {/* INFRAESTRUTURA & CONTROLE */}
                <Section
                    title="Infraestrutura e Controle"
                    description="Controle de acesso e manutenção do sistema."
                    icon={Shield}
                >
                    <div className="flex flex-col gap-6">
                        <div className={`flex items-center justify-between p-6 rounded-[2rem] border transition-all ${config.maintenance_mode ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-full ${config.maintenance_mode ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-500'}`}>
                                    <Lock size={20} />
                                </div>
                                <div>
                                    <p className={`text-xs font-black uppercase tracking-tighter ${config.maintenance_mode ? 'text-red-700' : 'text-[#13283b]'}`}>Modo Manutenção</p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Bloqueia login de usuários</p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={config.maintenance_mode}
                                onChange={(e) => setConfig({ ...config, maintenance_mode: e.target.checked })}
                                className="w-6 h-6 rounded-lg cursor-pointer accent-red-600"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-6">
                        <div className={`flex items-center justify-between p-6 rounded-[2rem] border transition-all ${config.allow_new_registrations ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-100'}`}>
                            <div className="flex items-center gap-4">
                                <div className={`p-3 rounded-full ${config.allow_new_registrations ? 'bg-green-100 text-green-600' : 'bg-slate-200 text-slate-500'}`}>
                                    <UserX size={20} />
                                </div>
                                <div>
                                    <p className={`text-xs font-black uppercase tracking-tighter ${config.allow_new_registrations ? 'text-green-700' : 'text-[#13283b]'}`}>Novos Cadastros</p>
                                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Permitir criar conta</p>
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={config.allow_new_registrations}
                                onChange={(e) => setConfig({ ...config, allow_new_registrations: e.target.checked })}
                                className="w-6 h-6 rounded-lg cursor-pointer accent-green-600"
                            />
                        </div>
                    </div>
                </Section>

                {/* REGRAS & AUTOMACAO */}
                <Section
                    title="Automação & Regras"
                    description="Definições de churn e suspensão automática."
                    icon={Settings}
                >
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Alerta de Churn (Dias sem login)</label>
                        <div className="flex items-center gap-4">
                            <input
                                type="number"
                                className="w-24 px-4 py-4 bg-slate-50 border border-transparent rounded-2xl text-center text-lg font-black text-[#13283b] outline-none"
                                value={config.churn_risk_days}
                                onChange={(e) => setConfig({ ...config, churn_risk_days: parseInt(e.target.value) })}
                            />
                            <p className="text-xs font-bold text-slate-400">dias de inatividade</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Suspensão de Conta (Dias após Vencimento)</label>
                        <div className="flex items-center gap-4">
                            <input
                                type="number"
                                className="w-24 px-4 py-4 bg-slate-50 border border-transparent rounded-2xl text-center text-lg font-black text-[#13283b] outline-none"
                                value={config.suspension_days_after_due}
                                onChange={(e) => setConfig({ ...config, suspension_days_after_due: parseInt(e.target.value) })}
                            />
                            <p className="text-xs font-bold text-slate-400">dias de tolerância</p>
                        </div>
                    </div>
                </Section>

                {/* JURÍDICO */}
                <Section
                    title="Legal & Compliance"
                    description="Textos legais exibidos no cadastro e rodapé."
                    icon={FileText}
                >
                    <div className="md:col-span-2 space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Termos de Uso (Markdown/HTML)</label>
                        <textarea
                            className="w-full p-6 bg-slate-50 border border-transparent rounded-[2rem] text-xs font-mono text-slate-600 focus:bg-white focus:border-slate-100 transition-all outline-none h-48 resize-none"
                            value={config.terms_of_use_text}
                            onChange={(e) => setConfig({ ...config, terms_of_use_text: e.target.value })}
                            placeholder="# Termos de Uso..."
                        />
                    </div>
                    <div className="md:col-span-2 space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Política de Privacidade (Markdown/HTML)</label>
                        <textarea
                            className="w-full p-6 bg-slate-50 border border-transparent rounded-[2rem] text-xs font-mono text-slate-600 focus:bg-white focus:border-slate-100 transition-all outline-none h-48 resize-none"
                            value={config.privacy_policy_text}
                            onChange={(e) => setConfig({ ...config, privacy_policy_text: e.target.value })}
                            placeholder="# Política de Privacidade..."
                        />
                    </div>
                </Section>

                {/* BOTTOM SAVE BUTTON */}
                <div className="flex justify-end pt-6">
                    <button
                        onClick={saveSettings}
                        disabled={loading}
                        className="bg-[#13283b] text-white px-12 py-5 rounded-3xl text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-[#13283b]/30 hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center gap-4"
                    >
                        {loading ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                        Salvar Todas as Configurações
                    </button>
                </div>

            </div>

            <div className="flex justify-center pt-8">
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-300">Risu Master System Interface — v2.1.0 Stable</p>
            </div>
        </div>
    )
}

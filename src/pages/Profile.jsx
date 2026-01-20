
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { User, Phone, FileText, Lock, Mail, Save, Info, MessageCircle } from 'lucide-react'
import { useDialog } from '../components/DialogProvider'
import PageTitle from '../components/PageTitle'

export default function Profile() {
    const { user } = useAuth()
    const { success, error: toastError, alert: dialogAlert } = useDialog()
    const [loading, setLoading] = useState(false)
    const [formData, setFormData] = useState({
        owner_name: '',
        owner_phone: '',
        owner_cpf_cnpj: '',
        owner_cep: '',
        owner_street: '',
        owner_number: '',
        owner_complement: '',
        owner_neighborhood: '',
        owner_city: '',
        owner_state: '',
        late_fee_type: 'percent',
        late_fee_value: 0,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    })

    useEffect(() => {
        if (user) fetchProfile()
    }, [user])

    async function fetchProfile() {
        try {
            const { data } = await supabase
                .from('user_settings')
                .select('owner_name, owner_phone, owner_cpf_cnpj, late_fee_type, late_fee_value, owner_cep, owner_street, owner_number, owner_complement, owner_neighborhood, owner_city, owner_state')
                .eq('user_id', user.id)
                .maybeSingle()

            if (data) {
                setFormData(prev => ({
                    ...prev,
                    owner_name: data.owner_name || '',
                    owner_phone: data.owner_phone || '',
                    owner_cpf_cnpj: data.owner_cpf_cnpj || '',
                    owner_cep: data.owner_cep || '',
                    owner_street: data.owner_street || '',
                    owner_number: data.owner_number || '',
                    owner_complement: data.owner_complement || '',
                    owner_neighborhood: data.owner_neighborhood || '',
                    owner_city: data.owner_city || '',
                    owner_state: data.owner_state || '',
                    late_fee_type: data.late_fee_type || 'percent',
                    late_fee_value: data.late_fee_value || 0
                }))
            }
        } catch (error) {
            console.error('Error fetching profile:', error)
        }
    }

    async function handleSaveProfile(e) {
        e.preventDefault()
        try {
            setLoading(true)
            const { error } = await supabase
                .from('user_settings')
                .upsert({
                    user_id: user.id,
                    owner_name: formData.owner_name,
                    owner_phone: formData.owner_phone,
                    owner_cpf_cnpj: formData.owner_cpf_cnpj,
                    owner_cep: formData.owner_cep,
                    owner_street: formData.owner_street,
                    owner_number: formData.owner_number,
                    owner_complement: formData.owner_complement,
                    owner_neighborhood: formData.owner_neighborhood,
                    owner_city: formData.owner_city,
                    owner_state: formData.owner_state,
                    late_fee_type: formData.late_fee_type,
                    late_fee_value: formData.late_fee_value
                }, { onConflict: 'user_id' })

            if (error) throw error
            success('Perfil atualizado com sucesso!')
        } catch (error) {
            console.error('Error saving profile:', error)
            toastError('Erro ao salvar perfil')
        } finally {
            setLoading(false)
        }
    }

    async function handleOwnerCEPLookup(cep) {
        const cleanCEP = cep.replace(/\D/g, '')
        if (cleanCEP.length !== 8) return

        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`)
            const data = await response.json()

            if (!data.erro) {
                setFormData(prev => ({
                    ...prev,
                    owner_street: data.logradouro,
                    owner_neighborhood: data.bairro,
                    owner_city: data.localidade,
                    owner_state: data.uf
                }))
            }
        } catch (error) {
            console.error('Error fetching CEP:', error)
        }
    }

    async function handleChangePassword(e) {
        e.preventDefault()

        if (formData.newPassword !== formData.confirmPassword) {
            toastError('As senhas não coincidem!')
            return
        }

        if (formData.newPassword.length < 6) {
            toastError('A senha deve ter no mínimo 6 caracteres')
            return
        }

        try {
            setLoading(true)
            const { error } = await supabase.auth.updateUser({
                password: formData.newPassword
            })

            if (error) throw error

            success('Senha alterada com sucesso!')
            setFormData(prev => ({
                ...prev,
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            }))
        } catch (error) {
            console.error('Error changing password:', error)
            toastError('Erro ao alterar senha: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-3xl mx-auto space-y-8 pb-12">
            <PageTitle title="Meu Perfil" />
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <User size={24} />
                </div>
                <h2 className="text-2xl font-bold">Configurações da Conta</h2>
            </div>

            <div className="space-y-6">
                {/* Email (Read-only) */}
                <div className="app-card overflow-hidden">
                    <div className="p-6 border-b border-border-light dark:border-border-dark flex items-center gap-2">
                        <Mail size={18} className="text-primary" />
                        <h3 className="font-bold">Email de Acesso</h3>
                    </div>
                    <div className="p-6">
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-border-light dark:border-border-dark">
                            <p className="text-xs font-bold text-text-secondary-light dark:text-text-secondary-dark uppercase tracking-wider mb-1">Email cadastrado</p>
                            <p className="text-lg font-bold">{user?.email}</p>
                        </div>
                    </div>
                </div>

                {/* Profile Info */}
                <div className="app-card overflow-hidden">
                    <div className="p-6 border-b border-border-light dark:border-border-dark flex items-center gap-2">
                        <FileText size={18} className="text-secondary" />
                        <h3 className="font-bold">Dados Pessoais</h3>
                    </div>
                    <form onSubmit={handleSaveProfile} className="p-6 space-y-6">
                        <div className="space-y-2">
                            <label className="app-label">Nome Completo ou Razão Social</label>
                            <input
                                type="text"
                                className="app-input"
                                value={formData.owner_name}
                                onChange={e => setFormData({ ...formData, owner_name: e.target.value })}
                                placeholder="Ex: Locadora Exemplo Ltda"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="app-label">Telefone de Contato</label>
                                <input
                                    type="text"
                                    className="app-input"
                                    value={formData.owner_phone}
                                    onChange={e => setFormData({ ...formData, owner_phone: e.target.value })}
                                    placeholder="(11) 99999-9999"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="app-label">CPF / CNPJ</label>
                                <input
                                    type="text"
                                    className="app-input"
                                    value={formData.owner_cpf_cnpj}
                                    onChange={e => setFormData({ ...formData, owner_cpf_cnpj: e.target.value })}
                                    placeholder="000.000.000-00"
                                />
                            </div>
                        </div>

                        <div className="pt-6 border-t border-border-light dark:border-border-dark space-y-6">
                            <h4 className="font-bold text-sm uppercase tracking-wide text-text-secondary-light flex items-center gap-2">
                                <Info size={16} className="text-primary" />
                                Endereço da Empresa
                            </h4>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <label className="app-label">CEP</label>
                                    <input
                                        type="text"
                                        className="app-input"
                                        placeholder="00000-000"
                                        value={formData.owner_cep}
                                        onChange={e => {
                                            const val = e.target.value
                                            setFormData({ ...formData, owner_cep: val })
                                            if (val.replace(/\D/g, '').length === 8) {
                                                handleOwnerCEPLookup(val)
                                            }
                                        }}
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="app-label">Rua / Logradouro</label>
                                    <input
                                        type="text"
                                        className="app-input"
                                        value={formData.owner_street}
                                        onChange={e => setFormData({ ...formData, owner_street: e.target.value })}
                                        placeholder="Rua Exemplo"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="app-label">Número</label>
                                    <input
                                        type="text"
                                        className="app-input"
                                        value={formData.owner_number}
                                        onChange={e => setFormData({ ...formData, owner_number: e.target.value })}
                                        placeholder="123"
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="app-label">Complemento</label>
                                    <input
                                        type="text"
                                        className="app-input"
                                        value={formData.owner_complement}
                                        onChange={e => setFormData({ ...formData, owner_complement: e.target.value })}
                                        placeholder="Sala 101"
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="app-label">Bairro</label>
                                    <input
                                        type="text"
                                        className="app-input"
                                        value={formData.owner_neighborhood}
                                        onChange={e => setFormData({ ...formData, owner_neighborhood: e.target.value })}
                                        placeholder="Centro"
                                    />
                                </div>
                                <div className="md:col-span-3 space-y-2">
                                    <label className="app-label">Cidade</label>
                                    <input
                                        type="text"
                                        className="app-input"
                                        value={formData.owner_city}
                                        onChange={e => setFormData({ ...formData, owner_city: e.target.value })}
                                        placeholder="São Paulo"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="app-label">Estado (UF)</label>
                                    <input
                                        type="text"
                                        className="app-input"
                                        value={formData.owner_state}
                                        onChange={e => setFormData({ ...formData, owner_state: e.target.value })}
                                        placeholder="SP"
                                        maxLength={2}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-border-light dark:border-border-dark">
                            <h4 className="font-bold mb-4 text-sm uppercase tracking-wide text-text-secondary-light">Configuração de Juros por Atraso</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="app-label">Tipo de Cobrança</label>
                                    <select
                                        className="app-input"
                                        value={formData.late_fee_type}
                                        onChange={e => setFormData({ ...formData, late_fee_type: e.target.value })}
                                    >
                                        <option value="percent">Porcentagem (%) ao dia</option>
                                        <option value="fixed">Valor Fixo (R$) ao dia</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="app-label">Valor do Juros</label>
                                    <input
                                        type="number"
                                        className="app-input"
                                        value={formData.late_fee_value}
                                        onChange={e => setFormData({ ...formData, late_fee_value: e.target.value })}
                                        placeholder="0.00"
                                        min="0"
                                        step="0.01"
                                    />
                                    <p className="text-[10px] text-text-secondary-light dark:text-text-secondary-dark font-medium">
                                        {formData.late_fee_type === 'percent'
                                            ? 'Ex: 1.0 = 1% do valor total por dia de atraso'
                                            : 'Ex: 5.00 = R$ 5,00 por dia de atraso'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full md:w-auto px-8 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <Save size={18} />
                            {loading ? 'Salvando...' : 'Salvar Dados'}
                        </button>
                    </form>
                </div>

                {/* Password Change */}
                <div className="app-card overflow-hidden">
                    <div className="p-6 border-b border-border-light dark:border-border-dark flex items-center gap-2">
                        <Lock size={18} className="text-danger" />
                        <h3 className="font-bold">Segurança</h3>
                    </div>
                    <form onSubmit={handleChangePassword} className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="app-label">Nova Senha</label>
                                <input
                                    type="password"
                                    className="app-input"
                                    value={formData.newPassword}
                                    onChange={e => setFormData({ ...formData, newPassword: e.target.value })}
                                    placeholder="Mínimo 6 caracteres"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="app-label">Confirmar Nova Senha</label>
                                <input
                                    type="password"
                                    className="app-input"
                                    value={formData.confirmPassword}
                                    onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                                    placeholder="Repita a nova senha"
                                />
                            </div>
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full md:w-auto px-8 py-3 border border-danger/30 text-danger hover:bg-danger/5 rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            <Lock size={18} />
                            {loading ? 'Alterando...' : 'Atualizar Senha'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}

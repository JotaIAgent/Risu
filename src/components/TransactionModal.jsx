
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from './Modal'
import { format } from 'date-fns'
import { Save } from 'lucide-react'
import { useDialog } from './DialogProvider'

export default function TransactionModal({ isOpen, onClose, onSuccess, accounts = [] }) {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const { success, error: toastError } = useDialog()
    const [formData, setFormData] = useState({
        type: 'expense',
        category: 'Contas',
        amount: '',
        description: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        account_id: '',
        related_account_id: '',
        item_id: null
    })

    const categories = {
        income: ['Serviço Extra', 'Venda de Item', 'Caução', 'Outros'],
        expense: ['Contas', 'Manutenção', 'Compra de Produtos', 'Marketing', 'Impostos', 'Caução', 'Outros'],
        transfer: ['Transferência']
    }

    // Reset/Init form when opening
    useEffect(() => {
        if (isOpen && accounts.length > 0) {
            const defaultAcc = accounts.find(a => a.is_default) || accounts[0]
            setFormData(prev => ({
                ...prev,
                account_id: prev.account_id || defaultAcc?.id || '',
                date: format(new Date(), 'yyyy-MM-dd')
            }))
        }
    }, [isOpen, accounts])

    async function handleSubmit(e) {
        e.preventDefault()
        try {
            setLoading(true)

            if (formData.type === 'transfer') {
                if (!formData.related_account_id) return toastError('Selecione a conta de destino')
                if (formData.account_id === formData.related_account_id) return toastError('A conta de origem e destino devem ser diferentes')
            }

            const payload = {
                user_id: user.id,
                type: formData.type,
                category: formData.type === 'transfer' ? 'Transferência' : formData.category,
                amount: parseFloat(formData.amount),
                description: formData.description,
                date: formData.date,
                account_id: formData.account_id,
                related_account_id: formData.type === 'transfer' ? formData.related_account_id : null,
                item_id: formData.item_id
            }

            const { error } = await supabase
                .from('financial_transactions')
                .insert([payload])

            if (error) throw error

            success('Transação registrada com sucesso!')
            onSuccess()
            onClose()
            // Reset form
            setFormData({
                type: 'expense',
                category: 'Contas',
                amount: '',
                description: '',
                date: format(new Date(), 'yyyy-MM-dd'),
                account_id: accounts.find(a => a.is_default)?.id || accounts[0]?.id || '',
                related_account_id: '',
                item_id: null
            })

        } catch (error) {
            console.error('Error adding transaction:', error)
            toastError('Erro ao adicionar transação')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Nova Transação"
            maxWidth="600px"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="app-label">Tipo</label>
                        <select
                            value={formData.type}
                            onChange={e => setFormData({ ...formData, type: e.target.value, category: categories[e.target.value] ? categories[e.target.value][0] : '' })}
                            className="app-input w-full"
                        >
                            <option value="income">Receita</option>
                            <option value="expense">Despesa</option>
                            <option value="transfer">Transferência</option>
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="app-label">Data</label>
                        <input
                            type="date"
                            value={formData.date}
                            onChange={e => setFormData({ ...formData, date: e.target.value })}
                            onClick={(e) => { try { e.target.showPicker() } catch (error) { } }}
                            className="app-input w-full"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="app-label">{formData.type === 'transfer' ? 'Conta de Origem' : 'Conta'}</label>
                        <select
                            value={formData.account_id}
                            onChange={e => {
                                const newAccountId = e.target.value
                                const selectedAcc = accounts.find(a => a.id === newAccountId)
                                let newCategory = formData.category

                                // Auto-select 'Caução' if account is Deposit Fund
                                if (selectedAcc?.type === 'deposit_fund' || selectedAcc?.name === 'Fundo Caução') {
                                    newCategory = 'Caução'
                                }

                                setFormData({ ...formData, account_id: newAccountId, category: newCategory })
                            }}
                            className="app-input w-full"
                            required
                        >
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                            ))}
                        </select>
                    </div>

                    {formData.type === 'transfer' ? (
                        <div className="space-y-2">
                            <label className="app-label">Conta de Destino</label>
                            <select
                                value={formData.related_account_id}
                                onChange={e => setFormData({ ...formData, related_account_id: e.target.value })}
                                className="app-input w-full"
                                required
                            >
                                <option value="">Selecione...</option>
                                {accounts.filter(a => a.id !== formData.account_id).map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <label className="app-label">Categoria</label>
                            <select
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                className="app-input w-full"
                            >
                                {categories[formData.type]?.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="app-label">Descrição</label>
                    <input
                        type="text"
                        value={formData.description}
                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                        className="app-input w-full"
                        placeholder="Ex: Conta de Luz"
                        required
                    />
                </div>

                <div className="space-y-2">
                    <label className="app-label">Valor (R$)</label>
                    <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={formData.amount}
                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                        className="app-input w-full text-lg font-bold"
                        placeholder="0,00"
                        required
                    />
                </div>

                <div className="pt-4 flex gap-3">
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 bg-primary hover:bg-primary-hover text-white py-3 rounded-xl font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? 'Salvando...' : (
                            <>
                                <Save size={18} />
                                Salvar Transação
                            </>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 border border-border-light dark:border-border-dark hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-bold transition-all text-text-secondary-light"
                    >
                        Cancelar
                    </button>
                </div>
            </form>
        </Modal>
    )
}

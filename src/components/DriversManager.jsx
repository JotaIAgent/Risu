import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Plus, X, Trash2, User, Phone, FileText, Check, AlertCircle, Pencil } from 'lucide-react'
import { useDialog } from './DialogProvider'

export default function DriversManager({ isOpen, onClose }) {
    const [drivers, setDrivers] = useState([])
    const [loading, setLoading] = useState(true)
    const [isAdding, setIsAdding] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [driverForm, setDriverForm] = useState({ name: '', cpf: '', phone: '' })
    const { confirm, alert: dialogAlert, success, error: toastError } = useDialog()

    useEffect(() => {
        if (isOpen) {
            fetchDrivers()
            cancelForm()
        }
    }, [isOpen])

    async function fetchDrivers() {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('drivers')
                .select('*')
                .order('name')

            if (data) setDrivers(data)
        } catch (error) {
            console.error('Error fetching drivers:', error)
        } finally {
            setLoading(false)
        }
    }

    function cancelForm() {
        setIsAdding(false)
        setEditingId(null)
        setDriverForm({ name: '', cpf: '', phone: '' })
    }

    function startAdd() {
        setDriverForm({ name: '', cpf: '', phone: '' })
        setEditingId(null)
        setIsAdding(true)
    }

    function startEdit(driver) {
        setDriverForm({ name: driver.name, cpf: driver.cpf, phone: driver.phone })
        setEditingId(driver.id)
        setIsAdding(false)
    }

    async function handleSave() {
        if (!driverForm.name) {
            toastError('O nome do motorista é obrigatório')
            return
        }

        try {
            const { data: { user } } = await supabase.auth.getUser()

            let error

            if (editingId) {
                // Update
                const { error: updateError } = await supabase
                    .from('drivers')
                    .update({
                        name: driverForm.name,
                        cpf: driverForm.cpf,
                        phone: driverForm.phone
                    })
                    .eq('id', editingId)
                error = updateError
            } else {
                // Insert
                const { error: insertError } = await supabase
                    .from('drivers')
                    .insert([{
                        ...driverForm,
                        user_id: user.id
                    }])
                error = insertError
            }

            if (error) throw error

            success(`Motorista ${editingId ? 'atualizado' : 'cadastrado'} com sucesso!`)
            cancelForm()
            fetchDrivers()
        } catch (error) {
            console.error('Error saving driver:', error)
            toastError('Erro ao salvar motorista')
        }
    }

    async function handleDelete(id) {
        if (!await confirm('Tem certeza que deseja remover este motorista?', 'Excluir Motorista')) return

        try {
            const { error } = await supabase
                .from('drivers')
                .delete()
                .eq('id', id)

            if (error) throw error
            success('Motorista removido com sucesso!')
            fetchDrivers()
        } catch (error) {
            console.error('Error deleting driver:', error)
            toastError('Erro ao excluir motorista')
        }
    }

    if (!isOpen) return null

    const showForm = isAdding || editingId

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-4 border-b border-border-light dark:border-border-dark flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <User className="text-primary" size={20} />
                        Gerenciar Motoristas
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {loading && <p className="text-center py-4 opacity-50">Carregando...</p>}

                    {!loading && drivers.length === 0 && !showForm && (
                        <div className="text-center py-8 opacity-50 space-y-2">
                            <User size={32} className="mx-auto" />
                            <p>Nenhum motorista cadastrado</p>
                        </div>
                    )}

                    {!loading && drivers.map(driver => (
                        <div key={driver.id} className={`p-3 bg-white dark:bg-slate-800 border border-border-light dark:border-border-dark rounded-xl flex items-center justify-between group ${editingId === driver.id ? 'ring-2 ring-primary border-transparent' : ''}`}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                    {driver.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-bold text-sm">{driver.name}</p>
                                    <div className="flex items-center gap-2 text-xs text-text-secondary-light">
                                        {driver.phone && (
                                            <span className="flex items-center gap-1">
                                                <Phone size={10} /> {driver.phone}
                                            </span>
                                        )}
                                        {driver.cpf && (
                                            <span className="flex items-center gap-1">
                                                <FileText size={10} /> {driver.cpf}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all">
                                <button
                                    onClick={() => startEdit(driver)}
                                    className="p-2 text-primary hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                                    title="Editar"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(driver.id)}
                                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                    title="Excluir"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer / Add Form */}
                <div className="p-4 border-t border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-800/50">
                    {showForm ? (
                        <div className="space-y-3 animate-in slide-in-from-bottom-2">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold uppercase text-text-secondary-light">
                                    {editingId ? 'Editar Motorista' : 'Novo Motorista'}
                                </span>
                            </div>
                            <input
                                autoFocus
                                className="app-input"
                                placeholder="Nome do Motorista *"
                                value={driverForm.name}
                                onChange={e => setDriverForm({ ...driverForm, name: e.target.value })}
                            />
                            <div className="flex gap-2">
                                <input
                                    className="app-input"
                                    placeholder="CPF"
                                    value={driverForm.cpf}
                                    onChange={e => setDriverForm({ ...driverForm, cpf: e.target.value })}
                                />
                                <input
                                    className="app-input"
                                    placeholder="Telefone"
                                    value={driverForm.phone}
                                    onChange={e => setDriverForm({ ...driverForm, phone: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-2 justify-end pt-2">
                                <button
                                    onClick={cancelForm}
                                    className="app-button-secondary text-xs"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="app-button-primary text-xs flex items-center gap-2"
                                >
                                    <Check size={14} /> Salvar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={startAdd}
                            className="w-full py-3 border-2 border-dashed border-primary/30 text-primary hover:bg-primary/5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all"
                        >
                            <Plus size={20} />
                            Adicionar Motorista
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

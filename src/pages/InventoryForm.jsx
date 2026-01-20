
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Upload } from 'lucide-react'
import { useDialog } from '../components/DialogProvider'

export default function InventoryForm() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const { success, error: toastError, alert } = useDialog()

    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        photo_url: '',
        daily_price: '',
        total_quantity: 1,
        maintenance_quantity: 0,
        lost_quantity: 0,
        broken_quantity: 0,
        lost_fine: '',
        damage_fine: ''
    })

    useEffect(() => {
        if (id) {
            loadItem()
        }
    }, [id])

    async function loadItem() {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('items')
                .select('*')
                .eq('id', id)
                .single()

            if (error) throw error
            if (data) setFormData({
                name: data.name,
                photo_url: data.photo_url || '',
                daily_price: data.daily_price,
                total_quantity: data.total_quantity || 1,
                maintenance_quantity: data.maintenance_quantity || 0,
                lost_quantity: data.lost_quantity || 0,
                broken_quantity: data.broken_quantity || 0,
                lost_fine: data.lost_fine || '',
                damage_fine: data.damage_fine || ''
            })
        } catch (error) {
            console.error('Error loading item:', error)
            toastError('Erro ao carregar dados do item')
            navigate('/inventory')
        } finally {
            setLoading(false)
        }
    }

    async function handleImageUpload(event) {
        try {
            setUploading(true)
            const file = event.target.files[0]
            if (!file) {
                toastError('Selecione um arquivo primeiro.')
                return
            }

            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random()}.${fileExt}`
            const filePath = `${user.id}/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('inventory')
                .upload(filePath, file)

            if (uploadError) {
                throw uploadError
            }

            const { data } = supabase.storage.from('inventory').getPublicUrl(filePath)

            setFormData(prev => ({ ...prev, photo_url: data.publicUrl }))
        } catch (error) {
            console.error('Error uploading image:', error)
            toastError('Erro ao fazer upload da imagem')
        } finally {
            setUploading(false)
        }
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (!user) return

        try {
            setLoading(true)
            const itemData = {
                name: formData.name,
                photo_url: formData.photo_url || null,
                daily_price: parseFloat(formData.daily_price),
                total_quantity: parseInt(formData.total_quantity) || 1,
                maintenance_quantity: parseInt(formData.maintenance_quantity) || 0,
                lost_quantity: parseInt(formData.lost_quantity) || 0,
                broken_quantity: parseInt(formData.broken_quantity) || 0,
                lost_fine: parseFloat(formData.lost_fine) || 0,
                damage_fine: parseFloat(formData.damage_fine) || 0,
                user_id: user.id
            }

            if (id) {
                // Fetch current item state to calculate deltas
                const { data: currentItem, error: fetchError } = await supabase
                    .from('items')
                    .select('maintenance_quantity, lost_quantity, broken_quantity')
                    .eq('id', id)
                    .single()

                if (fetchError) throw fetchError

                const { error: updateError } = await supabase
                    .from('items')
                    .update(itemData)
                    .eq('id', id)

                if (updateError) throw updateError

                // Create deltas/logs if quantities increased
                const deltas = [
                    { type: 'maintenance', field: 'maintenance_quantity', table: 'maintenance_logs', current: currentItem.maintenance_quantity || 0, new: itemData.maintenance_quantity },
                    { type: 'lost', field: 'lost_quantity', table: 'lost_logs', current: currentItem.lost_quantity || 0, new: itemData.lost_quantity },
                    { type: 'broken', field: 'broken_quantity', table: 'broken_logs', current: currentItem.broken_quantity || 0, new: itemData.broken_quantity }
                ]

                for (const delta of deltas) {
                    const diff = delta.new - delta.current
                    if (diff > 0) {
                        // Log the manual increase
                        await supabase.from(delta.table).insert({
                            item_id: id,
                            user_id: user.id,
                            quantity: diff,
                            status: 'OPEN',
                            // Add a note about manual adjustment if possible (schema pending, but standard fields work)
                        })
                    }
                }
            } else {
                const { error } = await supabase
                    .from('items')
                    .insert([itemData])
                if (error) throw error
            }

            success(id ? 'Item atualizado com sucesso!' : 'Item cadastrado com sucesso!')
            navigate('/inventory')
        } catch (error) {
            console.error('Error saving item:', error)
            toastError('Erro ao salvar item')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-xl mx-auto space-y-8 pb-12">
            <div>
                <h2 className="text-2xl font-black tracking-tight text-text-primary-light dark:text-text-primary-dark uppercase">
                    {id ? 'Editar Produto' : 'Novo Produto'}
                </h2>
                <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm font-medium mt-1">Gerencie os detalhes do item no seu catálogo.</p>
            </div>

            <form onSubmit={handleSubmit} className="app-card p-6 md:p-8 space-y-6">
                <div className="space-y-4">
                    <label className="app-label">Foto do Produto</label>
                    <div className="flex flex-col md:flex-row gap-6 items-center">
                        <div className="w-32 h-32 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-2 border-dashed border-border-light dark:border-border-dark flex items-center justify-center relative overflow-hidden group">
                            {formData.photo_url ? (
                                <img
                                    src={formData.photo_url}
                                    alt="Preview"
                                    className="w-full h-full object-contain p-2 transition-transform group-hover:scale-110"
                                    onError={(e) => { e.target.style.display = 'none' }}
                                />
                            ) : (
                                <div className="text-text-secondary-light/30">
                                    <Upload size={32} strokeWidth={1} />
                                </div>
                            )}
                            {uploading && (
                                <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex items-center justify-center">
                                    <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                </div>
                            )}
                        </div>

                        <div className="flex-1 space-y-3 w-full">
                            <label className="w-full flex items-center justify-center gap-2 py-3 bg-secondary hover:bg-secondary/90 text-white rounded-xl font-bold transition-all cursor-pointer shadow-lg shadow-secondary/20">
                                <Upload size={18} />
                                <span>{uploading ? 'Enviando...' : 'Carregar Imagem'}</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                    className="hidden"
                                    disabled={uploading}
                                />
                            </label>
                            <input
                                type="text"
                                className="app-input text-xs"
                                value={formData.photo_url}
                                onChange={e => setFormData({ ...formData, photo_url: e.target.value })}
                                placeholder="Ou cole a URL da imagem externa"
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="app-label" htmlFor="name">Nome do Produto</label>
                    <input
                        id="name"
                        type="text"
                        className="app-input font-bold uppercase tracking-tight"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                        required
                        placeholder="Ex: CADEIRA PLÁSTICA BRANCA"
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="app-label" htmlFor="daily_price">Preço da Diária</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary-light font-bold text-sm">R$</span>
                            <input
                                id="daily_price"
                                type="number"
                                step="0.01"
                                min="0"
                                className="app-input pl-12 font-black text-primary tabular-nums"
                                value={formData.daily_price}
                                onChange={e => setFormData({ ...formData, daily_price: e.target.value })}
                                required
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="app-label text-orange-500" htmlFor="damage_fine">Multa Avaria (Quebra)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500 font-bold text-sm">R$</span>
                            <input
                                id="damage_fine"
                                type="number"
                                step="0.01"
                                min="0"
                                className="app-input pl-12 font-black text-orange-500 tabular-nums border-orange-500/20 focus:border-orange-500 focus:ring-orange-500/20"
                                value={formData.damage_fine}
                                onChange={e => setFormData({ ...formData, damage_fine: e.target.value })}
                                placeholder="0.00"
                            />
                        </div>
                        <p className="text-[9px] text-text-secondary-light font-bold uppercase tracking-wider mt-1">Cobrado se o item voltar quebrado.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="app-label text-danger" htmlFor="lost_fine">Multa Perda (Reposição)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-danger font-bold text-sm">R$</span>
                            <input
                                id="lost_fine"
                                type="number"
                                step="0.01"
                                min="0"
                                className="app-input pl-12 font-black text-danger tabular-nums border-danger/20 focus:border-danger focus:ring-danger/20"
                                value={formData.lost_fine}
                                onChange={e => setFormData({ ...formData, lost_fine: e.target.value })}
                                placeholder="0.00"
                            />
                        </div>
                        <p className="text-[9px] text-text-secondary-light font-bold uppercase tracking-wider mt-1">Cobrado se o item não voltar.</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="app-label" htmlFor="total_quantity">Estoque Total</label>
                        <input
                            id="total_quantity"
                            type="number"
                            min="1"
                            className="app-input font-black tabular-nums"
                            value={formData.total_quantity}
                            onChange={e => setFormData({ ...formData, total_quantity: e.target.value })}
                            required
                            placeholder="Ex: 100"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="app-label flex items-center gap-2" htmlFor="maintenance_quantity">
                            <span>Em Manutenção</span>
                        </label>
                        <input
                            id="maintenance_quantity"
                            type="number"
                            min="0"
                            className="app-input border-warning/20 bg-warning/[0.02] font-black tabular-nums text-warning hover:bg-warning/[0.05] focus:bg-warning/[0.05] transition-colors"
                            value={formData.maintenance_quantity}
                            onChange={e => setFormData({ ...formData, maintenance_quantity: e.target.value })}
                            placeholder="0"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="app-label flex items-center gap-2" htmlFor="lost_quantity">
                            <span>Perdido / Baixado</span>
                        </label>
                        <input
                            id="lost_quantity"
                            type="number"
                            min="0"
                            className="app-input border-danger/20 bg-danger/[0.02] font-black tabular-nums text-danger hover:bg-danger/[0.05] focus:bg-danger/[0.05] transition-colors"
                            value={formData.lost_quantity}
                            onChange={e => setFormData({ ...formData, lost_quantity: e.target.value })}
                            placeholder="0"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="app-label flex items-center gap-2" htmlFor="broken_quantity">
                            <span>Avariado (Quebrado)</span>
                        </label>
                        <input
                            id="broken_quantity"
                            type="number"
                            min="0"
                            className="app-input border-orange-500/20 bg-orange-500/[0.02] font-black tabular-nums text-orange-500 hover:bg-orange-500/[0.05] focus:bg-orange-500/[0.05] transition-colors"
                            value={formData.broken_quantity}
                            onChange={e => setFormData({ ...formData, broken_quantity: e.target.value })}
                            placeholder="0"
                        />
                    </div>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-border-light dark:border-border-dark">
                    <p className="text-[10px] text-text-secondary-light font-medium leading-relaxed">
                        <strong className="text-primary uppercase tracking-widest mr-1">Nota:</strong>
                        Para ajustar as quantidades em manutenção ou perdas, utilize os <strong>Ajustes Rápidos</strong> na página de detalhes do item. Isso garante que o histórico seja registrado corretamente.
                    </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-border-light dark:border-border-dark space-y-2">
                    <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-text-secondary-light">
                        <span>Resumo de Disponibilidade</span>
                        <span className="text-primary">
                            Capacidade: {Math.max(0, formData.total_quantity - (parseInt(formData.maintenance_quantity || 0) + parseInt(formData.lost_quantity || 0) + parseInt(formData.broken_quantity || 0)))}
                        </span>
                    </div>
                    <p className="text-[10px] text-text-secondary-light/60 dark:text-text-secondary-dark/60">
                        Itens em manutenção ou perdidos são subtraídos da capacidade total de locação do sistema.
                    </p>
                </div>

                <div className="flex flex-col md:flex-row gap-4 pt-4">
                    <button
                        type="submit"
                        className="bg-primary hover:bg-primary-hover text-white py-4 px-8 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-primary/30 transition-all disabled:opacity-50 flex-1"
                        disabled={loading || uploading}
                    >
                        {loading ? 'Salvando...' : (id ? 'Atualizar Produto' : 'Cadastrar Produto')}
                    </button>
                    <button
                        type="button"
                        className="border border-border-light dark:border-border-dark hover:bg-slate-50 dark:hover:bg-slate-800 py-4 px-8 rounded-2xl font-bold transition-all"
                        onClick={() => navigate('/inventory')}
                    >
                        Cancelar
                    </button>
                </div>
            </form>
        </div>
    )
}

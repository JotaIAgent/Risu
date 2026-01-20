import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { X, Camera, Check, AlertTriangle, Trash2, Loader2, Package, Search } from 'lucide-react'
import { useDialog } from '../components/DialogProvider'

export default function RentalChecklistModal({ isOpen, onClose, onConfirm, rental, type = 'CHECKOUT' }) {
    const [loading, setLoading] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [items, setItems] = useState([])
    const [photos, setPhotos] = useState([])
    const { success, error: toastError, confirm } = useDialog()

    useEffect(() => {
        if (isOpen && rental) {
            // Load items from rental_items
            const initialItems = rental.rental_items.map(ri => ({
                id: ri.id,
                item_id: ri.item_id,
                name: ri.items?.name || 'Item desconhecido',
                photo_url: ri.items?.photo_url,
                totalQuantity: ri.quantity, // Keep total reference
                lost_fine: parseFloat(ri.items?.lost_fine) || 0,
                damage_fine: parseFloat(ri.items?.damage_fine) || 0,
                quantities: { // Track split
                    OK: ri.quantity,
                    DIRTY: 0,
                    INCOMPLETE: 0,
                    BROKEN: 0
                },
                observations: ''
            }))
            setItems(initialItems)
            setPhotos([])
            setSearchTerm('')
        }
    }, [isOpen, rental])

    if (!isOpen) return null

    const handleQuantityChange = (itemId, type, value) => {
        const qty = parseInt(value) || 0
        setItems(prev => prev.map(item => {
            if (item.id !== itemId) return item

            // Calculate new OK based on others
            // type is one of: DIRTY, INCOMPLETE, BROKEN
            const currentSplit = { ...item.quantities }

            // If changing one bad status, we adjust OK
            if (type !== 'OK') {
                const otherBadSum = Object.entries(currentSplit)
                    .filter(([key]) => key !== 'OK' && key !== type)
                    .reduce((sum, [_, q]) => sum + q, 0)

                const newBadTotal = otherBadSum + qty
                const newOK = item.totalQuantity - newBadTotal

                if (newOK < 0) return item // Prevent negative OK

                return {
                    ...item,
                    quantities: {
                        ...item.quantities,
                        [type]: qty,
                        OK: newOK
                    }
                }
            }
            return item
        }))
    }

    const handleObservationChange = (itemId, observations) => {
        setItems(prev => prev.map(item =>
            item.id === itemId ? { ...item, observations } : item
        ))
    }

    const handlePhotoUpload = async (e) => {
        const files = Array.from(e.target.files)
        if (files.length === 0) return

        setUploading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()

            for (const file of files) {
                const fileExt = file.name.split('.').pop()
                const fileName = `${rental.id}/${type.toLowerCase()}/${Math.random()}.${fileExt}`

                const { error: uploadError } = await supabase.storage
                    .from('rental-evidence')
                    .upload(fileName, file)

                if (uploadError) throw uploadError

                const { data } = supabase.storage
                    .from('rental-evidence')
                    .getPublicUrl(fileName)

                setPhotos(prev => [...prev, { url: data.publicUrl, fileName }])
            }
        } catch (error) {
            console.error('Error uploading photos:', error)
            toastError('Erro ao enviar fotos.')
        } finally {
            setUploading(false)
        }
    }

    const removePhoto = async (photoToDelete) => {
        try {
            const { error } = await supabase.storage
                .from('rental-evidence')
                .remove([photoToDelete.fileName])

            if (error) throw error
            setPhotos(prev => prev.filter(p => p.url !== photoToDelete.url))
        } catch (error) {
            console.error('Error removing photo:', error)
        }
    }

    // REDEFINING handleSave to handle split
    const handleSave = async () => {
        setLoading(true)
        try {
            const { data: { user } } = await supabase.auth.getUser()

            // 1. Save Checklists (Flatten splits)
            const checklistEntries = items.flatMap(item => {
                const entries = []

                // Add OK entry if > 0
                if (item.quantities.OK > 0) {
                    entries.push({
                        rental_id: rental.id,
                        item_id: item.item_id,
                        rental_item_id: item.id,
                        stage: type,
                        status: 'OK',
                        observations: item.observations, // Share observation? Or only for bad? User said "janela de obs" remains.
                        quantity: item.quantities.OK,
                        user_id: user.id
                    })
                }

                // Add Bad entries
                ['DIRTY', 'INCOMPLETE', 'BROKEN'].forEach(status => {
                    if (item.quantities[status] > 0) {
                        entries.push({
                            rental_id: rental.id,
                            item_id: item.item_id,
                            rental_item_id: item.id,
                            stage: type,
                            status: status,
                            observations: item.observations,
                            quantity: item.quantities[status],
                            user_id: user.id
                        })
                    }
                })

                return entries
            })

            const { error: checklistError } = await supabase
                .from('rental_checklists')
                .insert(checklistEntries)

            if (checklistError) throw checklistError

            // 2. Save Photos (unchanged)
            if (photos.length > 0) {
                const photoEntries = photos.map(p => ({
                    rental_id: rental.id,
                    stage: type,
                    photo_url: p.url,
                    user_id: user.id
                }))

                const { error: photoError } = await supabase
                    .from('rental_photos')
                    .insert(photoEntries)

                if (photoError) throw photoError
            }

            // 3. Update status (unchanged)
            if (type === 'CHECKOUT') {
                const { error: rentalError } = await supabase
                    .from('rentals')
                    .update({ status: 'in_progress' })
                    .eq('id', rental.id)
                if (rentalError) throw rentalError
            }

            success(`${type === 'CHECKOUT' ? 'Saída' : 'Retorno'} confirmado com sucesso!`)
            onConfirm()
            onClose()
        } catch (error) {
            console.error('Error saving checklist:', error)
            // Try to alert detailed error if available from PostgREST
            toastError(`Erro ao salvar checklist: ${error.message || JSON.stringify(error) || 'Consulte o console.'}`)
        } finally {
            setLoading(false)
        }
    }

    const filteredItems = items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()))

    // Calculate Fines
    const totalFines = items.reduce((acc, item) => {
        const lostCost = (item.quantities.INCOMPLETE || 0) * item.lost_fine
        const brokenCost = (item.quantities.BROKEN || 0) * item.damage_fine
        return acc + lostCost + brokenCost
    }, 0)

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-950 w-full max-w-4xl max-h-[90vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col border border-white/20">

                {/* Header */}
                <div className="p-6 md:p-8 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white dark:from-slate-900 dark:to-slate-950">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-2xl ${type === 'CHECKOUT' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'}`}>
                            <Package size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl md:text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                {type === 'CHECKOUT' ? 'Checklist de Saída' : 'Checklist de Retorno'}
                            </h3>
                            <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm font-medium">Verifique o estado dos itens antes de prosseguir.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
                        <X size={24} className="text-slate-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">

                    {/* Search */}
                    <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                            <Search size={18} />
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar item..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 focus:ring-2 focus:ring-primary/20 outline-none transition-all font-medium"
                        />
                    </div>

                    {/* Items List */}
                    <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Conferência de Itens</h4>

                        {filteredItems.map(item => (
                            <div key={item.id} className="p-5 md:p-6 bg-slate-50 dark:bg-slate-900/40 rounded-[24px] border border-slate-200 dark:border-slate-800 space-y-4 group transition-all hover:border-primary/30">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 flex items-center justify-center font-black text-primary shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden relative">
                                            {item.photo_url ? (
                                                <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="text-sm">{item.quantity}</span>
                                            )}
                                        </div>
                                        <span className="font-bold text-slate-900 dark:text-white uppercase text-sm tracking-tight">{item.name}</span>
                                        {item.photo_url && (
                                            <span className="text-xs font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">{item.quantity} un.</span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3 overflow-x-auto pb-2">
                                        {/* OK (Calculated) */}
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-[9px] font-black text-slate-400 uppercase">OK</span>
                                            <div className="w-14 h-10 flex items-center justify-center bg-secondary/10 text-secondary font-bold rounded-xl border border-secondary/20">
                                                {item.quantities.OK}
                                            </div>
                                        </div>

                                        {/* Others (Editable) */}
                                        {[
                                            { id: 'DIRTY', label: 'SUJO', color: 'focus:ring-warning text-warning' },
                                            { id: 'INCOMPLETE', label: 'INC.', color: 'focus:ring-orange-500 text-orange-500' },
                                            { id: 'BROKEN', label: 'AVARIA', color: 'focus:ring-danger text-danger' }
                                        ].map(status => (
                                            <div key={status.id} className="flex flex-col items-center gap-1">
                                                <span className="text-[9px] font-black text-slate-400 uppercase">{status.label}</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={item.quantities[status.id] || ''}
                                                    onChange={(e) => handleQuantityChange(item.id, status.id, e.target.value)}
                                                    className={`w-14 h-10 text-center font-bold bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:ring-2 transition-all ${status.color}`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <input
                                    type="text"
                                    placeholder="Observações (opcional)..."
                                    value={item.observations}
                                    onChange={(e) => handleObservationChange(item.id, e.target.value)}
                                    className="w-full px-4 py-3 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                                />
                            </div>
                        ))}
                    </div>

                    {/* Photos */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 px-1">Registro Fotográfico</h4>
                            <label className="cursor-pointer px-4 py-2 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:opacity-90 transition-all shadow-lg active:scale-95">
                                <Camera size={14} />
                                Anexar Fotos
                                <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploading} />
                            </label>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                            {photos.map((photo, idx) => (
                                <div key={idx} className="relative group aspect-square rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                                    <img src={photo.url} alt={`Evidence ${idx}`} className="w-full h-full object-cover" />
                                    <button
                                        onClick={() => removePhoto(photo)}
                                        className="absolute top-2 right-2 p-1.5 bg-danger text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-110"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                            {uploading && (
                                <div className="aspect-square rounded-2xl border border-dashed border-primary/30 flex items-center justify-center animate-pulse bg-primary/5">
                                    <Loader2 size={24} className="text-primary animate-spin" />
                                </div>
                            )}
                            {photos.length === 0 && !uploading && (
                                <div className="col-span-full py-8 text-center bg-slate-50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nenhuma foto anexada</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 md:p-8 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-4">
                    {totalFines > 0 && (
                        <div className="flex items-center justify-between p-4 bg-danger/5 border border-danger/10 rounded-2xl">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="text-danger" size={24} />
                                <div>
                                    <h4 className="font-black text-danger uppercase text-sm">Multas Aplicáveis</h4>
                                    <p className="text-[10px] font-bold text-danger/60 uppercase tracking-widest">Baseado nos itens avariados ou perdidos</p>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="block text-2xl font-black text-danger tabular-nums tracking-tighter">R$ {totalFines.toFixed(2)}</span>
                            </div>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-4">
                        <button
                            onClick={onClose}
                            className="px-8 py-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-2xl font-bold transition-all border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 flex-1"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading || uploading}
                            className={`px-12 py-4 rounded-2xl font-black uppercase tracking-[0.1em] shadow-xl transition-all flex-[2] flex items-center justify-center gap-3 active:scale-[0.98] ${type === 'CHECKOUT'
                                ? 'bg-primary text-white shadow-primary/20 hover:bg-primary-hover'
                                : 'bg-secondary text-white shadow-secondary/20 hover:bg-secondary-hover'
                                }`}
                        >
                            {loading ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
                            {loading ? 'Processando...' : `Confirmar ${type === 'CHECKOUT' ? 'Saída (Entrega)' : 'Retorno (Recebimento)'}`}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

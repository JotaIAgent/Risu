import { useState, useEffect } from 'react'
import { X, AlertTriangle, CheckCircle, Wrench, PackageX, Hammer, Sparkles, Box } from 'lucide-react'
import { useDialog } from './DialogProvider'

export default function RentalReturnModal({ isOpen, onClose, onConfirm, rental }) {
    const [itemsState, setItemsState] = useState([])
    const [observations, setObservations] = useState('')
    const [damageFee, setDamageFee] = useState(0)
    const [isManualFee, setIsManualFee] = useState(false)
    const { alert: dialogAlert, success, error: toastError } = useDialog()

    useEffect(() => {
        if (isOpen && rental) {
            const initialItems = (rental.rental_items || []).map(ri => ({
                id: ri.id,
                item_id: ri.item_id,
                name: ri.items?.name || 'Item desconhecido',
                photo_url: ri.items?.photo_url,
                total: ri.quantity,
                returned: ri.quantity,
                dirty: 0,
                incomplete: 0,
                maintenance: 0,
                lost: 0,
                broken: 0,
                observations: '', // Per item observation
                replacement_value: 0, // Deprecated
                lost_fine: parseFloat(ri.items?.lost_fine) || 0,
                damage_fine: parseFloat(ri.items?.damage_fine) || 0
            }))
            setItemsState(initialItems)
            setObservations('')
            setDamageFee(0)
            setIsManualFee(false)
        }
    }, [isOpen, rental])

    // Auto-calculate fine when itemsState changes
    useEffect(() => {
        if (isManualFee) return

        const calculatedFine = itemsState.reduce((sum, item) => {
            const lostCost = (item.lost || 0) * item.lost_fine
            const brokenCost = (item.broken || 0) * item.damage_fine
            return sum + lostCost + brokenCost
        }, 0)
        setDamageFee(calculatedFine)
    }, [itemsState, isManualFee])

    if (!isOpen) return null

    function handleQuantityChange(index, field, value) {
        // If updating observations, just set it
        if (field === 'observations') {
            setItemsState(prev => {
                const newState = [...prev]
                newState[index] = { ...newState[index], observations: value }
                return newState
            })
            return
        }

        const newValue = parseInt(value) || 0
        if (newValue < 0) return

        setItemsState(prev => {
            const newState = [...prev]
            const item = { ...newState[index] }

            // Logic: 'returned' is remaining balance
            if (field !== 'returned') {
                // Calculate potential new sum of BAD statuses
                const badStatuses = ['lost', 'broken', 'maintenance', 'dirty', 'incomplete']
                const currentBadTotal = badStatuses
                    .filter(f => f !== field)
                    .reduce((sum, f) => sum + (item[f] || 0), 0)

                const newBadTotal = currentBadTotal + newValue

                // If newBadTotal > total, we clamp the input value
                if (newBadTotal > item.total) {
                    item[field] = Math.max(0, item.total - currentBadTotal)
                    item.returned = 0
                } else {
                    item[field] = newValue
                    item.returned = item.total - newBadTotal
                }
            } else {
                // Read-only logic provided consistency
                return newState
            }

            newState[index] = item
            return newState
        })
    }

    function handleSubmit() {
        const isValid = itemsState.every(item => {
            const sum = item.returned + item.lost + item.broken + item.maintenance + item.dirty + item.incomplete
            return sum === item.total
        })

        if (!isValid) {
            toastError('Por favor, distribua corretamente a quantidade total de todos os itens.')
            return
        }

        onConfirm(itemsState, observations, damageFee)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface-light dark:bg-surface-dark w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-border-light dark:border-border-dark">

                {/* Header */}
                <div className="p-6 border-b border-border-light dark:border-border-dark flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight text-text-primary-light dark:text-text-primary-dark flex items-center gap-2">
                            <CheckCircle className="text-secondary" />
                            Conclusão de Aluguel
                        </h2>
                        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark font-medium">
                            Conferência de itens e registro de avarias/limpeza.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors text-text-secondary-light dark:text-text-secondary-dark">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    <div className="space-y-6">
                        {itemsState.map((item, idx) => (
                            <div key={idx} className="app-card p-4 border border-border-light dark:border-border-dark shadow-sm hover:border-primary/20 transition-all">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-center font-black text-primary shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden relative">
                                                {item.photo_url ? (
                                                    <img src={item.photo_url} alt={item.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <span className="text-sm">{item.total}</span>
                                                )}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="font-bold text-lg text-text-primary-light dark:text-text-primary-dark uppercase tracking-tight leading-none">{item.name}</h3>
                                                    {item.photo_url && (
                                                        <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                                                            {item.total} un.
                                                        </span>
                                                    )}
                                                </div>
                                                {/* Make sure we don't have duplicated 'un' if no photo */}
                                                {!item.photo_url && (
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded inline-block mt-1">
                                                        {item.total} un.
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2 mt-1 opacity-70">
                                            <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">
                                                Multa Avaria: R$ {item.damage_fine.toFixed(2)}
                                            </p>
                                            <p className="text-[10px] font-bold text-danger uppercase tracking-wider">
                                                Multa Perda: R$ {item.lost_fine.toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                                    {/* Returned (OK) - READ ONLY */}
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-[9px] font-black text-slate-400 uppercase">OK</span>
                                        <div className="w-full h-10 flex items-center justify-center bg-secondary/10 text-secondary font-bold rounded-xl border border-secondary/20">
                                            {item.returned}
                                        </div>
                                    </div>

                                    {/* Dirty */}
                                    <div className="bg-warning/5 border border-warning/20 rounded-xl p-2 relative group focus-within:ring-2 ring-warning/50 transition-all">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-warning mb-1 block">Sujo</label>
                                        <input
                                            type="number"
                                            value={item.dirty}
                                            onChange={(e) => handleQuantityChange(idx, 'dirty', e.target.value)}
                                            className="w-full bg-white dark:bg-slate-900 text-lg font-black text-warning border border-warning/30 rounded-lg px-2 py-1 tabular-nums text-center"
                                        />
                                    </div>

                                    {/* Incomplete */}
                                    <div className="bg-orange-400/5 border border-orange-400/20 rounded-xl p-2 relative group focus-within:ring-2 ring-orange-400/50 transition-all">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-orange-400 mb-1 block">Inc.</label>
                                        <input
                                            type="number"
                                            value={item.incomplete}
                                            onChange={(e) => handleQuantityChange(idx, 'incomplete', e.target.value)}
                                            className="w-full bg-white dark:bg-slate-900 text-lg font-black text-orange-400 border border-orange-400/30 rounded-lg px-2 py-1 tabular-nums text-center"
                                        />
                                    </div>

                                    {/* Maintenance */}
                                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-2 relative focus-within:ring-2 ring-amber-500/50 transition-all">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-1 block">Manut.</label>
                                        <input
                                            type="number"
                                            value={item.maintenance}
                                            onChange={(e) => handleQuantityChange(idx, 'maintenance', e.target.value)}
                                            className="w-full bg-white dark:bg-slate-900 text-lg font-black text-amber-500 border border-amber-500/30 rounded-lg px-2 py-1 tabular-nums text-center"
                                        />
                                    </div>

                                    {/* Broken */}
                                    <div className="bg-orange-600/5 border border-orange-600/20 rounded-xl p-2 relative focus-within:ring-2 ring-orange-600/50 transition-all">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-orange-600 mb-1 block">Avaria</label>
                                        <input
                                            type="number"
                                            value={item.broken}
                                            onChange={(e) => handleQuantityChange(idx, 'broken', e.target.value)}
                                            className="w-full bg-white dark:bg-slate-900 text-lg font-black text-orange-600 border border-orange-600/30 rounded-lg px-2 py-1 tabular-nums text-center"
                                        />
                                    </div>

                                    {/* Lost */}
                                    <div className="bg-danger/5 border border-danger/20 rounded-xl p-2 relative focus-within:ring-2 ring-danger/50 transition-all">
                                        <label className="text-[9px] font-black uppercase tracking-widest text-danger mb-1 block">Perdido</label>
                                        <input
                                            type="number"
                                            value={item.lost}
                                            onChange={(e) => handleQuantityChange(idx, 'lost', e.target.value)}
                                            className="w-full bg-white dark:bg-slate-900 text-lg font-black text-danger border border-danger/30 rounded-lg px-2 py-1 tabular-nums text-center"
                                        />
                                    </div>
                                </div>

                                {/* Item Observations */}
                                <div className="mt-3">
                                    <input
                                        type="text"
                                        placeholder="Observações do item (opcional)..."
                                        value={item.observations}
                                        onChange={(e) => handleQuantityChange(idx, 'observations', e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-border-light dark:border-border-dark text-xs focus:ring-1 focus:ring-primary/20 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="app-card p-6 border border-border-light dark:border-border-dark shadow-sm bg-slate-50/50 dark:bg-slate-800/20">
                            <div className="flex items-center gap-2 mb-4 text-primary">
                                <AlertTriangle size={18} />
                                <h3 className="font-bold uppercase tracking-widest text-xs">Observações de Retorno</h3>
                            </div>
                            <textarea
                                value={observations}
                                onChange={(e) => setObservations(e.target.value)}
                                placeholder="Descreva qualquer detalhe importante sobre a devolução..."
                                className="w-full bg-white dark:bg-slate-900 border border-border-light dark:border-border-dark rounded-xl p-4 text-sm focus:ring-2 ring-primary/20 outline-none min-h-[120px] transition-all"
                            />
                        </div>

                        <div className="app-card p-6 bg-danger/5 border border-danger/20 flex flex-col justify-between">
                            <div>
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-danger mb-4">Resumo de Multas por Avaria/Perda</h3>
                                <div className="space-y-2">
                                    {itemsState.filter(i => (i.lost + i.broken) > 0).map((i, idx) => (
                                        <div key={idx} className="flex flex-col gap-1 text-xs font-bold text-danger/80 border-b border-danger/5 last:border-0 pb-1 mb-1">
                                            <span>{i.name}</span>
                                            <div className="flex justify-between pl-2 font-normal">
                                                <span>Avaria ({i.broken}x):</span>
                                                <span>R$ {(i.broken * i.damage_fine).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between pl-2 font-normal">
                                                <span>Perda ({i.lost}x):</span>
                                                <span>R$ {(i.lost * i.lost_fine).toFixed(2)}</span>
                                            </div>
                                        </div>
                                    ))}
                                    {itemsState.filter(i => (i.lost + i.broken) > 0).length === 0 && (
                                        <p className="text-xs text-slate-400 italic">Nenhuma multa calculada.</p>
                                    )}
                                </div>
                            </div>
                            <div className="pt-4 border-t border-danger/10 mt-4">
                                <h3 className="text-[10px] font-black uppercase tracking-widest text-danger mb-2">Multa / Cobrança Extra</h3>
                                <div className="bg-white dark:bg-slate-900 border-2 border-dashed border-danger/30 rounded-2xl p-4 flex items-center justify-between group focus-within:border-danger transition-all">
                                    <span className="text-xs font-bold text-danger/60 uppercase">Valor Total</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-danger font-black text-xl">R$</span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            value={damageFee}
                                            onChange={(e) => {
                                                setDamageFee(parseFloat(e.target.value) || 0)
                                                setIsManualFee(true)
                                            }}
                                            className="w-32 bg-transparent text-right text-3xl font-black text-danger outline-none placeholder-danger/30"
                                            placeholder="0.00"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border-light dark:border-border-dark flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-text-primary-light dark:text-text-primary-dark rounded-xl font-bold transition-all text-xs uppercase tracking-wider"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl font-black flex items-center gap-2 shadow-lg shadow-primary/20 transition-all text-xs uppercase tracking-wider"
                    >
                        <CheckCircle size={16} />
                        Confirmar Devolução
                    </button>
                </div>
            </div>
        </div>
    )
}

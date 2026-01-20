import { useState, useEffect } from 'react'
import { X, Calendar, Clock, CheckCircle } from 'lucide-react'
import { useDialog } from './DialogProvider'

export default function QuoteConversionModal({ isOpen, onClose, onConfirm, quote }) {
    const { alert: dialogAlert, success, error: toastError } = useDialog()

    const [formData, setFormData] = useState({
        delivery_time: '',
        return_time: '',
        custom_due_date: '',
        payment_method: 'Dinheiro', // Default or from quote if available
    })

    useEffect(() => {
        if (isOpen && quote) {
            setFormData({
                delivery_time: quote.delivery_time || '', // Usually empty in quotes
                return_time: quote.return_time || '',
                custom_due_date: quote.custom_due_date || quote.start_date || '', // Default to start date
                payment_method: quote.payment_method || 'Dinheiro'
            })
        }
    }, [isOpen, quote])

    if (!isOpen) return null

    function handleSubmit(e) {
        e.preventDefault()
        onConfirm(formData)
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface-light dark:bg-surface-dark w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] border border-border-light dark:border-border-dark">

                {/* Header */}
                <div className="p-6 border-b border-border-light dark:border-border-dark flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl">
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight text-text-primary-light dark:text-text-primary-dark flex items-center gap-2">
                            <CheckCircle className="text-secondary" />
                            Efetivar Orçamento
                        </h2>
                        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark font-medium">
                            Complete as informações para gerar a locação.
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors text-text-secondary-light dark:text-text-secondary-dark">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <form id="conversion-form" onSubmit={handleSubmit} className="space-y-6">

                        <div className="grid grid-cols-2 gap-4">
                            {/* Delivery Time */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase tracking-wider text-text-secondary-light">Horário de Entrega</label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary-light" size={16} />
                                    <input
                                        type="time"
                                        required
                                        value={formData.delivery_time}
                                        onChange={e => setFormData({ ...formData, delivery_time: e.target.value })}
                                        className="app-input pl-10"
                                    />
                                </div>
                            </div>

                            {/* Return Time */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold uppercase tracking-wider text-text-secondary-light">Horário de Devolução</label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary-light" size={16} />
                                    <input
                                        type="time"
                                        required
                                        value={formData.return_time}
                                        onChange={e => setFormData({ ...formData, return_time: e.target.value })}
                                        className="app-input pl-10"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Due Date */}
                        <div className="space-y-1">
                            <label className="text-xs font-bold uppercase tracking-wider text-text-secondary-light">Data de Vencimento do Pagamento</label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary-light" size={16} />
                                <input
                                    type="date"
                                    required
                                    value={formData.custom_due_date}
                                    onChange={e => setFormData({ ...formData, custom_due_date: e.target.value })}
                                    className="app-input pl-10"
                                />
                            </div>
                            <p className="text-[10px] text-text-secondary-light">
                                Data limite para o cliente realizar o pagamento integral.
                            </p>
                        </div>



                    </form>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-border-light dark:border-border-dark flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-text-primary-light dark:text-text-primary-dark rounded-xl font-bold transition-all text-xs uppercase tracking-wider"
                    >
                        Cancelar
                    </button>
                    <button
                        form="conversion-form"
                        type="submit"
                        className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl font-black flex items-center gap-2 shadow-lg shadow-primary/20 transition-all text-xs uppercase tracking-wider"
                    >
                        <CheckCircle size={16} />
                        Confirmar e Gerar Locação
                    </button>
                </div>
            </div>
        </div>
    )
}

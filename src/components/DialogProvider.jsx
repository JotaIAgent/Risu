
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { X, CheckCircle2, AlertTriangle, Info, Bell, XCircle } from 'lucide-react'
import Modal from './Modal'

const DialogContext = createContext(null)

export function useDialog() {
    const context = useContext(DialogContext)
    if (!context) throw new Error('useDialog must be used within a DialogProvider')
    return context
}

export default function DialogProvider({ children }) {
    const [dialog, setDialog] = useState(null)
    const [toasts, setToasts] = useState([])

    // TOASTS
    const toast = useCallback((message, type = 'info', duration = 4000) => {
        const id = Math.random().toString(36).substr(2, 9)
        setToasts(prev => [...prev, { id, message, type }])

        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, duration)
    }, [])

    const success = useCallback((msg) => toast(msg, 'success'), [toast])
    const error = useCallback((msg) => toast(msg, 'error'), [toast])

    // DIALOGS
    const alert = useCallback((message, title = 'Aviso') => {
        return new Promise((resolve) => {
            setDialog({
                type: 'alert',
                message,
                title,
                resolve
            })
        })
    }, [])

    const confirm = useCallback((messageOrOptions, title) => {
        return new Promise((resolve) => {
            let options = {}
            if (typeof messageOrOptions === 'object' && messageOrOptions !== null) {
                options = messageOrOptions
            } else {
                options = { message: messageOrOptions, title: title || 'Confirmação' }
            }

            setDialog({
                type: 'confirm',
                resolve,
                title: options.title || 'Confirmação',
                message: options.message,
                confirmText: options.confirmText || 'Confirmar',
                cancelText: options.cancelText || 'Cancelar',
                dialogType: options.type || 'normal'
            })
        })
    }, [])

    const prompt = useCallback((message, defaultValue = '', title = 'Entrada') => {
        return new Promise((resolve) => {
            setDialog({
                type: 'prompt',
                message,
                defaultValue,
                title,
                resolve
            })
        })
    }, [])

    const closeDialog = (value) => {
        if (dialog) {
            dialog.resolve(value)
            setDialog(null)
        }
    }

    return (
        <DialogContext.Provider value={{ alert, confirm, prompt, toast, success, error }}>
            {children}

            {/* TOAST CONTAINER */}
            <div className="fixed bottom-8 right-8 z-[9999] flex flex-col gap-3 pointer-events-none">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`
                            pointer-events-auto px-6 py-4 rounded-[1.5rem] shadow-2xl flex items-center gap-4 
                            animate-in fade-in slide-in-from-right-10 duration-500
                            ${t.type === 'success' ? 'bg-[#13283b] text-white border-l-4 border-secondary' :
                                t.type === 'error' ? 'bg-red-600 text-white shadow-red-200' :
                                    'bg-white text-[#13283b] border border-slate-100'}
                        `}
                    >
                        {t.type === 'success' && <CheckCircle2 className="text-secondary" size={20} />}
                        {t.type === 'error' && <XCircle size={20} />}
                        {t.type === 'info' && <Info className="text-blue-500" size={20} />}
                        <span className="text-xs font-black uppercase tracking-wider">{t.message}</span>
                        <button
                            onClick={() => setToasts(prev => prev.filter(toast => toast.id !== t.id))}
                            className="ml-4 opacity-50 hover:opacity-100 transition-opacity"
                        >
                            <X size={14} />
                        </button>
                    </div>
                ))}
            </div>

            {/* MODAL DIALOG */}
            {dialog && (
                <div className="fixed inset-0 bg-[#13283b]/80 backdrop-blur-sm z-[9998] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-sm p-10 shadow-2xl animate-in fade-in zoom-in duration-300 border border-white/20">
                        <div className="flex flex-col items-center text-center space-y-6">
                            <div className={`p-4 rounded-[1.5rem] ${dialog.dialogType === 'danger' ? 'bg-red-50 text-red-600' :
                                dialog.type === 'confirm' ? 'bg-indigo-50 text-indigo-600' :
                                    dialog.type === 'prompt' ? 'bg-blue-50 text-blue-600' :
                                        'bg-secondary/10 text-secondary'
                                }`}>
                                {dialog.type === 'alert' && <Bell size={32} />}
                                {dialog.type === 'confirm' && <AlertTriangle size={32} />}
                                {dialog.type === 'prompt' && <Info size={32} />}
                            </div>

                            <div className="space-y-2">
                                <h3 className={`text-xl font-black uppercase tracking-tighter ${dialog.dialogType === 'danger' ? 'text-red-600' : 'text-[#13283b] dark:text-white'}`}>
                                    {dialog.title}
                                </h3>
                                <p className="text-sm font-bold text-slate-400 leading-relaxed px-2">
                                    {dialog.message}
                                </p>
                            </div>

                            {dialog.type === 'prompt' && (
                                <input
                                    autoFocus
                                    id="dialog-prompt-input"
                                    defaultValue={dialog.defaultValue}
                                    className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-800 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] dark:text-white focus:bg-white dark:focus:bg-slate-700 focus:border-slate-200 outline-none transition-all"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') closeDialog(e.target.value)
                                        if (e.key === 'Escape') closeDialog(null)
                                    }}
                                />
                            )}

                            <div className="flex gap-4 w-full pt-4">
                                {(dialog.type === 'confirm' || dialog.type === 'prompt') && (
                                    <button
                                        onClick={() => closeDialog(dialog.type === 'prompt' ? null : false)}
                                        className="flex-1 py-4 bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-2xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-100 transition-all border border-slate-100 dark:border-slate-700"
                                    >
                                        {dialog.cancelText || 'Cancelar'}
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        if (dialog.type === 'prompt') {
                                            const val = document.getElementById('dialog-prompt-input').value
                                            closeDialog(val)
                                        } else {
                                            closeDialog(true)
                                        }
                                    }}
                                    className={`flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] text-white shadow-xl transition-all hover:scale-[1.05] active:scale-95 ${dialog.dialogType === 'danger' ? 'bg-red-600 shadow-red-200' :
                                            dialog.type === 'confirm' ? 'bg-indigo-600 shadow-indigo-200' : 'bg-[#13283b] shadow-slate-200'
                                        }`}
                                >
                                    {dialog.confirmText || (dialog.type === 'confirm' ? 'Confirmar' : 'Entendido')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </DialogContext.Provider>
    )
}

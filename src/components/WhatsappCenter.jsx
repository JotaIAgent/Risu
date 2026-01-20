
import React, { useState, useEffect } from 'react'
import { MessageCircle, Send, History, Settings, Plus, Trash2, Loader2, User, FileText, CheckCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useDialog } from './DialogProvider'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function WhatsappCenter({ customer, rental, onMessageSent }) {
    const [view, setView] = useState('templates') // 'templates', 'history', 'settings'
    const [templates, setTemplates] = useState([])
    const [logs, setLogs] = useState([])
    const [loading, setLoading] = useState(false)
    const [sending, setSending] = useState(false)
    const [editingTemplate, setEditingTemplate] = useState(null)
    const [isSaving, setIsSaving] = useState(false)
    const { alert: dialogAlert, success, error: toastError } = useDialog()

    const EVOLUTION_URL = import.meta.env.VITE_EVOLUTION_URL || ''
    const EVOLUTION_APIKEY = import.meta.env.VITE_EVOLUTION_APIKEY || ''

    useEffect(() => {
        if (customer) {
            fetchTemplates()
            fetchLogs()
        }
    }, [customer])

    async function fetchTemplates() {
        const { data } = await supabase
            .from('whatsapp_templates')
            .select('*')
            .order('name')
        setTemplates(data || [])
    }

    async function fetchLogs() {
        const { data } = await supabase
            .from('whatsapp_logs')
            .select('*')
            .eq('customer_id', customer.id)
            .order('created_at', { ascending: false })
            .limit(10)
        setLogs(data || [])
    }

    function replaceVars(text) {
        if (!text) return ''

        const itemsList = rental?.rental_items?.map(ri => `• ${ri.quantity}x ${ri.items?.name || 'Item'}`).join('\n') || ''

        return text
            .replace(/{nome}/g, customer?.name || '')
            .replace(/{aluguel_id}/g, rental?.id?.slice(0, 8) || 'N/A')
            .replace(/{total}/g, rental?.total_value?.toFixed(2) || '0.00')
            .replace(/{data_fim}/g, rental?.end_date ? format(new Date(rental.end_date + 'T00:00:00'), 'dd/MM/yyyy') : '')
            .replace(/{resumo}/g, itemsList)
    }

    async function handleSendMessage(template) {
        if (!EVOLUTION_URL || !EVOLUTION_APIKEY) {
            toastError('Configure a Evolution API nas configurações.')
            return
        }

        const message = replaceVars(template.content)
        let number = customer.whatsapp?.replace(/\D/g, '')
        if (!number) {
            toastError('Cliente sem WhatsApp cadastrado.')
            return
        }
        if (number.length <= 11) number = '55' + number

        try {
            setSending(true)
            const baseUrl = EVOLUTION_URL.replace(/\/$/, '')
            const { data: settings } = await supabase.from('user_settings').select('instance_name').single()

            if (!settings?.instance_name) {
                toastError('Configure o nome da instância da Evolution API.')
                return
            }

            const response = await fetch(`${baseUrl}/message/sendText/${settings.instance_name}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_APIKEY },
                body: JSON.stringify({ number, text: message })
            })

            if (response.ok) {
                // Log the message
                await supabase.from('whatsapp_logs').insert({
                    customer_id: customer.id,
                    user_id: (await supabase.auth.getUser()).data.user.id,
                    rental_id: rental?.id,
                    template_name: template.name,
                    content: message,
                    status: 'sent'
                })
                fetchLogs()
                success('Mensagem enviada!')
                if (onMessageSent) onMessageSent()
            } else {
                throw new Error('Erro ao enviar')
            }
        } catch (error) {
            console.error(error)
            toastError('Falha ao enviar mensagem.')
        } finally {
            setSending(false)
        }
    }

    async function saveTemplate(e) {
        e.preventDefault()
        const formData = new FormData(e.target)
        const templateData = {
            name: formData.get('name'),
            content: formData.get('content'),
            user_id: (await supabase.auth.getUser()).data.user.id
        }

        try {
            setIsSaving(true)
            if (editingTemplate?.id) {
                await supabase.from('whatsapp_templates').update(templateData).eq('id', editingTemplate.id)
            } else {
                await supabase.from('whatsapp_templates').insert(templateData)
            }
            setEditingTemplate(null)
            fetchTemplates()
        } catch (error) {
            console.error(error)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="bg-surface-light dark:bg-slate-800/50 backdrop-blur-xl border border-border-light dark:border-border-dark rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[500px]">
            {/* Nav Tabs */}
            <div className="flex border-b border-border-light dark:border-border-dark p-2 gap-1">
                <button
                    onClick={() => setView('templates')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all font-bold text-xs uppercase tracking-wider ${view === 'templates' ? 'bg-primary text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-text-secondary-light'}`}
                >
                    <MessageCircle size={16} />
                    Modelos
                </button>
                <button
                    onClick={() => setView('history')}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-all font-bold text-xs uppercase tracking-wider ${view === 'history' ? 'bg-primary text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-700/50 text-text-secondary-light'}`}
                >
                    <History size={16} />
                    Histórico
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {view === 'templates' && (
                    <div className="space-y-4">
                        {templates.map(t => (
                            <div key={t.id} className="group p-4 bg-slate-50 dark:bg-slate-800 border border-border-light dark:border-border-dark rounded-2xl hover:border-primary/50 transition-all">
                                <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-bold text-primary">{t.name}</h4>
                                    <button
                                        onClick={() => handleSendMessage(t)}
                                        disabled={sending}
                                        className="p-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-all disabled:opacity-50"
                                    >
                                        {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                    </button>
                                </div>
                                <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark line-clamp-2 italic">
                                    "{replaceVars(t.content)}"
                                </p>
                            </div>
                        ))}
                        {templates.length === 0 && <p className="text-center py-10 opacity-50 text-xs">Nenhum modelo cadastrado.</p>}
                    </div>
                )}

                {view === 'history' && (
                    <div className="space-y-4">
                        {logs.map(log => (
                            <div key={log.id} className="p-4 bg-slate-50 dark:bg-slate-800 border border-border-light dark:border-border-dark rounded-2xl">
                                <div className="flex justify-between text-[10px] font-black uppercase text-text-secondary-light/50 mb-1">
                                    <span>{log.template_name || 'Personalizada'}</span>
                                    <span>{format(new Date(log.created_at), "dd MMM, HH:mm", { locale: ptBR })}</span>
                                </div>
                                <p className="text-sm font-medium">{log.content}</p>
                                <div className="mt-2 flex items-center gap-1 text-[10px] text-green-500 font-bold uppercase">
                                    <CheckCircle size={10} />
                                    Entregue
                                </div>
                            </div>
                        ))}
                        {logs.length === 0 && <p className="text-center py-10 opacity-50 text-xs text-text-secondary-light">Sem histórico de mensagens.</p>}
                    </div>
                )}
            </div>

            {/* Footer Summary */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-border-light dark:border-border-dark flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <User size={20} />
                </div>
                <div>
                    <div className="text-xs font-black text-text-primary-light dark:text-text-primary-dark">{customer?.name}</div>
                    <div className="text-[10px] font-bold text-text-secondary-light uppercase tracking-tighter flex items-center gap-2">
                        <span>{customer?.whatsapp}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span className="text-secondary">{rental ? `Pendência: R$ ${(rental.total_value - (rental.down_payment || 0)).toFixed(2)}` : 'S/ Pendências'}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}

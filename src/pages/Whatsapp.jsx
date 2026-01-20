import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { QrCode, CheckCircle, Smartphone, LogOut, Info, MessageCircle, Plus, Trash2, Edit3, Loader2, History, X, Search, Send, User, ChevronRight, Bell, Calendar as CalendarIcon, Clock, Truck, DollarSign, Package, AlertCircle, FileText, FileSignature, Upload, Power } from 'lucide-react'
import { useDialog } from '../components/DialogProvider'
import { format, subDays, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function Whatsapp() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const { alert: dialogAlert, confirm, prompt, success, error: toastError } = useDialog()
    const [qrCode, setQrCode] = useState(null)
    const [instanceStatus, setInstanceStatus] = useState(null)
    const [savedSettings, setSavedSettings] = useState(null)
    const [activeTab, setActiveTab] = useState('connection') // 'connection', 'templates', 'service', 'history'

    // Service Tab State
    const [customers, setCustomers] = useState([])
    const [searchCustomer, setSearchCustomer] = useState('')
    const [selectedCustomer, setSelectedCustomer] = useState(null)
    const [customerLogs, setCustomerLogs] = useState([])
    const [sendingMessage, setSendingMessage] = useState(false)
    const [customMessage, setCustomMessage] = useState('')
    const [loadingCustomers, setLoadingCustomers] = useState(false)
    const [customerContext, setCustomerContext] = useState(null)

    // Templates State
    const [templates, setTemplates] = useState([])
    const [editingTemplate, setEditingTemplate] = useState(null)
    const [isSavingTemplate, setIsSavingTemplate] = useState(false)

    // History State
    const [logs, setLogs] = useState([])
    const [loadingLogs, setLoadingLogs] = useState(false)
    const messagesEndRef = useRef(null)

    useEffect(() => {
        if (selectedCustomer) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [customerLogs, selectedCustomer])

    // Pegando as credenciais
    const EVOLUTION_URL = import.meta.env.VITE_EVOLUTION_URL || ''
    const EVOLUTION_APIKEY = import.meta.env.VITE_EVOLUTION_APIKEY || ''

    useEffect(() => {
        if (user) {
            fetchSettings()
            fetchTemplates()
            fetchLogs()
            fetchCustomers()
        }
    }, [user])

    // Real-time subscription for messages
    useEffect(() => {
        if (!selectedCustomer?.id) return

        const channel = supabase
            .channel(`chat-${selectedCustomer.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'whatsapp_logs',
                    filter: `customer_id=eq.${selectedCustomer.id}`
                },
                (payload) => {
                    setCustomerLogs(prev => {
                        const exists = prev.some(item => item.id === payload.new.id)
                        if (exists) return prev
                        return [payload.new, ...prev]
                    })
                    fetchCustomerContext(selectedCustomer.id)
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [selectedCustomer?.id])

    async function fetchCustomers() {
        try {
            setLoadingCustomers(true)
            const { data } = await supabase
                .from('customers')
                .select('*')
                .eq('user_id', user.id)
                .order('name')
            setCustomers(data || [])
        } catch (error) {
            console.error(error)
        } finally {
            setLoadingCustomers(false)
        }
    }

    async function fetchCustomerLogs(customerId) {
        if (!customerId) return
        try {
            const { data, error } = await supabase
                .from('whatsapp_logs')
                .select('*')
                .eq('customer_id', customerId)
                .order('created_at', { ascending: false })
                .limit(10)

            if (error) throw error
            setCustomerLogs(data || [])
            fetchCustomerContext(customerId)
        } catch (error) {
            console.error('Error fetching customer logs:', error)
        }
    }

    async function fetchCustomerContext(customerId) {
        if (!customerId) return
        setCustomerContext(null) // Reset while loading
        try {
            const { data: rentals, error } = await supabase
                .from('rentals')
                .select('*, rental_items(*, items(*))')
                .eq('client_id', customerId)
                .neq('status', 'canceled')
                .order('created_at', { ascending: false })

            if (error) throw error
            if (!rentals) return

            const activeRentals = rentals.filter(r => r.status === 'active').length
            const totalRentals = rentals.length

            const today = new Date()
            today.setHours(0, 0, 0, 0)

            let totalPending = 0
            rentals.forEach(rental => {
                if (!rental.end_date) return

                const endDate = new Date(rental.end_date + 'T00:00:00')
                let lateFee = 0

                if (rental.status === 'completed') {
                    lateFee = rental.late_fee_amount || 0
                } else if (rental.status === 'active' && endDate < today) {
                    const diffTime = Math.abs(today - endDate)
                    const daysLate = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

                    if (savedSettings?.late_fee_value) {
                        if (savedSettings.late_fee_type === 'percent') {
                            lateFee = (savedSettings.late_fee_value / 100) * (rental.total_value || 0) * daysLate
                        } else {
                            lateFee = savedSettings.late_fee_value * daysLate
                        }
                    }
                }

                const grandTotal = (rental.total_value || 0) + lateFee
                const pending = grandTotal - (rental.down_payment || 0)
                if (pending > 0.01) totalPending += pending
            })

            const latestRental = rentals[0] || null
            let resumo = ''

            if (latestRental) {
                const itemsText = latestRental.rental_items?.map(ri => `• ${ri.quantity}x ${ri.items?.name}`).join('\n') || ''
                const startDate = latestRental.delivery_date ? new Date(latestRental.delivery_date + 'T00:00:00') : null
                const endDate = latestRental.end_date ? new Date(latestRental.end_date + 'T00:00:00') : null

                resumo = `*Resumo do Pedido:*`
                if (itemsText) resumo += `\n${itemsText}`
                if (startDate && endDate) {
                    resumo += `\n\n*Período:* ${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}`
                }
                resumo += `\n*Total:* R$ ${(latestRental.total_value || 0).toFixed(2)}`
            }

            setCustomerContext({
                activeRentals,
                totalRentals,
                totalPending,
                latestRental,
                resumo
            })
        } catch (error) {
            console.error('Error in fetchCustomerContext:', error)
        }
    }

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchCustomer.toLowerCase()) ||
        c.whatsapp?.includes(searchCustomer)
    )

    async function fetchSettings() {
        try {
            const { data, error } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle()

            if (data && data.instance_name) {
                setSavedSettings(data)
                checkInstanceStatus(data.instance_name)
            } else if (data) {
                setSavedSettings(data)
            }
        } catch (error) {
            console.error(error)
        }
    }

    async function fetchTemplates() {
        const { data } = await supabase
            .from('whatsapp_templates')
            .select('*')
            .order('name')
        setTemplates(data || [])
    }

    async function fetchLogs() {
        try {
            setLoadingLogs(true)
            const { data } = await supabase
                .from('whatsapp_logs')
                .select('*, customers(name)')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50)
            setLogs(data || [])
        } catch (error) {
            console.error(error)
        } finally {
            setLoadingLogs(false)
        }
    }

    async function checkInstanceStatus(instanceName) {
        if (!EVOLUTION_URL || !EVOLUTION_APIKEY) return
        try {
            const baseUrl = EVOLUTION_URL.replace(/\/$/, '')
            const response = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
                headers: { 'apikey': EVOLUTION_APIKEY }
            })

            if (response.status === 404) {
                setInstanceStatus(null)
                return
            }

            const data = await response.json()
            if (data?.instance?.state) {
                setInstanceStatus(data.instance.state)
            } else {
                setInstanceStatus(null)
            }
        } catch (error) {
            setInstanceStatus(null)
        }
    }

    async function handleConnect() {
        if (!EVOLUTION_URL || !EVOLUTION_APIKEY) {
            toastError('Erro: CREDENCIAIS NÃO ENCONTRADAS no .env. Contate o suporte.')
            return
        }

        try {
            setLoading(true)
            setQrCode(null)

            const baseUrl = EVOLUTION_URL.replace(/\/$/, '')
            const instanceName = user.email.replace(/[^a-zA-Z0-9]/g, '_')

            try {
                await fetch(`${baseUrl}/instance/create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': EVOLUTION_APIKEY
                    },
                    body: JSON.stringify({
                        instanceName: instanceName,
                        token: user.id,
                        qrcode: true,
                        integration: 'WHATSAPP-BAILEYS'
                    })
                })
            } catch (ignore) { }

            if (savedSettings?.instance_name !== instanceName) {
                await supabase.from('user_settings').upsert({
                    user_id: user.id,
                    instance_name: instanceName
                })
                setSavedSettings(prev => ({ ...prev, instance_name: instanceName }))
            }

            const connectResponse = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
                method: 'GET',
                headers: { 'apikey': EVOLUTION_APIKEY }
            })

            const connectData = await connectResponse.json()

            if (connectData.base64) {
                setQrCode(connectData.base64)
            } else if (connectData.qrcode && connectData.qrcode.base64) {
                setQrCode(connectData.qrcode.base64)
            } else if (connectData.instance?.state === 'open') {
                setInstanceStatus('open')
                success('Conectado com sucesso!')
            }

            const interval = setInterval(async () => {
                try {
                    const statusRes = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
                        headers: { 'apikey': EVOLUTION_APIKEY }
                    })
                    const statusData = await statusRes.json()

                    if (statusData?.instance?.state === 'open') {
                        setInstanceStatus('open')
                        setQrCode(null)
                        clearInterval(interval)
                    }
                } catch (e) { }
            }, 3000)

            setTimeout(() => clearInterval(interval), 60000)

        } catch (error) {
            console.error(error)
            toastError('Não foi possível conectar. Tente novamente.')
        } finally {
            setLoading(false)
        }
    }

    async function handleDisconnect() {
        if (!await confirm('Deseja realmente desconectar? Isso impedirá o envio automático de contratos.', 'Desconectar WhatsApp')) return

        try {
            setLoading(true)
            const baseUrl = EVOLUTION_URL.replace(/\/$/, '')
            const instanceName = savedSettings?.instance_name || user.email.replace(/[^a-zA-Z0-9]/g, '_')

            await fetch(`${baseUrl}/instance/delete/${instanceName}`, {
                method: 'DELETE',
                headers: { 'apikey': EVOLUTION_APIKEY }
            })

            setInstanceStatus(null)
            setQrCode(null)
            success('Desconectado com sucesso!')

        } catch (error) {
            console.error(error)
            toastError('Erro ao desconectar.')
        } finally {
            setLoading(false)
        }
    }

    async function saveTemplate(e) {
        e.preventDefault()
        const formData = new FormData(e.target)
        const templateData = {
            name: formData.get('name'),
            content: formData.get('content'),
            category: formData.get('category'),
            user_id: user.id
        }

        try {
            setIsSavingTemplate(true)
            if (editingTemplate?.id) {
                const { error } = await supabase.from('whatsapp_templates').update(templateData).eq('id', editingTemplate.id)
                if (error) throw error
            } else {
                const { error } = await supabase.from('whatsapp_templates').insert(templateData)
                if (error) throw error
            }
            setEditingTemplate(null)
            fetchTemplates()
            success('Modelo salvo com sucesso!')
        } catch (error) {
            console.error(error)
            toastError('Erro ao salvar modelo.')
        } finally {
            setIsSavingTemplate(false)
        }
    }

    async function deleteTemplate(id) {
        if (!await confirm('Deseja excluir este modelo permanentemente?', 'Excluir Modelo')) return
        try {
            const { error } = await supabase.from('whatsapp_templates').delete().eq('id', id)
            if (error) throw error
            fetchTemplates()
        } catch (error) {
            console.error(error)
            toastError('Erro ao excluir modelo.')
        }
    }

    async function handleSendMessage(customer, content, templateName = 'Personalizada') {
        if (!EVOLUTION_URL || !EVOLUTION_APIKEY) {
            toastError('Configure a Evolution API nas configurações.')
            return
        }

        let number = customer.whatsapp?.replace(/\D/g, '')
        if (!number) {
            toastError('Cliente sem WhatsApp cadastrado.')
            return
        }
        if (number.length <= 11) number = '55' + number

        try {
            setSendingMessage(true)
            const baseUrl = EVOLUTION_URL.replace(/\/$/, '')
            const instanceName = savedSettings?.instance_name || user.email.replace(/[^a-zA-Z0-9]/g, '_')

            const replaceVars = (template) => {
                if (!template) return ''
                let text = template.replace(/{nome}/g, customer.name || '')
                if (customerContext) {
                    text = text.replace(/{resumo}/g, customerContext.resumo || '')
                        .replace(/{aluguel_id}/g, (customerContext.latestRental?.id || '').slice(0, 8))
                        .replace(/{total}/g, (customerContext.latestRental?.total_value || 0).toFixed(2))
                }
                return text
            }

            const processedContent = replaceVars(content)

            const response = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_APIKEY },
                body: JSON.stringify({ number, text: processedContent })
            })

            if (response.ok) {
                await supabase.from('whatsapp_logs').insert({
                    customer_id: customer.id,
                    user_id: user.id,
                    template_name: templateName,
                    content: processedContent,
                    direction: 'outgoing',
                    status: 'sent'
                })
                fetchLogs()
                setCustomMessage('')
            } else {
                throw new Error('Erro ao enviar')
            }
        } catch (error) {
            console.error(error)
            toastError('Falha ao enviar mensagem.')
        } finally {
            setSendingMessage(false)
        }
    }

    async function saveAutomationSettings(e) {
        e.preventDefault()
        const formData = new FormData(e.target)
        const updateData = {
            global_auto_send: formData.get('global_auto_send') === 'on',
            payment_alert_message: formData.get('payment_alert_message'),
            return_alert_message: formData.get('return_alert_message'),
            whatsapp_logistics_message: formData.get('whatsapp_logistics_message'),
            contract_template: formData.get('contract_template'),
            pdf_message: formData.get('pdf_message'),
            signature_message: formData.get('signature_message'),
            upload_message: formData.get('upload_message'),
            collection_schedule: savedSettings?.collection_schedule
        }

        try {
            setLoading(true)
            const { error } = await supabase
                .from('user_settings')
                .update(updateData)
                .eq('user_id', user.id)

            if (error) throw error
            setSavedSettings(prev => ({ ...prev, ...updateData }))
            success('Configurações de automação salvas!')
        } catch (error) {
            console.error(error)
            toastError('Erro ao salvar configurações.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center">
                <h2 className="text-3xl font-black uppercase tracking-tight text-text-primary-light dark:text-text-primary-dark">Controle WhatsApp</h2>
                <p className="text-text-secondary-light dark:text-text-secondary-dark mt-2 font-medium">
                    Gerencie sua conexão e seus modelos de atendimento.
                </p>
            </div>

            {/* Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl w-fit mx-auto border border-border-light dark:border-border-dark overflow-x-auto max-w-full">
                <button
                    onClick={() => setActiveTab('connection')}
                    className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'connection' ? 'bg-primary text-white shadow-lg' : 'text-text-secondary-light hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                    <Smartphone size={16} />
                    Conexão
                </button>
                <button
                    onClick={() => setActiveTab('service')}
                    className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'service' ? 'bg-primary text-white shadow-lg' : 'text-text-secondary-light hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                    <User size={16} />
                    Atendimento
                </button>
                <button
                    onClick={() => setActiveTab('templates')}
                    className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'templates' ? 'bg-primary text-white shadow-lg' : 'text-text-secondary-light hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                    <MessageCircle size={16} />
                    Modelos
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'history' ? 'bg-primary text-white shadow-lg' : 'text-text-secondary-light hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                >
                    <History size={16} />
                    Histórico
                </button>
            </div>

            {activeTab === 'connection' ? (
                <div className="max-w-xl mx-auto w-full">
                    <div className="app-card overflow-hidden">
                        <div className="p-8 flex flex-col items-center">
                            <div className="mb-8">
                                <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 text-primary rounded-full flex items-center justify-center shadow-inner">
                                    <Smartphone size={40} />
                                </div>
                            </div>

                            {instanceStatus === 'open' ? (
                                <div className="w-full p-8 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/50 rounded-2xl flex flex-col items-center text-center animate-in fade-in zoom-in duration-300">
                                    <CheckCircle size={56} className="text-secondary mb-4" />
                                    <h3 className="text-xl font-bold text-green-800 dark:text-green-400 mb-2">Tudo certo! WhatsApp Conectado</h3>
                                    <p className="text-green-700 dark:text-green-500/80 mb-6 max-w-sm">
                                        Seu sistema já está pronto para enviar contratos e cobranças.
                                    </p>

                                    <div className="mb-8 px-4 py-3 bg-white/50 dark:bg-black/20 rounded-lg text-sm text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800/30">
                                        <strong>Próximo passo:</strong> Configure seus modelos de mensagem na aba "Modelos" para automatizar seu atendimento.
                                    </div>

                                    <button
                                        onClick={handleDisconnect}
                                        className="w-full py-3 flex items-center justify-center gap-2 border border-danger/30 text-danger hover:bg-danger/5 rounded-xl font-semibold transition-all"
                                        disabled={loading}
                                    >
                                        <LogOut size={18} />
                                        {loading ? 'Desconectando...' : 'Desconectar WhatsApp'}
                                    </button>
                                </div>
                            ) : (
                                <div className="w-full flex flex-col items-center">
                                    {!qrCode && (
                                        <button
                                            onClick={handleConnect}
                                            className="w-full py-4 flex items-center justify-center gap-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={loading}
                                        >
                                            <QrCode size={24} />
                                            {loading ? 'Preparando...' : 'Gerar QR Code'}
                                        </button>
                                    )}

                                    {qrCode && (
                                        <div className="mt-4 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                                            <div className="p-4 bg-white rounded-2xl shadow-xl border-4 border-primary/20">
                                                <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                                            </div>
                                            <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-full text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark border border-border-light dark:border-border-dark">
                                                <Info size={16} />
                                                <span>Escaneie com seu WhatsApp</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mt-10 flex items-center gap-2 text-sm">
                                        <span className="text-text-secondary-light dark:text-text-secondary-dark font-medium">Status:</span>
                                        <span className={`flex items-center gap-1.5 font-bold ${instanceStatus === 'open' ? 'text-secondary' : 'text-danger'}`}>
                                            <span className={`w-2.5 h-2.5 rounded-full ${instanceStatus === 'open' ? 'bg-secondary' : 'bg-danger animate-pulse'}`}></span>
                                            {instanceStatus === 'open' ? 'Conectado' : 'Desconectado'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl text-xs text-blue-700 dark:text-blue-400/80 leading-relaxed">
                        <strong>Dica:</strong> Mantenha seu celular conectado à internet para garantir que as mensagens automáticas sejam enviadas sem atrasos.
                    </div>
                </div>
            ) : activeTab === 'service' ? (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-12 h-[600px]">
                    {/* Customer List */}
                    <div className="lg:col-span-4 app-card flex flex-col overflow-hidden">
                        <div className="p-4 border-b border-border-light dark:border-border-dark">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary-light" size={16} />
                                <input
                                    type="text"
                                    placeholder="Buscar cliente..."
                                    value={searchCustomer}
                                    onChange={(e) => setSearchCustomer(e.target.value)}
                                    className="app-input pl-10 h-10 text-xs text-slate-800 dark:text-slate-100"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800/50">
                            {filteredCustomers.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => {
                                        setSelectedCustomer(c)
                                        fetchCustomerLogs(c.id)
                                        fetchCustomerContext(c.id)
                                    }}
                                    className={`w-full p-4 flex items-center gap-3 transition-colors text-left hover:bg-slate-50 dark:hover:bg-slate-800/30 ${selectedCustomer?.id === c.id ? 'bg-primary/5 border-l-4 border-primary' : 'border-l-4 border-transparent'}`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-text-secondary-light shrink-0">
                                        <User size={20} />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-sm font-bold truncate text-text-primary-light dark:text-text-primary-dark">{c.name}</div>
                                        <div className="text-[10px] text-text-secondary-light truncate">{c.whatsapp || 'S/ WhatsApp'}</div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className="lg:col-span-8 app-card flex flex-col overflow-hidden">
                        {selectedCustomer ? (
                            <>
                                <div className="p-4 border-b border-border-light dark:border-border-dark flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/20">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                            <User size={20} />
                                        </div>
                                        <div>
                                            <div className="text-sm font-black">{selectedCustomer.name}</div>
                                            <div className="text-[10px] text-secondary font-bold uppercase">{selectedCustomer.whatsapp}</div>
                                        </div>
                                    </div>
                                </div>

                                {customerContext && (
                                    <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800/40 border-b border-border-light dark:border-border-dark flex flex-wrap gap-4 items-center">
                                        <div className="flex items-center gap-1.5">
                                            <Package size={12} className="text-blue-500" />
                                            <span className="text-[10px] font-bold uppercase text-text-secondary-light tracking-wide">
                                                {customerContext.activeRentals} Aluguéis Ativos
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <History size={12} className="text-slate-400" />
                                            <span className="text-[10px] font-bold uppercase text-text-secondary-light tracking-wide">
                                                {customerContext.totalRentals} Locações no Total
                                            </span>
                                        </div>
                                        {customerContext.totalPending > 0.01 && (
                                            <div className="flex items-center gap-1.5 px-3 py-1 bg-danger/10 rounded-lg">
                                                <AlertCircle size={12} className="text-danger" />
                                                <span className="text-[10px] font-black uppercase text-danger tracking-wide">
                                                    DÉBITO TOTAL: R$ {customerContext.totalPending.toFixed(2)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/30 dark:bg-slate-900/10">
                                    {customerLogs.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full opacity-30 italic text-sm">
                                            Nenhuma conversa registrada.
                                        </div>
                                    ) : (
                                        [...customerLogs].reverse().map(log => {
                                            const isIncoming = log.direction?.toLowerCase() === 'incoming'
                                            return (
                                                <div key={log.id} className={`flex flex-col ${isIncoming ? 'items-start' : 'items-end'}`}>
                                                    <div className={`max-w-[75%] p-3 rounded-2xl shadow-sm text-sm leading-relaxed ${isIncoming
                                                        ? 'bg-white dark:bg-slate-800 text-text-primary-light dark:text-text-primary-dark rounded-tl-none border border-border-light dark:border-border-dark'
                                                        : 'bg-primary text-white rounded-tr-none'}`}>
                                                        {log.content}
                                                    </div>
                                                    <div className={`flex items-center gap-1.5 mt-1 px-1 ${isIncoming ? 'flex-row' : 'flex-row-reverse'}`}>
                                                        <span className="text-[9px] font-bold text-text-secondary-light/60 uppercase tracking-tighter">
                                                            {format(new Date(log.created_at), "HH:mm")}
                                                        </span>
                                                        {!isIncoming && <CheckCircle size={10} className="text-secondary" />}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                <div className="p-4 border-t border-border-light dark:border-border-dark space-y-4">
                                    {/* Template Shortcuts */}
                                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                        {templates.map(t => (
                                            <button
                                                key={t.id}
                                                onClick={() => handleSendMessage(selectedCustomer, t.content, t.name)}
                                                className="px-4 py-2 bg-white dark:bg-slate-800 border border-border-light dark:border-border-dark rounded-xl text-[10px] font-bold text-text-secondary-light hover:border-primary hover:text-primary transition-all whitespace-nowrap shadow-sm"
                                            >
                                                {t.name}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex gap-2">
                                        <textarea
                                            value={customMessage}
                                            onChange={(e) => setCustomMessage(e.target.value)}
                                            placeholder="Digite sua mensagem..."
                                            rows={1}
                                            className="app-input flex-1 py-3 resize-none h-12"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && !e.shiftKey) {
                                                    e.preventDefault()
                                                    if (customMessage.trim()) handleSendMessage(selectedCustomer, customMessage)
                                                }
                                            }}
                                        />
                                        <button
                                            onClick={() => handleSendMessage(selectedCustomer, customMessage)}
                                            disabled={sendingMessage || !customMessage.trim()}
                                            className="w-12 h-12 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary-hover transition-all disabled:opacity-50"
                                        >
                                            {sendingMessage ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 space-y-4">
                                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-full text-slate-200 dark:text-slate-700">
                                    <MessageCircle size={64} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold text-text-primary-light dark:text-text-primary-dark">Inicie uma conversa</h4>
                                    <p className="text-sm text-text-secondary-light max-w-xs mt-2">
                                        Selecione um cliente na lista ao lado para enviar mensagens manuais ou usar seus modelos salvos.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            ) : activeTab === 'templates' ? (
                <div className="space-y-12">
                    {/* Automation Settings Section */}
                    <div className="app-card overflow-hidden">
                        <div className="p-6 border-b border-border-light dark:border-border-dark flex items-center justify-between bg-primary/5">
                            <div className="flex items-center gap-3">
                                <Bell className="text-primary" size={20} />
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-primary">Mensagens Automáticas</h3>
                                    <p className="text-[10px] text-text-secondary-light font-medium uppercase mt-0.5">Define o que o sistema envia sozinho</p>
                                </div>
                            </div>
                        </div>

                        {/* Variable Legend */}
                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 border-b border-border-light dark:border-border-dark">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light mb-3">Variáveis Disponíveis nas Mensagens Automáticas</h4>
                            <div className="flex flex-wrap gap-2">
                                <code className="text-[10px] px-1.5 py-1 bg-white dark:bg-slate-900 rounded border border-border-light dark:border-border-dark text-primary font-bold" title="Nome do Cliente">{'{cliente}'}</code>
                                <code className="text-[10px] px-1.5 py-1 bg-white dark:bg-slate-900 rounded border border-border-light dark:border-border-dark text-primary font-bold" title="ID do Aluguel">{'{aluguel_id}'}</code>
                                <code className="text-[10px] px-1.5 py-1 bg-white dark:bg-slate-900 rounded border border-border-light dark:border-border-dark text-primary font-bold" title="Valor Total">{'{total}'}</code>
                                <code className="text-[10px] px-1.5 py-1 bg-white dark:bg-slate-900 rounded border border-border-light dark:border-border-dark text-primary font-bold" title="Data Início">{'{inicio}'}</code>
                                <code className="text-[10px] px-1.5 py-1 bg-white dark:bg-slate-900 rounded border border-border-light dark:border-border-dark text-primary font-bold" title="Data Fim">{'{fim}'}</code>
                                <code className="text-[10px] px-1.5 py-1 bg-white dark:bg-slate-900 rounded border border-border-light dark:border-border-dark text-primary font-bold" title="Resumo dos Itens">{'{resumo}'}</code>
                                <code className="text-[10px] px-1.5 py-1 bg-white dark:bg-slate-900 rounded border border-border-light dark:border-border-dark text-secondary font-bold" title="Data Vencimento Pagto">{'{data_vencimento}'}</code>
                                <code className="text-[10px] px-1.5 py-1 bg-white dark:bg-slate-900 rounded border border-border-light dark:border-border-dark text-secondary font-bold" title="Valor Pendente">{'{valor_pendente}'}</code>
                                <code className="text-[10px] px-1.5 py-1 bg-white dark:bg-slate-900 rounded border border-border-light dark:border-border-dark text-secondary font-bold" title="Link de Upload">{'{upload_link}'}</code>
                            </div>
                        </div>
                        <form onSubmit={saveAutomationSettings} className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Global Auto Send Toggle */}
                            <div className="md:col-span-2 lg:col-span-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-border-light dark:border-border-dark flex items-center justify-between">
                                <div>
                                    <div className="flex items-center gap-2 text-primary font-bold text-sm uppercase tracking-wider mb-1">
                                        <Power size={16} />
                                        Envio Automático Global
                                    </div>
                                    <p className="text-xs text-text-secondary-light dark:text-text-secondary-dark">
                                        Chave geral do sistema. Se desligado, <b>nenhuma</b> mensagem automática será enviada (nem cobranças, nem contratos).
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name="global_auto_send"
                                        className="sr-only peer"
                                        defaultChecked={savedSettings?.global_auto_send !== false}
                                    />
                                    <div className="w-14 h-7 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
                                </label>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                                    <Clock size={14} />
                                    Cobrança Pendente
                                </div>
                                <textarea
                                    name="payment_alert_message"
                                    defaultValue={savedSettings?.payment_alert_message}
                                    rows={4}
                                    className="app-input text-xs leading-relaxed italic"
                                    placeholder="Mensagem de cobrança..."
                                />
                                <p className="text-[9px] text-text-secondary-light/60">Enviado automaticamente quando um pagamento fica em atraso.</p>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                                    <CalendarIcon size={14} />
                                    Lembrete de Devolução
                                </div>
                                <textarea
                                    name="return_alert_message"
                                    defaultValue={savedSettings?.return_alert_message}
                                    rows={4}
                                    className="app-input text-xs leading-relaxed italic"
                                    placeholder="Mensagem de devolução..."
                                />
                                <p className="text-[9px] text-text-secondary-light/60">Enviado automaticamente para lembrar o cliente da devolução amanhã.</p>
                            </div>



                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                                    <Plus size={14} />
                                    Boas-vindas (Contrato)
                                </div>
                                <textarea
                                    name="contract_template"
                                    defaultValue={savedSettings?.contract_template}
                                    rows={4}
                                    className="app-input text-xs leading-relaxed italic"
                                    placeholder="Mensagem de boas-vindas..."
                                />
                                <p className="text-[9px] text-text-secondary-light/60">Enviada ao gerar um novo contrato.</p>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                                    <FileText size={14} />
                                    Legenda do PDF
                                </div>
                                <textarea
                                    name="pdf_message"
                                    defaultValue={savedSettings?.pdf_message}
                                    rows={4}
                                    className="app-input text-xs leading-relaxed italic"
                                    placeholder="Texto para acompanhar o PDF..."
                                />
                                <p className="text-[9px] text-text-secondary-light/60">Acompanha o arquivo do contrato.</p>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                                    <FileSignature size={14} />
                                    Instruções Assinatura
                                </div>
                                <textarea
                                    name="signature_message"
                                    defaultValue={savedSettings?.signature_message}
                                    rows={4}
                                    className="app-input text-xs leading-relaxed italic"
                                    placeholder="Como assinar..."
                                />
                                <p className="text-[9px] text-text-secondary-light/60">Explica o processo de assinatura.</p>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
                                    <Upload size={14} />
                                    Link de Upload
                                </div>
                                <textarea
                                    name="upload_message"
                                    defaultValue={savedSettings?.upload_message}
                                    rows={4}
                                    className="app-input text-xs leading-relaxed italic"
                                    placeholder="Mensagem com link de upload..."
                                />
                                <p className="text-[9px] text-text-secondary-light/60">Enviada com link para devolver contrato assinado.</p>
                            </div>

                            <div className="md:col-span-2 lg:col-span-3 pt-4 border-t border-border-light dark:border-border-dark mt-4">
                                <div className="flex items-center gap-2 text-secondary font-bold text-xs uppercase tracking-wider mb-4">
                                    <Clock size={14} />
                                    Regras de Cobrança Automática
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light pl-1">Dias para Cobrança Pontual</label>
                                            <p className="text-[9px] text-text-secondary-light opacity-60 pl-1 italic">Envio automático após o vencimento (ex: 0, 5, 10).</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {savedSettings?.collection_schedule?.reminder_days?.map((day, idx) => (
                                                <div key={idx} className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-border-light dark:border-border-dark rounded-xl px-3 py-1.5 shadow-sm">
                                                    <span className="text-xs font-bold w-4 text-center">{day}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newDays = [...savedSettings.collection_schedule.reminder_days]
                                                            newDays.splice(idx, 1)
                                                            setSavedSettings({ ...savedSettings, collection_schedule: { ...savedSettings.collection_schedule, reminder_days: newDays } })
                                                        }}
                                                        className="text-danger hover:opacity-70"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    const day = await prompt('Em qual dia (após vencimento) deseja cobrar? (0 = no dia)', '0', 'Adicionar Dia de Cobrança')
                                                    if (day !== null) {
                                                        const val = parseInt(day)
                                                        if (!isNaN(val)) {
                                                            const currentDays = savedSettings?.collection_schedule?.reminder_days || []
                                                            const newDays = [...currentDays, val].sort((a, b) => a - b)
                                                            setSavedSettings({
                                                                ...savedSettings,
                                                                collection_schedule: {
                                                                    ...savedSettings?.collection_schedule,
                                                                    reminder_days: [...new Set(newDays)]
                                                                }
                                                            })
                                                        }
                                                    }
                                                }}
                                                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-dashed border-border-light dark:border-border-dark text-[10px] font-bold text-text-secondary-light hover:border-primary hover:text-primary transition-all bg-white dark:bg-slate-900"
                                            >
                                                <Plus size={12} />
                                                ADICIONAR
                                            </button>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <div className="space-y-1">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light pl-1">Cobrança Diária Recorrente</label>
                                                <p className="text-[9px] text-text-secondary-light opacity-60 pl-1 italic">Cobrar todos os dias após o período inicial?</p>
                                            </div>
                                            <div
                                                onClick={() => setSavedSettings({
                                                    ...savedSettings,
                                                    collection_schedule: {
                                                        ...savedSettings?.collection_schedule,
                                                        daily_enabled: !savedSettings?.collection_schedule?.daily_enabled
                                                    }
                                                })}
                                                className={`w-10 h-5 rounded-full cursor-pointer transition-colors relative ${savedSettings?.collection_schedule?.daily_enabled ? 'bg-secondary' : 'bg-slate-300 dark:bg-slate-700'}`}
                                            >
                                                <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform duration-200 ${savedSettings?.collection_schedule?.daily_enabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                                            </div>
                                        </div>
                                        <div className={`flex items-center gap-4 transition-opacity ${savedSettings?.collection_schedule?.daily_enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                            <input
                                                type="number"
                                                value={savedSettings?.collection_schedule?.daily_after_days || 0}
                                                onChange={(e) => setSavedSettings({
                                                    ...savedSettings,
                                                    collection_schedule: {
                                                        ...savedSettings?.collection_schedule,
                                                        daily_after_days: parseInt(e.target.value) || 0
                                                    }
                                                })}
                                                className="w-20 px-3 py-2 rounded-xl border border-border-light dark:border-border-dark bg-white dark:bg-slate-900 text-xs font-bold focus:ring-2 focus:ring-primary/20 outline-none"
                                            />
                                            <span className="text-[10px] font-bold text-text-secondary-light uppercase">Dias Após o Vencimento</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="md:col-span-2 lg:col-span-3 pt-6">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full md:w-auto px-8 py-3 bg-secondary text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-secondary-hover transition-all shadow-lg shadow-secondary/20"
                                >
                                    {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                                    Salvar Alterações
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-12">
                        {/* Template Form */}
                        <div className="lg:col-span-1">
                            <div className="app-card p-6 sticky top-8">
                                <h3 className="text-sm font-black uppercase tracking-widest text-text-primary-light dark:text-text-primary-dark mb-6 flex items-center gap-2">
                                    {editingTemplate ? <Edit3 size={18} className="text-primary" /> : <Plus size={18} className="text-primary" />}
                                    {editingTemplate ? 'Editar Modelo' : 'Novo Modelo'}
                                </h3>

                                <form onSubmit={saveTemplate} className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-text-secondary-light tracking-widest pl-1">Nome de Identificação</label>
                                        <input
                                            name="name"
                                            required
                                            placeholder="Ex: Lembrete de Devolução"
                                            defaultValue={editingTemplate?.name}
                                            className="app-input"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-text-secondary-light tracking-widest pl-1">Categoria</label>
                                        <select
                                            name="category"
                                            defaultValue={editingTemplate?.category || 'custom'}
                                            className="app-input"
                                        >
                                            <option value="custom">Geral / Resposta</option>
                                            <option value="budget">Orçamento</option>
                                            <option value="confirmation">Confirmação de Reserva</option>
                                            <option value="reminder">Cobrança / Lembrete</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black uppercase text-text-secondary-light tracking-widest pl-1">Mensagem</label>
                                        <textarea
                                            name="content"
                                            required
                                            rows={6}
                                            placeholder="Olá {nome}, seu pedido {aluguel_id}..."
                                            defaultValue={editingTemplate?.content}
                                            className="app-input py-3 resize-none"
                                        />
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            type="submit"
                                            disabled={isSavingTemplate}
                                            className="flex-1 py-3 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-hover transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
                                        >
                                            {isSavingTemplate ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                                            {editingTemplate ? 'Salvar Edição' : 'Criar Modelo'}
                                        </button>
                                        {editingTemplate && (
                                            <button
                                                onClick={() => setEditingTemplate(null)}
                                                type="button"
                                                className="px-4 bg-slate-100 dark:bg-slate-800 text-text-secondary-light rounded-xl hover:bg-slate-200"
                                            >
                                                <X size={20} />
                                            </button>
                                        )}
                                    </div>
                                </form>

                                <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-border-light dark:border-border-dark">
                                    <h4 className="text-[10px] font-black text-text-secondary-light uppercase mb-3">Variáveis Dinâmicas</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['{nome}', '{aluguel_id}', '{total}', '{data_fim}', '{resumo}'].map(tag => (
                                            <code key={tag} className="text-[10px] px-1.5 py-1 bg-white dark:bg-slate-900 rounded border border-border-light dark:border-border-dark text-primary font-bold">{tag}</code>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-text-secondary-light mt-3 leading-tight italic">
                                        Essas tags serão substituídas pelos dados reais no momento do envio.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Templates List */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="flex justify-between items-center px-4">
                                <h3 className="text-xs font-black uppercase tracking-widest text-text-secondary-light">Seus Modelos ({templates.length})</h3>
                            </div>

                            {templates.map(t => (
                                <div key={t.id} className="app-card group p-6 hover:border-primary/50 transition-all">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${t.category === 'budget' ? 'bg-orange-100 text-orange-600' :
                                                    t.category === 'confirmation' ? 'bg-green-100 text-green-600' :
                                                        t.category === 'reminder' ? 'bg-blue-100 text-blue-600' :
                                                            'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {t.category === 'budget' ? 'Orçamento' :
                                                        t.category === 'confirmation' ? 'Confirmação' :
                                                            t.category === 'reminder' ? 'Cobrança' : 'Geral'}
                                                </span>
                                                <h4 className="font-black text-text-primary-light dark:text-text-primary-dark">{t.name}</h4>
                                            </div>
                                            <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark italic mt-3 line-clamp-3 leading-relaxed">
                                                "{t.content}"
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => setEditingTemplate(t)}
                                                className="p-2 bg-slate-100 dark:bg-slate-800 text-text-secondary-light hover:text-primary hover:bg-primary/10 rounded-lg transition-all"
                                            >
                                                <Edit3 size={16} />
                                            </button>
                                            <button
                                                onClick={() => deleteTemplate(t.id)}
                                                className="p-2 bg-slate-100 dark:bg-slate-800 text-text-secondary-light hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {templates.length === 0 && (
                                <div className="py-20 text-center app-card border-dashed">
                                    <MessageCircle size={48} className="mx-auto text-slate-200 mb-4" />
                                    <p className="text-text-secondary-light font-medium">Nenhum modelo cadastrado ainda.</p>
                                    <p className="text-[10px] text-text-secondary-light/60 uppercase tracking-widest mt-1">Crie seu primeiro modelo ao lado</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="max-w-3xl mx-auto w-full space-y-4 pb-12">
                    <div className="flex justify-between items-center px-4">
                        <h3 className="text-xs font-black uppercase tracking-widest text-text-secondary-light">Histórico de Envios</h3>
                        <button onClick={fetchLogs} className="text-[10px] font-black text-primary uppercase hover:underline">Atualizar Lista</button>
                    </div>

                    <div className="app-card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-border-light dark:border-border-dark">
                                        <th className="px-6 py-4 text-[10px] font-black text-text-secondary-light uppercase tracking-widest">Data/Hora</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-text-secondary-light uppercase tracking-widest">Cliente</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-text-secondary-light uppercase tracking-widest">Mensagem</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-text-secondary-light uppercase tracking-widest text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {logs.map(log => (
                                        <tr key={log.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                                            <td className="px-6 py-4 text-xs font-bold text-text-secondary-light whitespace-nowrap">
                                                {format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}
                                            </td>
                                            <td className="px-6 py-4 text-xs font-black text-text-primary-light dark:text-text-primary-dark">
                                                {log.customers?.name || 'Cliente Removido'}
                                            </td>
                                            <td className="px-6 py-4 text-xs text-text-secondary-light dark:text-text-secondary-dark max-w-xs truncate italic">
                                                "{log.content}"
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-green-100 text-green-600 text-[8px] font-black uppercase">
                                                    <CheckCircle size={10} />
                                                    Enviado
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {logs.length === 0 && !loadingLogs && (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-12 text-center text-text-secondary-light/50 italic text-sm">Nenhuma mensagem registrada.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    )
}

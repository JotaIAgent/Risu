import { useState, useEffect } from 'react'
import {
    MessageSquare,
    Clock,
    Inbox,
    CheckCircle2,
    AlertCircle,
    User,
    Filter,
    ChevronRight,
    Search,
    RefreshCw,
    Send,
    Flag,
    Lightbulb,
    LayoutDashboard,
    Lock,
    Unlock
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useDialog } from '../components/DialogProvider'
import { useAuth } from '../contexts/AuthContext'

const PriorityBadge = ({ priority }) => {
    const styles = {
        low: 'bg-slate-50 text-slate-500 border-slate-100',
        medium: 'bg-blue-50 text-blue-600 border-blue-100',
        high: 'bg-amber-50 text-amber-600 border-amber-100',
        urgent: 'bg-red-50 text-red-600 border-red-100'
    }
    const labels = {
        low: 'Baixa',
        medium: 'Média',
        high: 'Alta',
        urgent: 'Crítica'
    }
    return (
        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest border ${styles[priority] || styles.medium}`}>
            {labels[priority] || priority}
        </span>
    )
}

const StatusBadge = ({ status }) => {
    const styles = {
        open: 'text-blue-500 bg-blue-500/10',
        in_progress: 'text-amber-500 bg-amber-500/10',
        waiting_user: 'text-purple-500 bg-purple-500/10',
        resolved: 'text-green-500 bg-green-500/10',
        closed: 'text-slate-500 bg-slate-500/10'
    }
    const labels = {
        open: 'Aberto',
        in_progress: 'Em Análise',
        waiting_user: 'Aguardando User',
        resolved: 'Resolvido',
        closed: 'Fechado'
    }
    return (
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${styles[status] || styles.open}`}>
            <div className={`w-1 h-1 rounded-full bg-current`} />
            <span className={`text-[9px] font-black uppercase tracking-widest`}>
                {labels[status] || status}
            </span>
        </div>
    )
}

export default function AdminSupport() {
    const { user } = useAuth()
    const { error: toastError, success } = useDialog()

    // Global State
    const [viewMode, setViewMode] = useState('tickets') // 'tickets' | 'suggestions'
    const [loading, setLoading] = useState(true)

    // Tickets State
    const [tickets, setTickets] = useState([])
    const [selectedTicket, setSelectedTicket] = useState(null)
    const [statusFilter, setStatusFilter] = useState('all')
    const [ticketMessages, setTicketMessages] = useState([])
    const [newReply, setNewReply] = useState('')
    const [isInternalNote, setIsInternalNote] = useState(false)

    // Suggestions State
    const [suggestions, setSuggestions] = useState([])

    // Metrics State
    const [metrics, setMetrics] = useState({
        openTickets: 0,
        highPriority: 0,
        pendingSuggestions: 0,
        overdue: 0
    })

    useEffect(() => {
        fetchData()
    }, [])

    useEffect(() => {
        if (selectedTicket) {
            fetchTicketMessages(selectedTicket.id)
        }
    }, [selectedTicket])

    const fetchData = async () => {
        try {
            setLoading(true)

            // Fetch Support Tickets
            const { data: ticketsData, error: ticketsError } = await supabase
                .from('support_tickets')
                .select('*, profiles(full_name, email)')
                .order('created_at', { ascending: false })
            if (ticketsError) throw ticketsError

            // Fetch Suggestions
            const { data: suggestionsData, error: suggestionsError } = await supabase
                .from('product_suggestions')
                .select('*, profiles(full_name, email)')
                .order('created_at', { ascending: false })
            if (suggestionsError) throw suggestionsError

            setTickets(ticketsData)
            setSuggestions(suggestionsData)

            // Calculate Metrics
            const open = ticketsData.filter(t => t.status === 'open').length
            const high = ticketsData.filter(t => t.priority === 'high').length
            const pending = suggestionsData.filter(s => s.status === 'new').length
            // Mock overdue logic for now (e.g., open > 24h)
            const overdue = ticketsData.filter(t => t.status !== 'closed' && t.status !== 'resolved' && new Date(t.created_at) < new Date(Date.now() - 86400000)).length

            setMetrics({ openTickets: open, highPriority: high, pendingSuggestions: pending, overdue })

        } catch (err) {
            console.error('Error fetching admin support data:', err)
            toastError('Erro ao carregar dados.')
        } finally {
            setLoading(false)
        }
    }

    const fetchTicketMessages = async (ticketId) => {
        const { data, error } = await supabase
            .from('support_messages')
            .select('*, profiles(full_name)')
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true })

        if (!error) setTicketMessages(data)
    }

    const handleSendMessage = async (e) => {
        e.preventDefault()
        if (!newReply.trim()) return

        try {
            const { error } = await supabase.from('support_messages').insert({
                ticket_id: selectedTicket.id,
                sender_id: user.id,
                message: newReply,
                is_internal_note: isInternalNote
            })

            if (error) throw error

            setNewReply('')
            setIsInternalNote(false)
            fetchTicketMessages(selectedTicket.id)
            success('Mensagem enviada')
        } catch (err) {
            toastError('Erro ao enviar mensagem')
        }
    }

    const handleUpdateStatus = async (id, status) => {
        try {
            const { error } = await supabase
                .from('support_tickets')
                .update({ status })
                .eq('id', id)

            if (error) throw error

            setTickets(prev => prev.map(t => t.id === id ? { ...t, status } : t))
            if (selectedTicket?.id === id) setSelectedTicket(prev => ({ ...prev, status }))
            success(`Status alterado para ${status}`)
        } catch (err) {
            toastError('Falha ao atualizar status')
        }
    }

    const handleSuggestionStatus = async (id, status) => {
        try {
            const { error } = await supabase
                .from('product_suggestions')
                .update({ status })
                .eq('id', id)

            if (error) throw error

            setSuggestions(prev => prev.map(s => s.id === id ? { ...s, status } : s))
            success(`Sugestão movida para ${status}`)
        } catch (err) {
            toastError('Falha ao atualizar sugestão')
        }
    }

    const filteredTickets = tickets.filter(t => statusFilter === 'all' || t.status === statusFilter)

    return (
        <div className="space-y-8 w-full flex flex-col h-screen max-h-screen overflow-hidden p-6 pb-20 md:pb-6">
            <header className="flex justify-between items-start flex-shrink-0">
                <div>
                    <h2 className="text-3xl font-black text-[#13283b] uppercase tracking-tighter mb-1">Central de Suporte</h2>
                    <p className="text-slate-400 font-medium tracking-wide text-sm">Gerencie chamados e ouça seus clientes.</p>
                </div>

                <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-100">
                    <button
                        onClick={() => setViewMode('tickets')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'tickets' ? 'bg-[#13283b] text-white' : 'text-slate-400 hover:text-[#13283b]'
                            }`}
                    >
                        <MessageSquare size={14} /> Atendimento
                    </button>
                    <button
                        onClick={() => setViewMode('suggestions')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${viewMode === 'suggestions' ? 'bg-[#13283b] text-white' : 'text-slate-400 hover:text-[#13283b]'
                            }`}
                    >
                        <Lightbulb size={14} /> Sugestões
                    </button>
                </div>
            </header>

            {/* Metrics Dashboard */}
            <div className="grid grid-cols-4 gap-4 flex-shrink-0">
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Chamados Abertos</p>
                        <h3 className="text-2xl font-black text-[#13283b]">{metrics.openTickets}</h3>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-xl text-blue-600"><Inbox size={20} /></div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Alta Prioridade</p>
                        <h3 className="text-2xl font-black text-[#13283b]">{metrics.highPriority}</h3>
                    </div>
                    <div className="bg-red-50 p-3 rounded-xl text-red-600"><AlertCircle size={20} /></div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Atrasados (24h+)</p>
                        <h3 className="text-2xl font-black text-[#13283b]">{metrics.overdue}</h3>
                    </div>
                    <div className="bg-amber-50 p-3 rounded-xl text-amber-600"><Clock size={20} /></div>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-1">Sugestões Novas</p>
                        <h3 className="text-2xl font-black text-[#13283b]">{metrics.pendingSuggestions}</h3>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-xl text-purple-600"><Lightbulb size={20} /></div>
                </div>
            </div>

            {viewMode === 'tickets' ? (
                <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
                    {/* Ticket List */}
                    <div className="w-[350px] bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 flex flex-col overflow-hidden flex-shrink-0">
                        <div className="p-4 border-b border-slate-50 grid grid-cols-4 gap-2">
                            {['all', 'open', 'in_progress', 'resolved'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3 py-2 rounded-xl text-[10px] xl:text-xs font-black uppercase tracking-widest transition-all truncate ${statusFilter === status
                                        ? 'bg-[#13283b] text-white shadow-lg shadow-slate-200'
                                        : 'bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                                        }`}
                                >
                                    {status === 'all' ? 'Todos' : status === 'open' ? 'Novos' : status === 'in_progress' ? 'Atendendo' : 'Fechados'}
                                </button>
                            ))}
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            {loading ? (
                                <div className="text-center py-10 uppercase text-[10px] font-bold text-slate-300 animate-pulse">Carregando...</div>
                            ) : filteredTickets.length === 0 ? (
                                <div className="text-center py-20 uppercase text-[10px] font-bold text-slate-300">Nenhum chamado encontrado</div>
                            ) : filteredTickets.map(ticket => (
                                <button
                                    key={ticket.id}
                                    onClick={() => setSelectedTicket(ticket)}
                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${selectedTicket?.id === ticket.id
                                        ? 'border-[#13283b] bg-blue-50/50'
                                        : 'border-transparent hover:bg-slate-50'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <StatusBadge status={ticket.status} />
                                        <span className="text-[9px] text-slate-400 font-bold">{new Date(ticket.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <h4 className="font-bold text-[#13283b] text-sm line-clamp-2 mb-2">{ticket.subject}</h4>
                                    <div className="flex items-center justify-between">
                                        <p className="text-[10px] text-slate-500 font-medium truncate max-w-[120px]">{ticket.profiles?.full_name}</p>
                                        <PriorityBadge priority={ticket.priority} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Ticket Chat / Detail */}
                    <div className="flex-1 bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/30 flex flex-col overflow-hidden">
                        {selectedTicket ? (
                            <>
                                <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 font-bold text-lg">
                                            {selectedTicket.profiles?.full_name?.charAt(0)}
                                        </div>
                                        <div>
                                            <h3 className="font-black text-[#13283b] text-lg leading-none">{selectedTicket.profiles?.full_name}</h3>
                                            <p className="text-xs text-slate-400 font-medium">{selectedTicket.profiles?.email}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {['in_progress', 'resolved', 'closed'].map(s => (
                                            <button
                                                key={s}
                                                onClick={() => handleUpdateStatus(selectedTicket.id, s)}
                                                disabled={selectedTicket.status === s}
                                                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-colors ${selectedTicket.status === s
                                                    ? 'bg-slate-100 text-slate-400 border-slate-200 opacity-50'
                                                    : 'bg-white border-slate-200 text-[#13283b] hover:bg-[#13283b] hover:text-white'
                                                    }`}
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30 custom-scrollbar">
                                    <div className="flex items-center gap-4">
                                        <PriorityBadge priority={selectedTicket.priority} />
                                        <div className="h-px flex-1 bg-slate-100" />
                                        <button
                                            onClick={async () => {
                                                const newValue = !selectedTicket.churn_risk_flag
                                                const { error } = await supabase
                                                    .from('support_tickets')
                                                    .update({ churn_risk_flag: newValue })
                                                    .eq('id', selectedTicket.id)

                                                if (!error) {
                                                    setSelectedTicket(prev => ({ ...prev, churn_risk_flag: newValue }))
                                                    setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, churn_risk_flag: newValue } : t))
                                                    success(newValue ? 'Marcado como Risco de Churn' : 'Risco de Churn removido')
                                                }
                                            }}
                                            className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${selectedTicket.churn_risk_flag
                                                ? 'bg-red-500 text-white shadow-red-200 shadow-lg animate-pulse'
                                                : 'bg-slate-50 text-slate-300 hover:bg-red-50 hover:text-red-500'
                                                }`}
                                        >
                                            {selectedTicket.churn_risk_flag ? '⚠️ Risco de Churn' : 'Marcar Risco de Churn'}
                                        </button>
                                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                                            <Clock size={12} />
                                            Aberto em {new Date(selectedTicket.created_at).toLocaleString()}
                                        </div>
                                    </div>

                                    <div className="bg-white p-10 rounded-[2rem] border border-slate-100 shadow-sm relative">
                                        <div className="flex justify-between items-center mb-2">
                                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Descrição Inicial</span>
                                        </div>
                                        <p className="text-sm font-medium text-slate-700">{selectedTicket.description}</p>
                                    </div>

                                    {ticketMessages.map(msg => (
                                        <div key={msg.id} className={`flex ${msg.is_internal_note ? 'justify-center' : msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}>
                                            {msg.is_internal_note ? (
                                                <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2 text-xs font-bold text-amber-700 flex items-center gap-2">
                                                    <Lock size={12} /> Nota Interna: {msg.message}
                                                </div>
                                            ) : (
                                                <div className={`rounded-2xl p-4 max-w-[80%] ${msg.sender_id === user.id ? 'bg-[#13283b] text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'}`}>
                                                    <p className="text-xs font-bold mb-1 opacity-50 uppercase tracking-wider">{msg.sender_id === user.id ? 'Você' : selectedTicket.profiles?.full_name}</p>
                                                    <p className="text-sm">{msg.message}</p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-50">
                                    <div className="flex gap-2 mb-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsInternalNote(!isInternalNote)}
                                            className={`flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-colors ${isInternalNote ? 'bg-amber-100 text-amber-700' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                                        >
                                            {isInternalNote ? <Lock size={10} /> : <Unlock size={10} />}
                                            Nota Interna
                                        </button>
                                    </div>
                                    <div className="flex gap-3">
                                        <input
                                            type="text"
                                            placeholder={isInternalNote ? "Adicionar nota visível apenas para admins..." : "Escreva uma resposta para o cliente..."}
                                            className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium outline-none border transition-all ${isInternalNote
                                                ? 'bg-amber-50 border-amber-200 text-amber-900 placeholder:text-amber-300'
                                                : 'bg-slate-50 border-transparent text-[#13283b] focus:bg-white focus:border-slate-200'
                                                }`}
                                            value={newReply}
                                            onChange={e => setNewReply(e.target.value)}
                                        />
                                        <button type="submit" className="bg-[#13283b] text-white w-12 h-12 rounded-xl flex items-center justify-center hover:scale-105 transition-transform shadow-md">
                                            <Send size={18} />
                                        </button>
                                    </div>
                                </form>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-300 opacity-50">
                                <MessageSquare size={48} />
                                <p className="mt-4 text-xs font-black uppercase tracking-widest">Selecione um chamado</p>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                // Suggestions Kanban
                <div className="flex-1 min-h-0 pb-4 overflow-hidden">
                    <div className="grid grid-cols-5 gap-3 h-full w-full px-2">
                        {['new', 'analyzing', 'planned', 'implemented', 'rejected'].map(status => {
                            const items = suggestions.filter(s => s.status === status)
                            const titles = { new: 'Novas', analyzing: 'Em Análise', planned: 'Planejado', implemented: 'Implementado', rejected: 'Rejeitado' }
                            const colors = { new: 'border-blue-200 bg-blue-50', analyzing: 'border-purple-200 bg-purple-50', planned: 'border-amber-200 bg-amber-50', implemented: 'border-green-200 bg-green-50', rejected: 'border-slate-200 bg-slate-50' }

                            return (
                                <div
                                    key={status}
                                    className="flex flex-col h-full rounded-2xl bg-slate-50/50 border border-slate-100 min-w-0 transition-colors"
                                    onDragOver={(e) => {
                                        e.preventDefault()
                                        e.currentTarget.classList.add('bg-slate-100')
                                    }}
                                    onDragLeave={(e) => {
                                        e.currentTarget.classList.remove('bg-slate-100')
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault()
                                        e.currentTarget.classList.remove('bg-slate-100')
                                        const suggestionId = e.dataTransfer.getData('text/plain')
                                        if (suggestionId) {
                                            handleSuggestionStatus(suggestionId, status)
                                        }
                                    }}
                                >
                                    <div className={`p-4 border-b-2 ${colors[status]} rounded-t-2xl mb-2`}>
                                        <h3 className="font-black text-[#13283b] uppercase tracking-tighter text-[10px] xl:text-xs flex justify-between items-center gap-1">
                                            <span className="truncate">{titles[status]}</span>
                                            <span className="bg-white/50 px-2 py-0.5 rounded-full text-[9px] flex-shrink-0">{items.length}</span>
                                        </h3>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                                        {items.map(s => (
                                            <div
                                                key={s.id}
                                                draggable
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData('text/plain', s.id)
                                                    e.currentTarget.style.opacity = '0.4'
                                                }}
                                                onDragEnd={(e) => {
                                                    e.currentTarget.style.opacity = '1'
                                                }}
                                                className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing group"
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${s.perceived_impact === 'high' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-400'
                                                        }`}>
                                                        {s.type}
                                                    </span>
                                                    <span className="text-[9px] text-slate-300 font-medium">{new Date(s.created_at).toLocaleDateString()}</span>
                                                </div>
                                                <p className="text-xs font-bold text-[#13283b] mb-3 line-clamp-3">{s.description}</p>
                                                <div className="flex items-center gap-2 mb-3">
                                                    <div className="w-4 h-4 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold">
                                                        {s.profiles?.full_name?.charAt(0)}
                                                    </div>
                                                    <span className="text-[9px] text-slate-400 font-bold truncate">{s.profiles?.full_name}</span>
                                                </div>

                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}
        </div>
    )
}

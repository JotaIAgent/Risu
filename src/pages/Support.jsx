import { useState, useEffect } from 'react'
import { MessageCircle, Clock, Lightbulb, ChevronRight, HelpCircle, ArrowLeft, Send, CheckCircle2, AlertTriangle, FileText } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useDialog } from '../components/DialogProvider'

export default function Support() {
    const { user } = useAuth()
    const { success, error, toast } = useDialog()
    const [view, setView] = useState('hub') // 'hub', 'new_ticket', 'list_tickets', 'new_suggestion'
    const [selectedTicket, setSelectedTicket] = useState(null)

    // --- SUB-COMPONENTS ---

    const NEW_TICKET_FORM = () => {
        const [formData, setFormData] = useState({
            category: 'duvida',
            subject: '',
            description: '',
            priority: 'medium'
        })
        const [loading, setLoading] = useState(false)

        const handleSubmit = async (e) => {
            e.preventDefault()
            if (!formData.subject || !formData.description) {
                toast('Preencha os campos obrigatórios', 'error')
                return
            }

            setLoading(true)
            try {
                // 1. Get company name if possible (optional)
                // In a real app we might fetch the profile, but RLS handles the user_id association automatically via auth.uid()

                // Auto-set priority based on category
                let autoPriority = 'low'
                if (formData.category === 'erro') autoPriority = 'high'
                else if (formData.category === 'financeiro') autoPriority = 'medium'

                const { error: insertError } = await supabase.from('support_tickets').insert({
                    user_id: user.id,
                    category: formData.category,
                    subject: formData.subject,
                    description: formData.description,
                    priority: autoPriority,
                    status: 'open'
                })

                if (insertError) throw insertError

                success('Solicitação recebida! Em breve nosso time entrará em contato.')
                setView('hub')
            } catch (err) {
                console.error('Error creating ticket:', err)
                error('Erro ao abrir chamado. Tente novamente.')
            } finally {
                setLoading(false)
            }
        }

        return (
            <div className="max-w-2xl mx-auto w-full">
                <button onClick={() => setView('hub')} className="mb-6 flex items-center text-slate-400 hover:text-slate-600 transition-colors font-bold uppercase text-xs tracking-widest">
                    <ArrowLeft size={16} className="mr-2" />
                    Voltar para Ajuda
                </button>

                <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/40 overflow-hidden border border-slate-100">
                    <div className="p-8 border-b border-slate-50 bg-slate-50/30">
                        <h2 className="text-2xl font-black text-[#13283b] uppercase tracking-tighter mb-2">Abrir Novo Chamado</h2>
                        <p className="text-slate-400 font-medium text-sm">Descreva seu problema ou dúvida detalhadamente.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Categoria</label>
                            <select
                                className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] focus:bg-white focus:border-blue-100 outline-none transition-all"
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                            >
                                <option value="duvida">Dúvida Geral</option>
                                <option value="erro">Erro / Bug</option>
                                <option value="financeiro">Financeiro</option>
                                <option value="uso">Uso do Sistema</option>
                                <option value="outro">Outro</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Assunto</label>
                            <input
                                type="text"
                                placeholder="Resumo do problema..."
                                className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] focus:bg-white focus:border-blue-100 outline-none transition-all placeholder:text-slate-300"
                                value={formData.subject}
                                onChange={e => setFormData({ ...formData, subject: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Descrição Detalhada</label>
                            <textarea
                                rows={6}
                                placeholder="Conte-nos o que aconteceu, passos para reproduzir, etc..."
                                className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-medium text-[#13283b] focus:bg-white focus:border-blue-100 outline-none transition-all placeholder:text-slate-300 resize-none"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div className="pt-4 flex justify-end">
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-8 py-4 bg-[#13283b] text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-slate-200 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading ? 'Enviando...' : (
                                    <>
                                        Abrir Chamado <Send size={16} />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )
    }

    const SUGGESTION_FORM = () => {
        const [formData, setFormData] = useState({
            type: 'improvement',
            description: '',
            perceived_impact: 'medium'
        })
        const [loading, setLoading] = useState(false)

        const handleSubmit = async (e) => {
            e.preventDefault()
            if (!formData.description) {
                toast('Descreva sua sugestão', 'error')
                return
            }

            setLoading(true)
            try {
                const { error: insertError } = await supabase.from('product_suggestions').insert({
                    user_id: user.id,
                    type: formData.type,
                    description: formData.description,
                    perceived_impact: formData.perceived_impact,
                    status: 'new'
                })

                if (insertError) throw insertError

                success('Obrigado! Sua ideia foi enviada para nossa equipe de produto.')
                setView('hub')
            } catch (err) {
                console.error('Error sending suggestion:', err)
                error('Erro ao enviar sugestão.')
            } finally {
                setLoading(false)
            }
        }

        return (
            <div className="max-w-2xl mx-auto w-full">
                <button onClick={() => setView('hub')} className="mb-6 flex items-center text-slate-400 hover:text-slate-600 transition-colors font-bold uppercase text-xs tracking-widest">
                    <ArrowLeft size={16} className="mr-2" />
                    Voltar para Ajuda
                </button>

                <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/40 overflow-hidden border border-slate-100">
                    <div className="p-8 border-b border-slate-50 bg-amber-50/30">
                        <h2 className="text-2xl font-black text-[#13283b] uppercase tracking-tighter mb-2 flex items-center gap-2">
                            <Lightbulb className="text-amber-500" size={24} /> Enviar Sugestão
                        </h2>
                        <p className="text-slate-400 font-medium text-sm">Ajude a construir o futuro do Risu.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="p-8 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Tipo</label>
                                <select
                                    className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-bold text-[#13283b] focus:bg-white focus:border-amber-100 outline-none transition-all"
                                    value={formData.type}
                                    onChange={e => setFormData({ ...formData, type: e.target.value })}
                                >
                                    <option value="new_feature">Nova Funcionalidade</option>
                                    <option value="improvement">Melhoria</option>
                                    <option value="integration">Integração</option>
                                    <option value="other">Outro</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Impacto (Na sua visão)</label>
                                <div className="flex bg-slate-50 rounded-2xl p-1.5">
                                    {['low', 'medium', 'high'].map(p => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, perceived_impact: p })}
                                            className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${formData.perceived_impact === p
                                                ? 'bg-amber-500 text-white shadow-lg shadow-amber-200'
                                                : 'text-slate-400 hover:text-slate-600 hover:bg-white'
                                                }`}
                                        >
                                            {p === 'low' ? 'Baixo' : p === 'medium' ? 'Médio' : 'Alto'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Sua Ideia</label>
                            <textarea
                                rows={6}
                                placeholder="Descreva sua sugestão..."
                                className="w-full px-6 py-4 bg-slate-50 border border-transparent rounded-2xl text-sm font-medium text-[#13283b] focus:bg-white focus:border-amber-100 outline-none transition-all placeholder:text-slate-300 resize-none"
                                value={formData.description}
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </div>

                        <div className="pt-4 flex justify-end">
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-8 py-4 bg-amber-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-amber-200 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {loading ? 'Enviando...' : (
                                    <>
                                        Enviar Ideia <Send size={16} />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )
    }

    const TICKET_LIST = () => {
        const [tickets, setTickets] = useState([])
        const [loading, setLoading] = useState(true)

        useEffect(() => {
            fetchTickets()
        }, [])

        const fetchTickets = async () => {
            try {
                const { data, error } = await supabase
                    .from('support_tickets')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false })

                if (error) throw error
                setTickets(data)
            } catch (err) {
                console.error('Error fetching tickets:', err)
            } finally {
                setLoading(false)
            }
        }

        const getStatusBadge = (status) => {
            const styles = {
                open: 'bg-blue-100 text-blue-700',
                in_progress: 'bg-amber-100 text-amber-700',
                waiting_user: 'bg-purple-100 text-purple-700',
                resolved: 'bg-green-100 text-green-700',
                closed: 'bg-slate-100 text-slate-500'
            }
            const labels = {
                open: 'Aberto',
                in_progress: 'Em Análise',
                waiting_user: 'Aguardando Você',
                resolved: 'Resolvido',
                closed: 'Fechado'
            }
            return (
                <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${styles[status]}`}>
                    {labels[status] || status}
                </span>
            )
        }

        return (
            <div className="max-w-4xl mx-auto w-full">
                <button onClick={() => setView('hub')} className="mb-6 flex items-center text-slate-400 hover:text-slate-600 transition-colors font-bold uppercase text-xs tracking-widest">
                    <ArrowLeft size={16} className="mr-2" />
                    Voltar para Ajuda
                </button>

                <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/40 overflow-hidden border border-slate-100 min-h-[500px] flex flex-col">
                    <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-black text-[#13283b] uppercase tracking-tighter mb-2">Meus Chamados</h2>
                            <p className="text-slate-400 font-medium text-sm">Histórico de solicitações.</p>
                        </div>
                        <button onClick={() => setView('new_ticket')} className="bg-[#13283b] text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all">
                            Novo Chamado
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto p-4">
                        {loading ? (
                            <div className="text-center py-20 text-slate-400 uppercase tracking-widest font-bold text-xs animate-pulse">Carregando chamados...</div>
                        ) : tickets.length === 0 ? (
                            <div className="text-center py-20 flex flex-col items-center gap-4">
                                <FileText size={48} className="text-slate-200" />
                                <p className="text-slate-400 uppercase tracking-widest font-bold text-xs">Nenhum chamado encontrado.</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {tickets.map(ticket => (
                                    <div key={ticket.id} className="bg-white border border-slate-100 rounded-2xl p-6 hover:shadow-md transition-all group cursor-pointer">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <span className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center font-bold text-xs text-slate-400">
                                                    #{ticket.id.slice(0, 4)}
                                                </span>
                                                <div>
                                                    <h4 className="font-bold text-[#13283b]">{ticket.subject}</h4>
                                                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                                        {new Date(ticket.created_at).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                            {getStatusBadge(ticket.status)}
                                        </div>
                                        <p className="text-sm text-slate-500 line-clamp-2 pl-[3.25rem] mb-4">
                                            {ticket.description}
                                        </p>
                                        <div className="flex justify-end border-t border-slate-50 pt-4 opacity-50 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => { setSelectedTicket(ticket); setView('ticket_details') }}
                                                className="text-[10px] font-black uppercase tracking-widest text-[#13283b] flex items-center hover:text-blue-600 transition-colors"
                                            >
                                                Ver Detalhes <ChevronRight size={14} className="ml-1" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    const TICKET_DETAIL = () => {
        const [messages, setMessages] = useState([])
        const [newMessage, setNewMessage] = useState('')
        const [sending, setSending] = useState(false)
        const [loadingMessages, setLoadingMessages] = useState(true)

        useEffect(() => {
            fetchMessages()
            // Real-time subscription could go here
        }, [selectedTicket])

        const fetchMessages = async () => {
            try {
                const { data, error } = await supabase
                    .from('support_messages')
                    .select('*, profiles(full_name)')
                    .eq('ticket_id', selectedTicket.id)
                    .eq('is_internal_note', false)
                    .order('created_at', { ascending: true })

                if (error) throw error
                setMessages(data)
            } catch (err) {
                console.error('Error fetching messages:', err)
            } finally {
                setLoadingMessages(false)
            }
        }

        const handleSendMessage = async (e) => {
            e.preventDefault()
            if (!newMessage.trim()) return

            setSending(true)
            try {
                const { error } = await supabase.from('support_messages').insert({
                    ticket_id: selectedTicket.id,
                    sender_id: user.id,
                    message: newMessage,
                    is_internal_note: false
                })

                if (error) throw error

                setNewMessage('')
                fetchMessages() // Refresh list
            } catch (err) {
                error('Erro ao enviar mensagem')
            } finally {
                setSending(false)
            }
        }

        return (
            <div className="max-w-4xl mx-auto w-full h-[600px] flex flex-col">
                <button onClick={() => setView('list_tickets')} className="mb-6 flex items-center text-slate-400 hover:text-slate-600 transition-colors font-bold uppercase text-xs tracking-widest flex-shrink-0">
                    <ArrowLeft size={16} className="mr-2" />
                    Voltar para Lista
                </button>

                <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/40 overflow-hidden border border-slate-100 flex-1 flex flex-col">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex justify-between items-center flex-shrink-0">
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-lg font-black text-[#13283b] uppercase tracking-tighter">
                                    {selectedTicket.subject}
                                </h2>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${selectedTicket.status === 'resolved' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                    }`}>
                                    {selectedTicket.status === 'open' ? 'Aberto' : selectedTicket.status === 'resolved' ? 'Resolvido' : selectedTicket.status}
                                </span>
                            </div>
                            <p className="text-slate-400 font-medium text-xs">Protocolo: #{selectedTicket.id.split('-')[0]}</p>
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/20 custom-scrollbar">
                        {/* Original Description as first message */}
                        <div className="flex justify-end">
                            <div className="bg-blue-50 text-blue-900 rounded-2xl rounded-tr-none p-4 max-w-[80%] shadow-sm">
                                <p className="text-sm font-bold opacity-50 mb-1 text-[10px] uppercase tracking-wider">Você (Abertura)</p>
                                <p className="text-sm">{selectedTicket.description}</p>
                                <span className="text-[10px] opacity-40 mt-2 block font-bold">{new Date(selectedTicket.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        </div>

                        {loadingMessages ? (
                            <div className="text-center text-slate-300 text-xs font-bold uppercase animate-pulse">Carregando mensagens...</div>
                        ) : messages.map(msg => {
                            const isMe = msg.sender_id === user.id
                            return (
                                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`
                                        rounded-2xl p-4 max-w-[80%] shadow-sm
                                        ${isMe ? 'bg-blue-50 text-blue-900 rounded-tr-none' : 'bg-white border border-slate-100 text-[#13283b] rounded-tl-none'}
                                    `}>
                                        <p className="text-sm font-bold opacity-50 mb-1 text-[10px] uppercase tracking-wider">
                                            {isMe ? 'Você' : msg.profiles?.full_name || 'Suporte Risu'}
                                        </p>
                                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                                        <span className="text-[10px] opacity-40 mt-2 block font-bold text-right">
                                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-50 flex gap-4 flex-shrink-0">
                        <input
                            type="text"
                            className="flex-1 bg-slate-50 border-transparent focus:bg-white focus:border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none transition-all placeholder:text-slate-300 text-[#13283b]"
                            placeholder="Digite sua resposta..."
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                            disabled={selectedTicket.status === 'closed'}
                        />
                        <button
                            type="submit"
                            disabled={sending || !newMessage.trim() || selectedTicket.status === 'closed'}
                            className="bg-[#13283b] text-white w-12 h-12 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                        >
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            </div>
        )
    }

    // --- MAIN RENDER ---

    return (
        <div className="flex-1 flex flex-col p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
            <header className="mb-8">
                <h1 className="text-3xl font-black text-[#13283b] uppercase tracking-tighter flex items-center gap-3">
                    <HelpCircle size={32} />
                    Ajuda & Suporte
                </h1>
                <p className="text-slate-400 font-medium text-lg mt-1 ml-10">
                    Como podemos ajudar você hoje?
                </p>
            </header>

            {view === 'hub' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-bottom-10 duration-500">
                    {/* Card 1: Abrir Chamado */}
                    <button
                        onClick={() => setView('new_ticket')}
                        className="group bg-white rounded-[2rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/40 hover:scale-[1.02] transition-all text-left flex flex-col h-full relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-32 bg-blue-50/50 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-blue-100/50"></div>
                        <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors relative z-10">
                            <MessageCircle size={32} />
                        </div>
                        <h3 className="text-xl font-black text-[#13283b] mb-2 relative z-10">Abrir Chamado</h3>
                        <p className="text-slate-400 font-medium text-sm mb-8 relative z-10">
                            Relate um problema, dúvida ou erro. Nossa equipe responderá o mais rápido possível.
                        </p>
                        <div className="mt-auto flex items-center text-blue-600 font-bold text-sm uppercase tracking-widest relative z-10">
                            Iniciar Atendimento <ChevronRight size={16} className="ml-2" />
                        </div>
                    </button>

                    {/* Card 2: Meus Chamados */}
                    <button
                        onClick={() => setView('list_tickets')}
                        className="group bg-white rounded-[2rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/40 hover:scale-[1.02] transition-all text-left flex flex-col h-full relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-32 bg-indigo-50/50 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-indigo-100/50"></div>
                        <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-colors relative z-10">
                            <Clock size={32} />
                        </div>
                        <h3 className="text-xl font-black text-[#13283b] mb-2 relative z-10">Meus Chamados</h3>
                        <p className="text-slate-400 font-medium text-sm mb-8 relative z-10">
                            Acompanhe o status das suas solicitações e veja o histórico de conversas.
                        </p>
                        <div className="mt-auto flex items-center text-indigo-600 font-bold text-sm uppercase tracking-widest relative z-10">
                            Ver Histórico <ChevronRight size={16} className="ml-2" />
                        </div>
                    </button>

                    {/* Card 3: Enviar Sugestão */}
                    <button
                        onClick={() => setView('new_suggestion')}
                        className="group bg-white rounded-[2rem] p-8 border border-slate-100 shadow-xl shadow-slate-200/40 hover:scale-[1.02] transition-all text-left flex flex-col h-full relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-32 bg-amber-50/50 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-amber-100/50"></div>
                        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-6 group-hover:bg-amber-600 group-hover:text-white transition-colors relative z-10">
                            <Lightbulb size={32} />
                        </div>
                        <h3 className="text-xl font-black text-[#13283b] mb-2 relative z-10">Enviar Sugestão</h3>
                        <p className="text-slate-400 font-medium text-sm mb-8 relative z-10">
                            Tem uma ideia para melhorar o Risu? Queremos ouvir você!
                        </p>
                        <div className="mt-auto flex items-center text-amber-600 font-bold text-sm uppercase tracking-widest relative z-10">
                            Compartilhar Ideia <ChevronRight size={16} className="ml-2" />
                        </div>
                    </button>
                </div>
            )}

            {view === 'new_ticket' && <NEW_TICKET_FORM />}
            {view === 'list_tickets' && <TICKET_LIST />}
            {view === 'ticket_details' && <TICKET_DETAIL />}
            {view === 'new_suggestion' && <SUGGESTION_FORM />}
        </div>
    )
}

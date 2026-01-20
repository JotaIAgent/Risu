import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Calendar from 'react-calendar'
import 'react-calendar/dist/Calendar.css'
import { format, isSameDay, parseISO, startOfDay, addDays, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, LayoutList, CalendarDays as CalendarDaysIcon, Loader2 } from 'lucide-react'
import { AgendaDayView } from '../components/agenda/AgendaDayView'
import { useDialog } from '../components/DialogProvider'

export default function RentalCalendar() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const { alert: dialogAlert, confirm: dialogConfirm, success, error: toastError } = useDialog()
    const [rentals, setRentals] = useState([])
    const [events, setEvents] = useState([])
    const [loading, setLoading] = useState(true)
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [viewMode, setViewMode] = useState('day') // 'day' | 'month'

    useEffect(() => {
        if (user) {
            fetchRentals()
        }
    }, [user])

    // Re-process events whenever rentals change
    useEffect(() => {
        if (rentals.length > 0) {
            const processed = processRentalsToEvents(rentals)
            setEvents(processed)
        }
    }, [rentals])

    async function fetchRentals() {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('rentals')
                .select(`
                    *,
                    customers (name, whatsapp),
                    rental_items (
                        quantity,
                        items (name, photo_url)
                    )
                `)
                .eq('user_id', user.id)
                .neq('status', 'canceled')

            if (error) throw error
            setRentals(data || [])
        } catch (error) {
            console.error('Error fetching rentals:', error)
            toastError('Erro ao carregar agenda.')
        } finally {
            setLoading(false)
        }
    }

    // Transform Rentals into Atomic Events (Delivery, Event, Return)
    const processRentalsToEvents = (rentalsData) => {
        const evts = []
        rentalsData.forEach(r => {
            const start = r.delivery_date || r.start_date
            const end = r.return_date || r.end_date

            // 1. Delivery Event
            evts.push({
                ...r,
                id: `del-${r.id}`,
                original_id: r.id,
                date: start,
                time: r.delivery_time || '09:00',
                type: 'delivery',
                is_delivery_day: true,
                is_return_day: false
            })

            // 2. Return Event (only if different day, or same day distinct event? For now always Add return event)
            if (start !== end) {
                evts.push({
                    ...r,
                    id: `ret-${r.id}`,
                    original_id: r.id,
                    date: end,
                    time: r.return_time || '18:00',
                    type: 'return',
                    is_delivery_day: false,
                    is_return_day: true
                })
            } else {
                // Same day rental = Single Event card with both indicators? 
                // Currently AgendaEventCard handles one primary logic. 
                // Let's keep them separate for clarity list items? 
                // Or maybe the 'delivery' event handles the "Whole Rental" representation for same-day.
                // For clarity in logistics: A Same Day rental implies a Delivery AND A Return.
                // It shows up TWICE in the list? Or once?
                // Providing distinct events allows checking off delivery and return separately. Good.
                evts.push({
                    ...r,
                    id: `ret-${r.id}`,
                    original_id: r.id,
                    date: end,
                    time: r.return_time || '18:00',
                    type: 'return',
                    is_delivery_day: false,
                    is_return_day: true
                })
            }
        })
        return evts
    }

    const handleAction = async (action, event) => {
        if (action === 'open_details') {
            navigate(`/rentals/${event.original_id}`)
            return
        }

        if (action === 'toggle_logistics') {
            const current = event.logistics_status || 'pending'
            let next = 'pending'

            // UNDO LOGIC
            // 1. Undo Delivery
            if (event.type === 'delivery' && ['delivered', 'returned'].includes(current)) {
                if (current === 'returned') {
                    toastError('Não é possível cancelar a entrega pois o item já foi devolvido. Cancele a devolução primeiro.')
                    return
                }
                const confirmed = await dialogConfirm('Deseja cancelar a confirmação de entrega? O status voltará para "A Entregar".', 'Desfazer Entrega')
                if (!confirmed) return
                next = 'to_deliver'
            }
            // 2. Undo Return
            else if (event.type === 'return' && current === 'returned') {
                const confirmed = await dialogConfirm('Deseja cancelar a confirmação de devolução? O status voltará para "A Retirar".', 'Desfazer Devolução')
                if (!confirmed) return
                next = 'to_return'
            }
            // NORMAL FORWARD LOGIC
            else {
                if (event.type === 'delivery') {
                    if (current === 'pending') next = 'to_deliver'
                    else if (current === 'to_deliver') next = 'delivered'
                    else next = 'pending' // Should not reach here if delivered is handled above
                } else { // Return
                    if (current === 'delivered') next = 'to_return' // Start return process
                    else if (current === 'pending') next = 'to_return' // Fallback
                    else if (current === 'to_return') next = 'returned'
                    else next = 'to_return'
                }

                // Simplified Context Logic to ensure we don't jump weirdly
                if (current === 'pending') next = event.type === 'delivery' ? 'to_deliver' : 'to_return'
                // If I am 'to_deliver' and click -> delivered
                if (current === 'to_deliver' && event.type === 'delivery') next = 'delivered'
                // If I am 'to_return' and click -> returned
                if (current === 'to_return' && event.type === 'return') next = 'returned'
            }

            try {
                const { error } = await supabase
                    .from('rentals')
                    .update({ logistics_status: next })
                    .eq('id', event.original_id)

                if (error) throw error

                // Optimistic Update
                setRentals(prev => prev.map(r => r.id === event.original_id ? { ...r, logistics_status: next } : r))
                success('Status atualizado com sucesso!')
            } catch (err) {
                console.error(err)
                toastError('Erro ao atualizar status.')
            }
        }
    }

    const tileContent = ({ date, view }) => {
        if (view === 'month') {
            const dayEvents = events.filter(e => isSameDay(parseISO(e.date), date))
            if (dayEvents.length > 0) {
                const deliveries = dayEvents.filter(e => e.type === 'delivery').length
                const returns = dayEvents.filter(e => e.type === 'return').length
                return (
                    <div className="flex justify-center mt-1 gap-1">
                        {deliveries > 0 && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                        {returns > 0 && <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />}
                    </div>
                )
            }
        }
        return null
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-text-primary-light dark:text-text-primary-dark uppercase flex items-center gap-3">
                        <CalendarIcon size={32} className="text-primary" />
                        Agenda Operacional
                    </h2>
                    <p className="text-text-secondary-light dark:text-text-secondary-dark text-sm font-medium mt-1 ml-1">
                        Gerencie entregas, eventos e retiradas do dia a dia.
                    </p>
                </div>

                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                        onClick={() => setViewMode('day')}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'day' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-text-secondary-light hover:text-text-primary-light'}`}
                    >
                        <LayoutList size={16} />
                        Dia
                    </button>
                    <button
                        onClick={() => setViewMode('month')}
                        className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${viewMode === 'month' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-text-secondary-light hover:text-text-primary-light'}`}
                    >
                        <CalendarDaysIcon size={16} />
                        Mês
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

                {/* Left Column: Calendar Navigation (Always visible in desktop, or conditionally?) */}
                {/* For mobile-first, maybe hide big calendar if in Day mode? But "Month View" toggle handles that. */}
                {/* If Day Mode: Show small date nav + List. If Month Mode: Show Big Calendar. */}

                <div className={`space-y-6 ${viewMode === 'day' ? 'hidden lg:block lg:col-span-1' : 'block lg:col-span-3'}`}>
                    <div className="app-card p-6">
                        <style>{`
                            .react-calendar { width: 100%; border: none; background: transparent; font-family: inherit; }
                            .react-calendar__navigation button { color: var(--text-primary); font-weight: 800; text-transform: uppercase; font-size: 0.8rem; }
                            .react-calendar__month-view__weekdays__weekday { text-decoration: none; text-transform: uppercase; font-size: 0.7rem; font-weight: 900; color: var(--text-secondary); padding: 0.5rem 0; }
                            .react-calendar__tile { 
                                padding: ${viewMode === 'month' ? '1rem 0.5rem' : '0.75rem 0.25rem'}; 
                                display: flex; 
                                flex-direction: column; 
                                align-items: center; 
                                border-radius: 0.5rem; 
                                height: ${viewMode === 'month' ? '100px' : 'auto'};
                                justify-content: flex-start;
                            }
                            .react-calendar__tile--now { background: var(--primary) !important; color: white !important; }
                            .react-calendar__tile--active { background: var(--secondary) !important; color: white !important; }
                        `}</style>
                        <Calendar
                            onChange={(d) => { setSelectedDate(d); setViewMode('day') }} // Auto switch to day on click
                            value={selectedDate}
                            locale="pt-BR"
                            tileContent={tileContent}
                            className="bg-transparent border-none"
                        />
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-4 px-2">
                        <div className="flex items-center gap-2 text-text-secondary-light">
                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                            <span className="text-[10px] font-bold uppercase">Entregas</span>
                        </div>
                        <div className="flex items-center gap-2 text-text-secondary-light">
                            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                            <span className="text-[10px] font-bold uppercase">Retiradas</span>
                        </div>
                    </div>
                </div>

                {/* Right Column: The Agenda List (Main Content) */}
                <div className={`${viewMode === 'month' ? 'hidden' : 'lg:col-span-2 col-span-1'}`}>
                    {/* Day Navigation Header (Only in Day View) */}
                    <div className="bg-white dark:bg-surface-dark p-4 rounded-xl border border-border-light dark:border-border-dark shadow-sm mb-6 flex items-center justify-between sticky top-4 z-10">
                        <button onClick={() => setSelectedDate(subDays(selectedDate, 1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <ChevronLeft size={20} className="text-text-secondary-light" />
                        </button>

                        <div className="text-center">
                            <h3 className="text-lg font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-tight flex items-center gap-2 justify-center">
                                {isSameDay(selectedDate, new Date()) && <span className="text-[10px] bg-primary text-white px-2 py-0.5 rounded-full align-middle">HOJE</span>}
                                {format(selectedDate, "eeee, dd 'de' MMMM", { locale: ptBR })}
                            </h3>
                            <p className="text-[10px] font-bold text-text-secondary-light uppercase tracking-widest mt-0.5">
                                Visão Diária Detalhada
                            </p>
                        </div>

                        <button onClick={() => setSelectedDate(addDays(selectedDate, 1))} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <ChevronRight size={20} className="text-text-secondary-light" />
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" size={40} /></div>
                    ) : (
                        <AgendaDayView
                            date={selectedDate}
                            events={events}
                            onAction={handleAction}
                        />
                    )}
                </div>

            </div>
        </div>
    )
}

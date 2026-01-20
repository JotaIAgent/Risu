import React from 'react'
import { format, isSameDay, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { AgendaEventCard } from './AgendaEventCard'
import { CalendarX, PackageOpen } from 'lucide-react'

export function AgendaDayView({ date, events, onAction }) {
    // Filter events for this day
    const dayEvents = events.filter(e => isSameDay(parseISO(e.date), date))

    // Sort by time
    dayEvents.sort((a, b) => {
        const timeA = a.time || '00:00'
        const timeB = b.time || '00:00'
        return timeA.localeCompare(timeB)
    })

    if (dayEvents.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/20">
                <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-4">
                    <CalendarX className="text-slate-300 dark:text-slate-600" size={32} />
                </div>
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">Agenda Livre</h3>
                <p className="text-sm text-slate-500 dark:text-slate-500 max-w-xs mx-auto mt-2">
                    Nenhuma entrega, retirada ou evento programado para este dia.
                </p>
            </div>
        )
    }

    // Group by period (Manhã, Tarde, Noite) could be cool, but simple list first.
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between mb-2 px-2">
                <h3 className="text-sm font-black uppercase tracking-widest text-text-secondary-light">
                    Cronograma do Dia
                </h3>
                <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-bold uppercase tracking-wide">
                    {dayEvents.length} Atividades
                </span>
            </div>

            <div className="space-y-3">
                {dayEvents.map((event, idx) => (
                    <AgendaEventCard
                        key={`${event.id}-${event.type}-${idx}`}
                        event={event}
                        onAction={onAction}
                    />
                ))}
            </div>

            {/* Stock Summary for the day? (Premium feature later) */}
        </div>
    )
}

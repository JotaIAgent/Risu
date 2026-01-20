import React from 'react'
import { format, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
    Truck,
    CheckCircle2,
    AlertCircle,
    Clock,
    DollarSign,
    MapPin,
    Package,
    ChevronDown,
    CalendarCheck,
    CalendarX,
    PartyPopper
} from 'lucide-react'

// Helper to determine status color
const getStatusColor = (status, type) => {
    if (status === 'canceled') return 'text-slate-400 bg-slate-100 dark:bg-slate-800'
    if (status === 'completed') return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
    if (type === 'quote') return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20'
    return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' // Active
}

const getLogisticsIcon = (status) => {
    switch (status) {
        case 'delivered': return <CheckCircle2 size={14} className="text-emerald-500" />
        case 'to_deliver': return <Truck size={14} className="text-amber-500" />
        case 'returned': return <CheckCircle2 size={14} className="text-blue-500" />
        case 'to_return': return <Truck size={14} className="text-purple-500" />
        default: return <Clock size={14} className="text-slate-400" />
    }
}

const getEventTypeIcon = (type) => {
    switch (type) {
        case 'delivery': return <Truck size={16} />
        case 'return': return <CalendarCheck size={16} /> // Or something indicating return
        default: return <PartyPopper size={16} /> // Event
    }
}

export function AgendaEventCard({ event, onAction }) {
    // derive display props
    const isDelivery = event.is_delivery_day
    const isReturn = event.is_return_day

    // Fallback logic for legacy data
    const logisticsStatus = event.logistics_status || 'pending'
    const paymentStatus = event.payment_status || 'pending'
    const amountPaid = event.amount_paid || 0
    const totalValue = event.total_value || 0
    const isPaid = paymentStatus === 'paid' || (totalValue > 0 && amountPaid >= totalValue)

    // Event Type Display
    let eventTypeLabel = 'Evento'
    let eventTypeColor = 'text-indigo-500'
    if (isDelivery) { eventTypeLabel = 'Entrega / Instalação'; eventTypeColor = 'text-blue-500' }
    if (isReturn) { eventTypeLabel = 'Retirada / Desmontagem'; eventTypeColor = 'text-purple-500' }

    // Time Formatting
    const timeString = isDelivery ? (event.delivery_time || '09:00') : isReturn ? (event.return_time || '18:00') : 'Dia Todo'

    // Context-Aware Logistics Status
    let displayStatus = 'Pendente'
    let displayIcon = <Clock size={14} className="text-slate-400" />
    let canToggle = true
    let isCompletedStep = false

    if (isDelivery) {
        if (logisticsStatus === 'pending') {
            displayStatus = 'Pendente'
            displayIcon = <Clock size={14} className="text-slate-400" />
        } else if (logisticsStatus === 'to_deliver') {
            displayStatus = 'Saiu p/ Entrega'
            displayIcon = <Truck size={14} className="text-amber-500 animate-pulse" />
        } else if (['delivered', 'to_return', 'returned'].includes(logisticsStatus)) {
            displayStatus = 'Entregue'
            displayIcon = <CheckCircle2 size={14} className="text-emerald-500" />
            isCompletedStep = true
            canToggle = true
        }
    } else if (isReturn) {
        if (['pending', 'to_deliver'].includes(logisticsStatus)) {
            displayStatus = 'Aguardando Entrega'
            displayIcon = <Clock size={14} className="text-slate-300" />
            canToggle = false
        } else if (logisticsStatus === 'delivered') {
            displayStatus = 'Agendar Retirada'
            displayIcon = <Package size={14} className="text-blue-500" />
            canToggle = true
        } else if (logisticsStatus === 'to_return') {
            displayStatus = 'A Retirar'
            displayIcon = <Truck size={14} className="text-purple-500 animate-pulse" />
            canToggle = true
        } else if (logisticsStatus === 'returned') {
            displayStatus = 'Devolvido'
            displayIcon = <CheckCircle2 size={14} className="text-emerald-500" />
            isCompletedStep = true
            canToggle = true
        }
    }

    return (
        <div className={`group relative bg-white dark:bg-surface-dark rounded-xl border shadow-sm transition-all p-4 flex flex-col gap-3 ${isCompletedStep ? 'border-emerald-100/50 opacity-75 hover:opacity-100' : 'border-border-light dark:border-border-dark hover:shadow-md'}`}>
            {/* Header: Time & Status */}
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-500`}>
                        {timeString.slice(0, 5)}
                    </span>
                    <span className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest ${eventTypeColor} bg-opacity-10`}>
                        {eventTypeLabel}
                    </span>
                </div>
                {/* Status Chips */}
                <div className="flex gap-1">
                    {/* Payment Status Badge */}
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase border ${isPaid ? 'border-emerald-200 text-emerald-600 bg-emerald-50' : 'border-amber-200 text-amber-600 bg-amber-50'}`} title={isPaid ? "Pago" : "Pagamento Pendente"}>
                        <DollarSign size={10} />
                        {isPaid ? 'OK' : 'Pendente'}
                    </div>
                </div>
            </div>

            {/* Body: Client & Items */}
            <div>
                <h4 className="font-bold text-text-primary-light dark:text-text-primary-dark truncate text-sm flex items-center gap-2">
                    {event.customers?.name || 'Cliente Desconhecido'}
                </h4>
                <div className="mt-1 flex flex-wrap gap-1">
                    {event.rental_items?.slice(0, 3).map((ri, i) => (
                        <span key={i} className="px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800 rounded text-[9px] font-medium text-text-secondary-light border border-slate-100 dark:border-slate-700">
                            {ri.quantity}x {ri.items?.name}
                        </span>
                    ))}
                    {(event.rental_items?.length || 0) > 3 && (
                        <span className="px-1.5 py-0.5 text-[9px] font-medium text-text-secondary-light">+{event.rental_items.length - 3} itens</span>
                    )}
                </div>
            </div>

            {/* Footer: Logistics & Actions */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs px-2 py-1 -ml-2 text-text-secondary-light">
                    {displayStatus !== 'Pendente' && (
                        <>
                            {displayIcon}
                            <span className="font-medium uppercase text-[10px] tracking-wide">
                                {displayStatus}
                            </span>
                        </>
                    )}
                </div>

                <button
                    onClick={(e) => { e.stopPropagation(); onAction('open_details', event) }}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-bold text-text-secondary-light transition-colors"
                >
                    Ver
                </button>
            </div>
        </div>
    )
}

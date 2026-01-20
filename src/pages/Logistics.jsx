import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MapPin, Truck, Calendar, Clock, CheckCircle, Navigation, Search, Filter, Phone, User, Package, ChevronRight, AlertCircle, RefreshCw, AlertTriangle, ArrowRight, ArrowLeft, Undo2 } from 'lucide-react'
import { format, isSameDay, parseISO, startOfDay, addDays, isBefore, isAfter } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import DriversManager from '../components/DriversManager'
import { useDialog } from '../components/DialogProvider'
import PageTitle from '../components/PageTitle'

// Helper Enums
const LOGISTICS_STATUS = {
    PENDING: 'pending',
    STEP_1_PREPARATION: 'step_1_preparation',
    STEP_2_TO_DELIVER: 'step_2_to_deliver',
    STEP_3_IN_TRANSIT: 'step_3_in_transit',
    STEP_4_DELIVERED: 'step_4_delivered',
    STEP_5_TO_RETURN: 'step_5_to_return',
    STEP_6_RETURNING: 'step_6_returning',
    STEP_7_RETURNED: 'step_7_returned'
}

export default function Logistics() {
    const { user } = useAuth()
    const navigate = useNavigate()
    const { confirm, alert: dialogAlert, success, error: toastError } = useDialog()

    // State
    const [rentals, setRentals] = useState([]) // Raw rental data
    const [drivers, setDrivers] = useState([])
    const [loading, setLoading] = useState(true)
    const [storeAddress, setStoreAddress] = useState('Endereço da Loja não configurado')

    // Filters
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [filterDriver, setFilterDriver] = useState('all')
    const [filterStatus, setFilterStatus] = useState('all')

    // UI State
    const [showDriversManager, setShowDriversManager] = useState(false)
    const [expandedTaskId, setExpandedTaskId] = useState(null)

    useEffect(() => {
        fetchSettings()
        fetchData()
    }, [selectedDate]) // Re-fetch when date changes

    async function fetchSettings() {
        const { data } = await supabase
            .from('user_settings')
            .select('owner_street, owner_number, owner_neighborhood, owner_city, owner_state')
            .eq('user_id', user.id)
            .maybeSingle()

        if (data && data.owner_street) {
            setStoreAddress(`${data.owner_street}, ${data.owner_number} - ${data.owner_neighborhood}, ${data.owner_city} - ${data.owner_state}`)
        }
    }

    async function fetchData() {
        try {
            setLoading(true)
            await Promise.all([fetchTasks(), fetchDrivers()])
        } catch (error) {
            console.error('Error fetching logistics data:', error)
        } finally {
            setLoading(false)
        }
    }

    async function fetchDrivers() {
        const { data } = await supabase.from('drivers').select('*').eq('active', true).order('name')
        if (data) setDrivers(data)
    }

    async function fetchTasks() {
        const dateStr = format(selectedDate, 'yyyy-MM-dd')

        const { data, error } = await supabase
            .from('rentals')
            .select(`
                *,
                customers (name, whatsapp),
                rental_items (quantity, items(name))
            `)
            .eq('user_id', user.id)
            .neq('status', 'canceled')
            .or(`delivery_date.eq.${dateStr},return_date.eq.${dateStr},start_date.eq.${dateStr},end_date.eq.${dateStr}`)

        if (error) throw error
        setRentals(data || [])
    }

    // Computed Tasks (Memoized to update when storeAddress changes)
    const tasks = useMemo(() => {
        const dateStr = format(selectedDate, 'yyyy-MM-dd')
        const logisticsTasks = []

        rentals.forEach(rental => {
            const deliveryDate = (rental.delivery_date || rental.start_date)?.split('T')[0]
            const returnDate = (rental.return_date || rental.end_date)?.split('T')[0]

            // 1. Start Task (Delivery or Pickup)
            if (deliveryDate === dateStr) {
                const isDelivery = rental.delivery_type === 'delivery'
                logisticsTasks.push({
                    id: `${rental.id}_start`,
                    rentalId: rental.id,
                    type: isDelivery ? 'delivery' : 'pickup',
                    rental: rental,
                    time: rental.delivery_time || '08:00',
                    address: isDelivery
                        ? (rental.address_street ? `${rental.address_street}, ${rental.address_number} - ${rental.address_neighborhood}` : 'Endereço não definido')
                        : storeAddress,
                    status: rental.logistics_status || 'pending',
                    driver_id: rental.delivery_driver_id || rental.driver_id,
                    isLate: isTaskLate(dateStr, rental.delivery_time, 'delivery', rental.logistics_status),
                    isCompleted: ['step_4_delivered'].includes(rental.logistics_status)
                })
            }

            // 2. End Task (Collection or Return)
            if (returnDate === dateStr) {
                const isCollection = rental.return_type === 'collection'
                logisticsTasks.push({
                    id: `${rental.id}_end`,
                    rentalId: rental.id,
                    type: isCollection ? 'collection' : 'return',
                    rental: rental,
                    time: rental.return_time || '18:00',
                    address: isCollection
                        ? (rental.address_street ? `${rental.address_street}, ${rental.address_number} - ${rental.address_neighborhood}` : 'Endereço não definido')
                        : storeAddress,
                    status: rental.logistics_status || 'pending',
                    driver_id: rental.collection_driver_id,
                    isLate: isTaskLate(dateStr, rental.return_time, 'collection', rental.logistics_status),
                    isCompleted: ['step_7_returned', 'returned'].includes(rental.logistics_status)
                })
            }
        })

        // Sort
        logisticsTasks.sort((a, b) => {
            const timeCompare = a.time.localeCompare(b.time)
            if (timeCompare !== 0) return timeCompare
            return a.id.localeCompare(b.id)
        })

        return logisticsTasks
    }, [rentals, storeAddress, selectedDate])

    function isTaskLate(dateStr, timeStr, type, status) {
        if (!dateStr || !timeStr) return false

        // Construct task date using local time parts to avoid time zone issues
        // dateStr is 'yyyy-MM-dd'
        // timeStr is 'HH:mm' or 'HH:mm:ss'
        const [year, month, day] = dateStr.split('-').map(Number)
        const [hours, minutes] = timeStr.split(':').map(Number)

        const taskDate = new Date(year, month - 1, day, hours, minutes)
        const now = new Date()

        // If task is in the future (> now), it is NEVER late
        if (taskDate > now) return false

        // If task is in the past (<= now), it is late IF not completed
        if (type === 'delivery') {
            return !['step_4_delivered', 'delivered'].includes(status)
        } else {
            return !['step_7_returned', 'returned', 'step_6_returning'].includes(status)
        }
    }

    async function handleAssignDriver(rentalId, driverId, taskType) {
        try {
            const updateData = {}
            if (taskType === 'delivery') {
                updateData.delivery_driver_id = driverId === 'none' ? null : driverId
                // Also update legacy driver_id for backward compatibility if needed, but let's stick to specific columns for clarity now.
                // Optionally: updateData.driver_id = driverId === 'none' ? null : driverId 
            } else {
                updateData.collection_driver_id = driverId === 'none' ? null : driverId
            }

            const { error } = await supabase
                .from('rentals')
                .update(updateData)
                .eq('id', rentalId)

            if (error) throw error
            success('Motorista atribuído com sucesso!')
            fetchTasks() // Refresh
        } catch (error) {
            console.error('Error assigning driver:', error)
            toastError('Erro ao atribuir motorista')
        }
    }

    async function handleStatusChange(task, newStatus) {

        // 1. INICIAR ROTA (Checklist Required)
        if (newStatus === LOGISTICS_STATUS.STEP_3_IN_TRANSIT && task.type === 'delivery') {
            // Validation: Checklists
            const { count } = await supabase
                .from('rental_checklists')
                .select('*', { count: 'exact', head: true })
                .eq('rental_id', task.rental.id)
                .eq('stage', 'CHECKOUT')

            if (count === 0) {
                const goToDetails = await confirm('Checklist de Saída Obrigatório! \n\nVocê precisa realizar a conferência dos itens antes de iniciar a rota. Deseja ir para a tela do aluguel agora?', 'Atenção')
                if (goToDetails) navigate(`/rentals/${task.rental.id}`)
                return
            }

            const confirmStart = await confirm('Confirma que os itens foram conferidos e carregados?', 'Iniciar Rota')
            if (!confirmStart) return
        }

        // 2. CONFIRMAR ENTREGA
        if (newStatus === LOGISTICS_STATUS.STEP_4_DELIVERED) {
            const confirmDel = await confirm('Confirmar entrega ao cliente?', 'Concluir Entrega')
            if (!confirmDel) return
        }

        // Revert Logic
        if (task.type === 'delivery' && task.status === LOGISTICS_STATUS.STEP_4_DELIVERED && newStatus !== LOGISTICS_STATUS.STEP_4_DELIVERED) {
            const confirmRevert = await confirm('Deseja cancelar a confirmação de entrega? Isso permitirá alterar o motorista novamente.', 'Desfazer Entrega')
            if (!confirmRevert) return
        }

        if (task.type === 'collection' && (task.status === LOGISTICS_STATUS.STEP_7_RETURNED || task.status === 'returned') && newStatus !== LOGISTICS_STATUS.STEP_7_RETURNED) {
            const confirmRevert = await confirm('Deseja cancelar a confirmação de devolução? Isso permitirá alterar o motorista novamente.', 'Desfazer Devolução')
            if (!confirmRevert) return
        }

        try {
            const updatePayload = { logistics_status: newStatus }

            // Automate Rental Status Status (User Request: "se saiu para entrega, mudar para em uso")
            // We map "In Transit" (Delivery) and "Delivered" (Pickup) to 'in_progress'
            // We avoid changing if already completed or canceled, although strictly filtered out.
            // We only change to in_progress, we do NOT auto-complete because that requires financial checks.

            if (
                (task.type === 'delivery' && newStatus === LOGISTICS_STATUS.STEP_3_IN_TRANSIT) || // Delivery started
                (task.type === 'pickup' && newStatus === LOGISTICS_STATUS.STEP_4_DELIVERED)    // Pickup finished (Client took checks)
            ) {
                updatePayload.status = 'in_progress'
            }

            const { error } = await supabase
                .from('rentals')
                .update(updatePayload)
                .eq('id', task.rental.id)

            if (error) throw error
            success('Status atualizado com sucesso!')
            fetchTasks()
        } catch (error) {
            console.error('Error updating status:', error)
            toastError('Erro ao atualizar status')
        }
    }

    const filteredTasks = tasks.filter(task => {
        if (filterDriver !== 'all' && task.driver_id !== filterDriver) return false
        if (filterStatus !== 'all' && task.status !== filterStatus) return false
        return true
    })

    return (
        <div className="space-y-6 pb-20">
            <PageTitle title="Logística" />
            {/* Header / Top Bar */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-surface-light dark:bg-surface-dark p-4 rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
                <div>
                    <h2 className="text-2xl font-black flex items-center gap-2 text-primary">
                        <Truck size={28} />
                        Operação Logística
                    </h2>
                    <p className="text-sm text-text-secondary-light font-medium">
                        Gestão de entregas, retiradas e motoristas em campo.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <button
                        onClick={() => setShowDriversManager(true)}
                        className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-text-primary-light dark:text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-colors"
                    >
                        <User size={18} />
                        Motoristas
                    </button>

                    {/* Date Navigation */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                        <button onClick={() => setSelectedDate(d => addDays(d, -1))} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all">
                            <ArrowLeft size={16} />
                        </button>
                        <div className="px-4 font-black uppercase text-sm w-32 text-center">
                            {isSameDay(selectedDate, new Date()) ? 'Hoje' : format(selectedDate, 'dd/MM')}
                        </div>
                        <button onClick={() => setSelectedDate(d => addDays(d, 1))} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all">
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap gap-2 items-center overflow-x-auto pb-2 no-scrollbar">
                <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-900 rounded-xl border border-border-light dark:border-border-dark shadow-sm">
                    <Filter size={14} className="text-text-secondary-light" />
                    <select
                        value={filterDriver}
                        onChange={e => setFilterDriver(e.target.value)}
                        className="bg-transparent border-none text-sm font-bold focus:ring-0 outline-none w-32 text-text-primary-light dark:text-text-primary-dark cursor-pointer"
                    >
                        <option value="all" className="bg-white dark:bg-slate-900 text-text-primary-light dark:text-text-primary-dark">Todos Motoristas</option>
                        {drivers.map(d => (
                            <option key={d.id} value={d.id} className="bg-white dark:bg-slate-900 text-text-primary-light dark:text-text-primary-dark">
                                {d.name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Stats Chips */}
                <div className="flex gap-2 ml-auto">
                    <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-100">
                        {tasks.filter(t => t.type === 'delivery' || t.type === 'pickup').length} Saídas
                    </span>
                    <span className="px-3 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold border border-purple-100">
                        {tasks.filter(t => t.type === 'collection' || t.type === 'return').length} Retornos
                    </span>
                </div>
            </div>

            {/* Task List */}
            <div className="space-y-4">
                {filteredTasks.length === 0 && !loading && (
                    <div className="text-center py-16 opacity-50 space-y-4">
                        <Truck size={48} className="mx-auto text-slate-300" />
                        <p className="text-lg font-bold">Nenhuma tarefa logística para esta data.</p>
                    </div>
                )}

                {filteredTasks.map(task => (
                    <div
                        key={task.id}
                        className={`
                            bg-white dark:bg-slate-900 rounded-2xl border-l-4 shadow-sm transition-all
                            ${task.type === 'delivery' ? 'border-l-blue-500' : 'border-l-purple-500'}
                            ${task.isLate ? 'ring-2 ring-red-500/30' : 'border border-border-light dark:border-border-dark'}
                            ${task.isCompleted ? 'opacity-75 bg-slate-50 dark:bg-slate-800/50' : ''}
                        `}
                    >
                        <div className="p-4 sm:p-5 flex flex-col md:flex-row gap-4 md:items-center">

                            {/* Time & Type */}
                            <div className="flex flex-row md:flex-col items-center md:items-start gap-3 md:w-24 shrink-0">
                                <div className="text-xl font-black text-text-primary-light dark:text-text-primary-dark">
                                    {task.time.slice(0, 5)}
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${task.type === 'delivery' ? 'bg-blue-100 text-blue-700' :
                                    task.type === 'collection' ? 'bg-purple-100 text-purple-700' :
                                        task.type === 'pickup' ? 'bg-orange-100 text-orange-700' :
                                            'bg-teal-100 text-teal-700' // return
                                    }`}>
                                    {task.type === 'delivery' ? 'Entrega' :
                                        task.type === 'collection' ? 'Retirada' :
                                            task.type === 'pickup' ? 'Cliente Retira' : 'Cliente Devolve'}
                                </span>
                            </div>

                            {/* Main Info */}
                            <div className="flex-1 min-w-0 pointer-events-none sm:pointer-events-auto" onClick={() => navigate(`/rentals/${task.rental.id}`)}>
                                <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-bold text-lg text-text-primary-light dark:text-text-primary-dark truncate cursor-pointer hover:underline">
                                        {task.rental.customers?.name}
                                    </h3>
                                    {task.isLate && (
                                        <span className="flex items-center gap-1 text-[10px] font-black uppercase bg-red-100 text-red-600 px-2 py-0.5 rounded-full animate-pulse">
                                            <AlertTriangle size={10} /> Atrasado
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-start gap-2 text-sm text-text-secondary-light group/address">
                                    <MapPin size={16} className="mt-0.5 shrink-0 text-primary" />
                                    <span className="line-clamp-2 font-medium">{task.address}</span>
                                    <a
                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(task.address)}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-1 p-1 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 opacity-0 group-hover/address:opacity-100 transition-all transform scale-90 hover:scale-100"
                                        title="Abrir no Google Maps"
                                        onClick={(e) => e.stopPropagation()} // Prevent card click
                                    >
                                        <Navigation size={14} />
                                    </a>
                                </div>
                            </div>

                            {/* Driver Select */}
                            <div className="w-full md:w-48 shrink-0">
                                <label className="text-[10px] font-bold text-text-secondary-light uppercase tracking-widest mb-1 block">Motorista</label>
                                <select
                                    className={`w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm font-semibold focus:ring-2 focus:ring-primary/20 
                                        ${task.isCompleted ? 'opacity-60 cursor-not-allowed' : ''}
                                    `}
                                    value={task.driver_id || 'none'}
                                    onChange={(e) => handleAssignDriver(task.rental.id, e.target.value, task.type)}
                                    disabled={task.isCompleted}
                                >
                                    <option value="none">-- Sem motorista --</option>
                                    {drivers.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                                {task.isCompleted && (
                                    <p className="text-[10px] text-text-secondary-light mt-1 text-center">
                                        *Desfaça a entrega para alterar
                                    </p>
                                )}
                            </div>

                            {/* Actions / Status */}
                            <div className="flex items-center justify-between md:justify-end gap-2 w-full md:w-auto mt-2 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-dashed border-slate-200 dark:border-slate-700">
                                {/* Only show actions relative to current state */}
                                <StatusActions
                                    task={task}
                                    onUpdate={(s) => handleStatusChange(task, s)}
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <DriversManager isOpen={showDriversManager} onClose={() => setShowDriversManager(false)} />
        </div>
    )
}

function StatusActions({ task, onUpdate }) {
    // Logic for actionable buttons based on status
    const s = task.status || 'pending'

    // DELIVERY FLOW (Outbound)
    if (task.type === 'delivery') {
        if (s === 'step_4_delivered') {
            return (
                <div className="flex items-center gap-2">
                    <button onClick={() => onUpdate('step_3_in_transit')} className="text-text-secondary-light hover:text-red-500 p-2 rounded-full" title="Desfazer Entrega">
                        <Undo2 size={18} />
                    </button>
                    <div className="flex items-center gap-2 text-green-600 font-bold bg-green-50 px-3 py-1.5 rounded-lg">
                        <CheckCircle size={18} /> Entregue
                    </div>
                </div>
            )
        }
        if (s === 'step_3_in_transit') {
            return (
                <button onClick={() => onUpdate('step_4_delivered')} className="app-button-primary bg-green-600 hover:bg-green-700 text-xs py-2 px-4 shadow-green-200">
                    <CheckCircle size={16} className="mr-2" /> Confirmar Entrega
                </button>
            )
        }
        return (
            <button onClick={() => onUpdate('step_3_in_transit')} className="app-button-primary text-xs py-2 px-4">
                <Truck size={16} className="mr-2" /> Iniciar Rota
            </button>
        )
    }

    // PICKUP FLOW (Client comes to Store)
    if (task.type === 'pickup') {
        if (s === 'step_4_delivered') {
            return (
                <div className="flex items-center gap-2">
                    <button onClick={() => onUpdate('step_3_in_transit')} className="text-text-secondary-light hover:text-red-500 p-2 rounded-full" title="Desfazer Retirada">
                        <Undo2 size={18} />
                    </button>
                    <div className="flex items-center gap-2 text-orange-600 font-bold bg-orange-50 px-3 py-1.5 rounded-lg">
                        <Package size={18} /> Retirado
                    </div>
                </div>
            )
        }
        // Skip 'In Transit' concept for pickup, go straight to delivered/picked up? 
        // Or keep 2 steps: "Prepare" -> "Picked Up"?
        // Current logic maps generic statuses. step_3_in_transit is mostly "Ready/Out".
        // Let's simplify: Button "Confirmar Retirada" -> marks as step_4_delivered directly?
        // Or "Marcar Pronto" -> "Confirmar Retirada"?
        // Let's stick to existing logic mapping for now: step_3 -> step_4.

        if (s === 'step_3_in_transit') {
            return (
                <button onClick={() => onUpdate('step_4_delivered')} className="app-button-primary bg-orange-600 hover:bg-orange-700 text-xs py-2 px-4 shadow-orange-200">
                    <CheckCircle size={16} className="mr-2" /> Confirmar Retirada
                </button>
            )
        }
        return (
            <button onClick={() => onUpdate('step_3_in_transit')} className="app-button-primary bg-orange-600 hover:bg-orange-700 text-xs py-2 px-4 shadow-orange-200">
                <Package size={16} className="mr-2" /> Liberar Pedido
            </button>
        )
    }

    // COLLECTION FLOW (Inbound - Truck)
    if (task.type === 'collection') {
        if (s === 'step_7_returned') {
            return (
                <div className="flex items-center gap-2">
                    <button onClick={() => onUpdate('step_6_returning')} className="text-text-secondary-light hover:text-red-500 p-2 rounded-full" title="Desfazer Devolução">
                        <Undo2 size={18} />
                    </button>
                    <div className="flex items-center gap-2 text-gray-500 font-bold bg-gray-100 px-3 py-1.5 rounded-lg">
                        <CheckCircle size={18} /> Devolvido
                    </div>
                </div>
            )
        }
        if (s === 'step_6_returning') {
            return (
                <button onClick={() => onUpdate('step_7_returned')} className="app-button-primary bg-purple-600 hover:bg-purple-700 text-xs py-2 px-4 shadow-green-200">
                    <Package size={16} className="mr-2" /> Confirmar Retorno
                </button>
            )
        }
        return (
            <button onClick={() => onUpdate('step_6_returning')} className="app-button-primary bg-purple-600 hover:bg-purple-700 text-xs py-2 px-4 shadow-purple-200">
                <Truck size={16} className="mr-2" /> Iniciar Coleta
            </button>
        )
    }

    // RETURN FLOW (Client comes to Store)
    if (task.type === 'return') {
        if (s === 'step_7_returned') {
            return (
                <div className="flex items-center gap-2">
                    <button onClick={() => onUpdate('step_6_returning')} className="text-text-secondary-light hover:text-red-500 p-2 rounded-full" title="Desfazer Devolução">
                        <Undo2 size={18} />
                    </button>
                    <div className="flex items-center gap-2 text-teal-600 font-bold bg-teal-50 px-3 py-1.5 rounded-lg">
                        <CheckCircle size={18} /> Devolvido
                    </div>
                </div>
            )
        }
        if (s === 'step_6_returning') {
            return (
                <button onClick={() => onUpdate('step_7_returned')} className="app-button-primary bg-teal-600 hover:bg-teal-700 text-xs py-2 px-4 shadow-teal-200">
                    <CheckCircle size={16} className="mr-2" /> Confirmar Devolução
                </button>
            )
        }
        return (
            <button onClick={() => onUpdate('step_6_returning')} className="app-button-primary bg-teal-600 hover:bg-teal-700 text-xs py-2 px-4 shadow-teal-200">
                <Package size={16} className="mr-2" /> Receber Devolução
            </button>
        )
    }
}

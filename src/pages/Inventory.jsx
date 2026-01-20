
import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Edit, Trash2, Eye, Package, Clock, AlertTriangle, Hammer, Wrench } from 'lucide-react'
import { useDialog } from '../components/DialogProvider'
import PageTitle from '../components/PageTitle'

export default function Inventory() {
    const [searchParams] = useSearchParams()
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [items, setItems] = useState([])
    const [maintenanceLogs, setMaintenanceLogs] = useState([])
    const [lostLogs, setLostLogs] = useState([])
    const [brokenLogs, setBrokenLogs] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'catalog')
    const { confirm, alert: dialogAlert, prompt, success, error: toastError } = useDialog()

    useEffect(() => {
        fetchData()
    }, [selectedDate])

    async function fetchData() {
        setLoading(true)
        try {
            const [itemsData, maintData, lostData, brokenData, rentedItemsData] = await Promise.all([
                supabase.from('items').select('*').order('created_at', { ascending: false }),
                supabase.from('maintenance_logs').select('*, items(name, photo_url)').eq('status', 'OPEN').order('entry_date', { ascending: false }),
                supabase.from('lost_logs').select('*, items(name, photo_url)').eq('status', 'OPEN').order('entry_date', { ascending: false }),
                supabase.from('broken_logs').select('*, items(name, photo_url)').eq('status', 'OPEN').order('entry_date', { ascending: false }),
                supabase.from('rental_items')
                    .select('item_id, quantity, rentals!inner(status, start_date, return_date)')
                    .in('rentals.status', ['active', 'in_progress', 'confirmed', 'pending'])
                    .lte('rentals.start_date', selectedDate)
                    .gte('rentals.return_date', selectedDate)
            ])

            if (itemsData.error) throw itemsData.error
            if (maintData.error) throw maintData.error
            if (lostData.error) throw lostData.error
            if (rentedItemsData.error) throw rentedItemsData.error

            const rawItems = itemsData.data || []
            const rawMaint = maintData.data || []
            const rawLost = lostData.data || []
            const rawBroken = brokenData.data || []
            const rawRentedItems = rentedItemsData.data || []

            // Calculate active rentals per item using the junction table
            const rentedMap = rawRentedItems.reduce((acc, r) => {
                acc[r.item_id] = (acc[r.item_id] || 0) + (r.quantity || 0)
                return acc
            }, {})

            // Discrepancy Detection (Maintenance)
            const ghostMaint = []
            rawItems.forEach(item => {
                const rented = rentedMap[item.id] || 0
                item.rented_quantity = rented // Attach virtual property

                if (item.maintenance_quantity > 0) {
                    const loggedSum = rawMaint.filter(l => l.item_id === item.id).reduce((acc, l) => acc + l.quantity, 0)
                    if (item.maintenance_quantity > loggedSum) {
                        ghostMaint.push({
                            id: `ghost-m-${item.id}`,
                            item_id: item.id,
                            quantity: item.maintenance_quantity - loggedSum,
                            entry_date: item.created_at,
                            status: 'OPEN',
                            is_ghost: true,
                            items: { name: item.name, photo_url: item.photo_url }
                        })
                    }
                }
            })

            // Discrepancy Detection (Lost)
            const ghostLost = []
            rawItems.forEach(item => {
                if (item.lost_quantity > 0) {
                    const loggedSum = rawLost.filter(l => l.item_id === item.id).reduce((acc, l) => acc + l.quantity, 0)
                    if (item.lost_quantity > loggedSum) {
                        ghostLost.push({
                            id: `ghost-l-${item.id}`,
                            item_id: item.id,
                            quantity: item.lost_quantity - loggedSum,
                            entry_date: item.created_at,
                            status: 'OPEN',
                            is_ghost: true,
                            items: { name: item.name, photo_url: item.photo_url }
                        })
                    }
                }
            })

            // Discrepancy Detection (Broken)
            const ghostBroken = []
            rawItems.forEach(item => {
                if (item.broken_quantity > 0) {
                    const loggedSum = rawBroken.filter(l => l.item_id === item.id).reduce((acc, l) => acc + l.quantity, 0)
                    if (item.broken_quantity > loggedSum) {
                        ghostBroken.push({
                            id: `ghost-b-${item.id}`,
                            item_id: item.id,
                            quantity: item.broken_quantity - loggedSum,
                            entry_date: item.created_at,
                            status: 'OPEN',
                            is_ghost: true,
                            items: { name: item.name, photo_url: item.photo_url }
                        })
                    }
                }
            })

            setItems(rawItems)
            setMaintenanceLogs([...rawMaint, ...ghostMaint])
            setLostLogs([...rawLost, ...ghostLost])
            setBrokenLogs([...rawBroken, ...ghostBroken])
        } catch (error) {
            console.error('Error fetching data:', error)
            toastError('Erro ao carregar dados')
        } finally {
            setLoading(false)
        }
    }

    async function handleRepairSync(item_id, type, qty) {
        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const logTable = type === 'maintenance' ? 'maintenance_logs' : type === 'lost' ? 'lost_logs' : 'broken_logs'
            const { error } = await supabase.from(logTable).insert({
                item_id,
                user_id: user.id,
                quantity: qty,
                status: 'OPEN'
            })

            if (error) throw error
            fetchData()
        } catch (error) {
            console.error('Error repairing sync:', error)
            toastError('Erro ao sincronizar logs')
        }
    }

    async function handleDelete(id) {
        if (!await confirm('Deseja excluir este item permanentemente?', 'Excluir Item')) return

        try {
            const { error } = await supabase.from('items').delete().eq('id', id)
            if (error) throw error
            success('Item excluído com sucesso!')
            fetchData()
        } catch (error) {
            console.error('Error deleting item:', error)
            toastError('Erro ao excluir item')
        }
    }

    async function handleReturn(log) {
        const response = await prompt(`Quantas unidades de "${log.items?.name}" estão retornando ao estoque?`, log.quantity, 'Concluir Manutenção')
        if (response === null) return
        const qty = parseInt(response)

        if (isNaN(qty) || qty <= 0 || qty > log.quantity) {
            toastError(`Quantidade inválida. Escolha entre 1 e ${log.quantity}.`)
            return
        }

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // 1. Update item counter
            const { data: item } = await supabase.from('items').select('maintenance_quantity').eq('id', log.item_id).single()
            const currentMaintenance = item?.maintenance_quantity || 0

            const { error: itemError } = await supabase
                .from('items')
                .update({ maintenance_quantity: Math.max(0, currentMaintenance - qty) })
                .eq('id', log.item_id)

            if (itemError) throw itemError

            // 2. Handle log closure (skip logic if ghost)
            if (!log.is_ghost) {
                if (qty === log.quantity) {
                    // Full closure
                    const { error: logError } = await supabase
                        .from('maintenance_logs')
                        .update({ status: 'CLOSED', closed_at: new Date().toISOString() })
                        .eq('id', log.id)
                    if (logError) throw logError
                } else {
                    // Partial closure: Split log
                    const { error: decrError } = await supabase
                        .from('maintenance_logs')
                        .update({ quantity: log.quantity - qty })
                        .eq('id', log.id)
                    if (decrError) throw decrError

                    const { error: newLogError } = await supabase
                        .from('maintenance_logs')
                        .insert({
                            item_id: log.item_id,
                            user_id: user.id,
                            quantity: qty,
                            status: 'CLOSED',
                            entry_date: log.entry_date,
                            closed_at: new Date().toISOString()
                        })
                    if (newLogError) throw newLogError
                }
            }

            success('Manutenção concluída com sucesso!')
            fetchData()
        } catch (error) {
            console.error('Error returning item:', error)
            toastError('Erro ao retornar item')
        }
    }

    async function handleReturnLost(log, resolution) {
        const actionLabel = resolution === 'FOUND' ? 'Encontrado' : 'Consertado'
        const response = await prompt(`Quantas unidades de "${log.items?.name}" foram identificadas como ${actionLabel}?`, log.quantity, 'Recuperar Item')
        if (response === null) return
        const qty = parseInt(response)

        if (isNaN(qty) || qty <= 0 || qty > log.quantity) {
            toastError(`Quantidade inválida. Escolha entre 1 e ${log.quantity}.`)
            return
        }

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // 1. Update item counter
            const { data: item } = await supabase.from('items').select('lost_quantity').eq('id', log.item_id).single()
            const currentLost = item?.lost_quantity || 0

            const { error: itemError } = await supabase
                .from('items')
                .update({ lost_quantity: Math.max(0, currentLost - qty) })
                .eq('id', log.item_id)

            if (itemError) throw itemError

            // 2. Handle log closure (skip logic if ghost)
            if (!log.is_ghost) {
                if (qty === log.quantity) {
                    // Full closure
                    const { error: logError } = await supabase
                        .from('lost_logs')
                        .update({
                            status: 'CLOSED',
                            resolution: resolution,
                            closed_at: new Date().toISOString()
                        })
                        .eq('id', log.id)
                    if (logError) throw logError
                } else {
                    // Partial closure: Split log
                    const { error: decrError } = await supabase
                        .from('lost_logs')
                        .update({ quantity: log.quantity - qty })
                        .eq('id', log.id)
                    if (decrError) throw decrError

                    const { error: newLogError } = await supabase
                        .from('lost_logs')
                        .insert({
                            item_id: log.item_id,
                            user_id: user.id,
                            quantity: qty,
                            status: 'CLOSED',
                            resolution: resolution,
                            entry_date: log.entry_date,
                            closed_at: new Date().toISOString()
                        })
                    if (newLogError) throw newLogError
                }
            }

            success('Item recuperado com sucesso!')
            fetchData()
        } catch (error) {
            console.error('Error returning lost item:', error)
            toastError('Erro ao recuperar item')
        }
    }

    async function handleSendToMaintenance(log) {
        const response = await prompt(`Enviar quantas unidades de "${log.items?.name}" para manutenção?`, log.quantity, 'Enviar para Manutenção')
        if (response === null) return
        const qty = parseInt(response)

        if (isNaN(qty) || qty <= 0 || qty > log.quantity) {
            toastError(`Quantidade inválida. Escolha entre 1 e ${log.quantity}.`)
            return
        }

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // 1. Update Broken Log (Close if full, Decrement if partial)
            if (qty === log.quantity) {
                await supabase.from('broken_logs').update({ status: 'CLOSED', closed_at: new Date().toISOString() }).eq('id', log.id)
            } else {
                await supabase.from('broken_logs').update({ quantity: log.quantity - qty }).eq('id', log.id)
            }

            // 2. Decrement Item Broken Quantity
            const { data: item } = await supabase.from('items').select('broken_quantity, maintenance_quantity').eq('id', log.item_id).single()
            await supabase.from('items').update({ broken_quantity: Math.max(0, (item.broken_quantity || 0) - qty) }).eq('id', log.item_id)

            // 3. Create Maintenance Log
            await supabase.from('maintenance_logs').insert({
                item_id: log.item_id,
                user_id: user.id,
                quantity: qty,
                status: 'OPEN',
                entry_date: new Date().toISOString(),
                reason: 'BROKEN'
            })

            // 4. Increment Maintenance Quantity
            await supabase.from('items').update({ maintenance_quantity: (item.maintenance_quantity || 0) + qty }).eq('id', log.item_id)

            fetchData()
            success('Enviado para manutenção com sucesso!')

        } catch (error) {
            console.error('Error sending to maintenance:', error)
            toastError('Erro ao enviar para manutenção')
        }
    }

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <p className="mt-4 text-text-secondary-light dark:text-text-secondary-dark font-medium uppercase tracking-widest text-xs">Carregando inventário...</p>
        </div>
    )

    return (
        <div className="space-y-8 pb-12">
            <PageTitle title="Estoque" />
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex flex-col gap-4">
                    <div>
                        <h2 className="text-3xl font-black text-text-primary-light dark:text-text-primary-dark tracking-tight">Inventário</h2>
                        <p className="text-text-secondary-light dark:text-text-secondary-dark font-medium mt-1">Gerencie seu estoque e disponibilidade em tempo real.</p>
                    </div>

                    <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl w-fit">
                        {[
                            { id: 'catalog', label: 'Catálogo', count: items.length },
                            { id: 'maintenance', label: 'Manutenção', count: maintenanceLogs.reduce((acc, l) => acc + l.quantity, 0) },
                            { id: 'broken', label: 'Avarias', count: brokenLogs.reduce((acc, l) => acc + l.quantity, 0) },
                            { id: 'lost', label: 'Perdas', count: lostLogs.reduce((acc, l) => acc + l.quantity, 0) }
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-6 py-2 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 ${activeTab === tab.id
                                    ? 'bg-white dark:bg-slate-700 text-primary shadow-sm'
                                    : 'text-text-secondary-light hover:text-text-primary-light'
                                    }`}
                            >
                                <span>{tab.label}</span>
                                {tab.count > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-md text-[8px] ${activeTab === tab.id ? 'bg-primary/10 text-primary' : 'bg-slate-200 dark:bg-slate-800'}`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-xl border border-border-light dark:border-border-dark shadow-sm">
                        <span className="text-xs font-bold text-text-secondary-light uppercase ml-2">Data:</span>
                        <input
                            type="date"
                            onClick={(e) => { try { e.target.showPicker() } catch (error) { } }}
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent font-bold text-sm outline-none text-text-primary-light dark:text-text-primary-dark"
                        />
                    </div>
                    <Link to="/inventory/new" className="px-6 py-2 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 text-sm whitespace-nowrap">
                        <Plus size={18} />
                        Novo Item
                    </Link>
                </div>
            </div>

            {/* Stock Health Dashboard Header */}
            {items.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {[
                        { label: 'Total de Ativos', value: items.reduce((acc, i) => acc + (i.total_quantity || 0), 0), color: 'text-primary' },
                        { label: `Disponível em ${selectedDate ? format(new Date(selectedDate + 'T12:00:00'), 'dd/MM') : '--/--'}`, value: items.reduce((acc, i) => acc + ((i.total_quantity || 0) - (i.maintenance_quantity || 0) - (i.lost_quantity || 0) - (i.broken_quantity || 0) - (i.rented_quantity || 0)), 0), color: 'text-secondary' },
                        { label: 'Em Manutenção', value: items.reduce((acc, i) => acc + (i.maintenance_quantity || 0), 0), color: 'text-warning' },
                        { label: 'Avariados', value: items.reduce((acc, i) => acc + (i.broken_quantity || 0), 0), color: 'text-orange-500' },
                        { label: 'Baixas (Perdas)', value: items.reduce((acc, i) => acc + (i.lost_quantity || 0), 0), color: 'text-danger' },
                    ].map((stat, idx) => (
                        <div key={idx} className="app-card p-4 flex flex-col items-center justify-center text-center min-w-0">
                            <span className="text-[10px] font-black uppercase tracking-wider text-text-secondary-light/60 mb-1 truncate w-full">{stat.label}</span>
                            <span className={`text-2xl font-black ${stat.color} truncate w-full`}>{stat.value}</span>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'catalog' ? (
                items.length === 0 ? (
                    <div className="app-card flex flex-col items-center justify-center py-24 text-center">
                        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-full mb-6">
                            <Package size={64} className="text-text-secondary-light/20" />
                        </div>
                        <p className="text-text-secondary-light dark:text-text-secondary-dark font-bold uppercase tracking-widest text-xs">Inventário Vazio</p>
                        <p className="text-text-secondary-light/60 text-sm mt-2 max-w-xs mx-auto">Você ainda não cadastrou nenhum item no catálogo de produtos.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {items.map((item) => {
                            const total = item.total_quantity || 0;
                            const rented = item.rented_quantity || 0;
                            const maintenance = item.maintenance_quantity || 0;
                            const broken = item.broken_quantity || 0;
                            const lost = item.lost_quantity || 0;
                            const available = Math.max(0, total - maintenance - lost - broken - rented);
                            const netCapacity = total - maintenance - lost - broken; // Total functional units
                            const availabilityPercent = total > 0 ? Math.max(0, (available / total) * 100) : 0;

                            return (
                                <div key={item.id} className="app-card group flex flex-col h-full overflow-hidden transition-all hover:shadow-2xl hover:shadow-primary/5 hover:border-primary/30">
                                    <Link to={`/inventory/${item.id}/details`} className="h-56 bg-white dark:bg-slate-900/5 flex items-center justify-center relative overflow-hidden group-hover:bg-slate-50 transition-colors">
                                        {item.photo_url ? (
                                            <img
                                                src={item.photo_url}
                                                alt={item.name}
                                                className="w-full h-full object-contain p-4 transition-transform duration-500 group-hover:scale-105"
                                                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
                                            />
                                        ) : null}
                                        <div className={`${item.photo_url ? 'hidden' : 'flex'} items-center justify-center text-text-secondary-light/20 dark:text-text-secondary-dark/20`}>
                                            <Package size={80} strokeWidth={0.5} />
                                        </div>

                                        {/* Status Badge */}
                                        <div className="absolute top-4 left-4">
                                            {available > 0 ? (
                                                <span className="px-3 py-1 bg-secondary/90 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-sm">
                                                    {available} Disp. em {selectedDate ? format(new Date(selectedDate + 'T12:00:00'), 'dd/MM') : '--/--'}
                                                </span>
                                            ) : (
                                                <span className="px-3 py-1 bg-danger/90 backdrop-blur-sm text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-sm">
                                                    {netCapacity > 0 ? 'Indisponível' : 'Esgotado'}
                                                </span>
                                            )}
                                        </div>
                                    </Link>

                                    <div className="p-6 flex-1 flex flex-col">
                                        <div className="flex justify-between items-start gap-4 mb-4">
                                            <h3 className="font-black text-text-primary-light dark:text-text-primary-dark text-lg leading-tight uppercase tracking-tight line-clamp-2 group-hover:text-primary transition-colors">
                                                {item.name}
                                            </h3>
                                            <div className="text-right shrink-0">
                                                <div className="text-primary font-black text-xl tabular-nums tracking-tighter whitespace-nowrap">
                                                    R$ {Number(item.daily_price).toFixed(2)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Detailed Stats Grid */}
                                        <div className="grid grid-cols-5 gap-1.5 my-4">
                                            <div className="flex flex-col items-center p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 transition-colors group-hover:bg-white dark:group-hover:bg-slate-800 min-w-0">
                                                <span className="text-[7px] font-black uppercase tracking-tight text-secondary mb-0.5 truncate w-full text-center">Disp.</span>
                                                <span className="text-xs font-black text-text-primary-light dark:text-text-primary-dark truncate">{available}</span>
                                            </div>
                                            <div className="flex flex-col items-center p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 transition-colors group-hover:bg-white dark:group-hover:bg-slate-800 min-w-0">
                                                <span className="text-[7px] font-black uppercase tracking-tight text-blue-500 mb-0.5 truncate w-full text-center">Alug.</span>
                                                <span className="text-xs font-black text-text-primary-light dark:text-text-primary-dark truncate">{rented}</span>
                                            </div>
                                            <div className="flex flex-col items-center p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 transition-colors group-hover:bg-white dark:group-hover:bg-slate-800 min-w-0">
                                                <span className="text-[7px] font-black uppercase tracking-tight text-warning mb-0.5 truncate w-full text-center">Man.</span>
                                                <span className="text-xs font-black text-text-primary-light dark:text-text-primary-dark truncate">{maintenance}</span>
                                            </div>
                                            <div className="flex flex-col items-center p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 transition-colors group-hover:bg-white dark:group-hover:bg-slate-800 min-w-0">
                                                <span className="text-[7px] font-black uppercase tracking-tight text-orange-500 mb-0.5 truncate w-full text-center">Avaria</span>
                                                <span className="text-xs font-black text-text-primary-light dark:text-text-primary-dark truncate">{broken}</span>
                                            </div>
                                            <div className="flex flex-col items-center p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 transition-colors group-hover:bg-white dark:group-hover:bg-slate-800 min-w-0">
                                                <span className="text-[7px] font-black uppercase tracking-tight text-danger mb-0.5 truncate w-full text-center">Perda</span>
                                                <span className="text-xs font-black text-text-primary-light dark:text-text-primary-dark truncate">{lost}</span>
                                            </div>
                                        </div>

                                        <div className="mt-auto pt-6 border-t border-border-light dark:border-border-dark flex gap-3">
                                            <Link
                                                to={`/inventory/${item.id}/details`}
                                                className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/20"
                                            >
                                                <Eye size={18} />
                                                <span>Ver Detalhes</span>
                                            </Link>
                                            <div className="flex gap-2">
                                                <Link
                                                    to={`/inventory/${item.id}`}
                                                    className="p-3 text-text-secondary-light dark:text-text-secondary-dark hover:bg-white dark:hover:bg-slate-700 rounded-xl transition-all border border-border-light dark:border-border-dark shadow-sm"
                                                    title="Editar"
                                                >
                                                    <Edit size={18} />
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="p-3 text-danger hover:bg-danger/10 rounded-xl transition-all border border-danger/20 shadow-sm"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )
            ) : activeTab === 'maintenance' ? (
                <div className="space-y-6">
                    {maintenanceLogs.length === 0 ? (
                        <div className="app-card flex flex-col items-center justify-center py-24 text-center">
                            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-full mb-6">
                                <Plus size={64} className="text-text-secondary-light/20" />
                            </div>
                            <p className="text-text-secondary-light dark:text-text-secondary-dark font-bold uppercase tracking-widest text-xs">Tudo em Ordem</p>
                            <p className="text-text-secondary-light/60 text-sm mt-2 max-w-xs mx-auto">Não há itens em manutenção no momento.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {maintenanceLogs.map((log) => {
                                const days = Math.floor((new Date() - new Date(log.entry_date)) / (1000 * 60 * 60 * 24));

                                return (
                                    <div key={log.id} className={`app-card p-6 flex flex-col md:flex-row items-center gap-6 group transition-all ${log.is_ghost ? 'border-dashed border-warning/40 bg-warning/[0.01]' : 'hover:border-primary/30'}`}>
                                        <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center border border-border-light dark:border-border-dark overflow-hidden shrink-0">
                                            {log.items?.photo_url ? (
                                                <img src={log.items.photo_url} alt="" className="w-full h-full object-contain p-2" />
                                            ) : (
                                                <Package size={32} className="text-slate-300" />
                                            )}
                                        </div>

                                        <div className="flex-1 text-center md:text-left">
                                            <div className="flex items-center justify-center md:justify-start gap-2">
                                                <h4 className="font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-tight">{log.items?.name}</h4>
                                                {log.is_ghost && (
                                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-warning text-white text-[8px] font-black uppercase tracking-tighter rounded-md animate-pulse">
                                                        <AlertTriangle size={8} />
                                                        Correção de Saldo
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
                                                <span className="px-2 py-1 bg-warning/10 text-warning text-[10px] font-bold uppercase tracking-widest rounded-lg">
                                                    {log.quantity} {log.quantity === 1 ? 'Unidade' : 'Unidades'}
                                                </span>
                                                {!log.is_ghost && (
                                                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-text-secondary-light text-[10px] font-bold uppercase tracking-widest rounded-lg flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
                                                        <Clock size={12} className="text-primary" />
                                                        Entrou dia {new Date(log.entry_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ({days === 0 ? 'Hoje' : `Há ${days} ${days === 1 ? 'dia' : 'dias'}`})
                                                    </span>
                                                )}
                                                {log.is_ghost && (
                                                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-text-secondary-light text-[10px] font-bold uppercase tracking-widest rounded-lg flex items-center gap-1.5 border border-dashed border-warning/30">
                                                        <AlertTriangle size={12} className="text-warning" />
                                                        Data incerta (Aguardando Sync)
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-2">
                                            {log.is_ghost && (
                                                <button
                                                    onClick={() => handleRepairSync(log.item_id, 'maintenance', log.quantity)}
                                                    className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                                                    title="Criar log histórico para este saldo"
                                                >
                                                    Sincronizar
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleReturn(log)}
                                                className="w-full md:w-auto px-6 py-3 bg-secondary hover:bg-secondary-hover text-white rounded-xl font-bold transition-all shadow-lg shadow-secondary/20 flex items-center justify-center gap-2"
                                            >
                                                Dar Baixa / Retornar
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            ) : activeTab === 'broken' ? (
                <div className="space-y-6">
                    {brokenLogs.length === 0 ? (
                        <div className="app-card flex flex-col items-center justify-center py-24 text-center">
                            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-full mb-6">
                                <Hammer size={64} className="text-text-secondary-light/20" />
                            </div>
                            <p className="text-text-secondary-light dark:text-text-secondary-dark font-bold uppercase tracking-widest text-xs">Sem Avarias</p>
                            <p className="text-text-secondary-light/60 text-sm mt-2 max-w-xs mx-auto">Nenhum item reportado como quebrado ou aguardando decisão.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {brokenLogs.map((log) => {
                                const days = Math.floor((new Date() - new Date(log.entry_date)) / (1000 * 60 * 60 * 24));

                                return (
                                    <div key={log.id} className={`app-card p-6 flex flex-col md:flex-row items-center gap-6 group transition-all ${log.is_ghost ? 'border-dashed border-orange-500/40 bg-orange-500/[0.01]' : 'hover:border-orange-500/30'}`}>
                                        <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center border border-border-light dark:border-border-dark overflow-hidden shrink-0">
                                            {log.items?.photo_url ? (
                                                <img src={log.items.photo_url} alt="" className="w-full h-full object-contain p-2" />
                                            ) : (
                                                <Package size={32} className="text-slate-300" />
                                            )}
                                        </div>

                                        <div className="flex-1 text-center md:text-left">
                                            <div className="flex items-center justify-center md:justify-start gap-2">
                                                <h4 className="font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-tight">{log.items?.name}</h4>
                                                {log.is_ghost && (
                                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-500 text-white text-[8px] font-black uppercase tracking-tighter rounded-md animate-pulse">
                                                        <AlertTriangle size={8} />
                                                        Correção de Saldo
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
                                                <span className="px-2 py-1 bg-orange-500/10 text-orange-500 text-[10px] font-bold uppercase tracking-widest rounded-lg">
                                                    {log.quantity} {log.quantity === 1 ? 'Unidade' : 'Unidades'}
                                                </span>
                                                {!log.is_ghost && (
                                                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-text-secondary-light text-[10px] font-bold uppercase tracking-widest rounded-lg flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
                                                        <Clock size={12} className="text-primary" />
                                                        Reportado dia {new Date(log.entry_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ({days === 0 ? 'Hoje' : `Há ${days} ${days === 1 ? 'dia' : 'dias'}`})
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-2">
                                            {log.is_ghost && (
                                                <button
                                                    onClick={() => handleRepairSync(log.item_id, 'broken', log.quantity)}
                                                    className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                                                    title="Criar log histórico para este saldo"
                                                >
                                                    Sincronizar
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleSendToMaintenance(log)}
                                                className="px-6 py-3 bg-warning hover:bg-warning-hover text-white rounded-xl font-bold transition-all shadow-lg shadow-warning/20 flex items-center justify-center gap-2"
                                            >
                                                <Wrench size={18} />
                                                Enviar p/ Manutenção
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    {lostLogs.length === 0 ? (
                        <div className="app-card flex flex-col items-center justify-center py-24 text-center">
                            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-full mb-6">
                                <Trash2 size={64} className="text-text-secondary-light/20" />
                            </div>
                            <p className="text-text-secondary-light dark:text-text-secondary-dark font-bold uppercase tracking-widest text-xs">Inventário Seguro</p>
                            <p className="text-text-secondary-light/60 text-sm mt-2 max-w-xs mx-auto">Nenhuma perda ou quebra registrada no momento.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {lostLogs.map((log) => {
                                const days = Math.floor((new Date() - new Date(log.entry_date)) / (1000 * 60 * 60 * 24));

                                return (
                                    <div key={log.id} className={`app-card p-6 flex flex-col md:flex-row items-center gap-6 group transition-all ${log.is_ghost ? 'border-dashed border-danger/40 bg-danger/[0.01]' : 'hover:border-danger/30'}`}>
                                        <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center border border-border-light dark:border-border-dark overflow-hidden shrink-0">
                                            {log.items?.photo_url ? (
                                                <img src={log.items.photo_url} alt="" className="w-full h-full object-contain p-2" />
                                            ) : (
                                                <Package size={32} className="text-slate-300" />
                                            )}
                                        </div>

                                        <div className="flex-1 text-center md:text-left">
                                            <div className="flex items-center justify-center md:justify-start gap-2">
                                                <h4 className="font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-tight">{log.items?.name}</h4>
                                                {log.is_ghost && (
                                                    <span className="flex items-center gap-1 px-2 py-0.5 bg-danger text-white text-[8px] font-black uppercase tracking-tighter rounded-md animate-pulse">
                                                        <AlertTriangle size={8} />
                                                        Correção de Saldo
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap justify-center md:justify-start gap-2 mt-2">
                                                <span className="px-2 py-1 bg-danger/10 text-danger text-[10px] font-bold uppercase tracking-widest rounded-lg">
                                                    {log.quantity} {log.quantity === 1 ? 'Unidade' : 'Unidades'}
                                                </span>
                                                {!log.is_ghost && (
                                                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-text-secondary-light text-[10px] font-bold uppercase tracking-widest rounded-lg flex items-center gap-1.5 border border-slate-200 dark:border-slate-700">
                                                        <Clock size={12} className="text-primary" />
                                                        Reportado dia {new Date(log.entry_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ({days === 0 ? 'Hoje' : `Há ${days} ${days === 1 ? 'dia' : 'dias'}`})
                                                    </span>
                                                )}
                                                {log.is_ghost && (
                                                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-text-secondary-light text-[10px] font-bold uppercase tracking-widest rounded-lg flex items-center gap-1.5 border border-dashed border-danger/30">
                                                        <AlertTriangle size={12} className="text-danger" />
                                                        Data incerta (Aguardando Sync)
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="w-full md:w-auto flex flex-col sm:flex-row gap-2">
                                            {log.is_ghost && (
                                                <button
                                                    onClick={() => handleRepairSync(log.item_id, 'lost', log.quantity)}
                                                    className="px-6 py-3 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
                                                    title="Criar log histórico para este saldo"
                                                >
                                                    Sincronizar
                                                </button>
                                            )}
                                            <button
                                                onClick={() => handleReturnLost(log, 'FOUND')}
                                                className="px-6 py-3 bg-secondary hover:bg-secondary-hover text-white rounded-xl font-bold transition-all shadow-lg shadow-secondary/20 flex items-center justify-center gap-2"
                                            >
                                                Encontrado
                                            </button>
                                            <button
                                                onClick={() => handleReturnLost(log, 'REPAIRED')}
                                                className="px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                                            >
                                                Consertado
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

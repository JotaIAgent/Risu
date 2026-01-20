
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Plus, Trash2, FileText, Download, Eye, Send, CheckCircle, MessageCircle } from 'lucide-react'
import { useDialog } from '../components/DialogProvider'
import { useAuth } from '../contexts/AuthContext'
import { generateQuotePDF, generateContractPDF } from '../lib/pdfGenerator'
import QuoteConversionModal from '../components/QuoteConversionModal'

export default function Quotes() {
    const EVOLUTION_URL = import.meta.env.VITE_EVOLUTION_URL || ''
    const EVOLUTION_APIKEY = import.meta.env.VITE_EVOLUTION_APIKEY || ''
    const [quotes, setQuotes] = useState([])
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()
    const { confirm, success, error: toastError } = useDialog()
    const navigate = useNavigate()

    useEffect(() => {
        fetchQuotes()
    }, [])

    async function fetchQuotes() {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('rentals')
                .select(`
                    *,
                    customers (name),
                    rental_items (
                        id,
                        item_id,
                        quantity,
                        unit_price,
                        items (id, name, daily_price, photo_url)
                    )
                `)
                .eq('type', 'quote')
                .order('created_at', { ascending: false })

            if (error) throw error
            setQuotes(data)
        } catch (error) {
            console.error('Error fetching quotes:', error)
            toastError('Erro ao carregar orçamentos')
        } finally {
            setLoading(false)
        }
    }

    async function handleDelete(id) {
        if (!await confirm('Deseja excluir este orçamento permanentemente?', 'Excluir Orçamento')) return
        try {
            const { error } = await supabase.from('rentals').delete().eq('id', id)
            if (error) throw error
            fetchQuotes()
        } catch (error) {
            console.error('Error deleting quote:', error)
            toastError('Erro ao excluir orçamento')
        }
    }

    async function handleViewPDF(quote) {
        if (!user) return

        try {
            // Fetch settings for PDF generation
            const { data: settings } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle()

            if (!settings) {
                toastError('Configure seus dados de contrato nas configurações primeiro.')
                return
            }

            const ownerData = {
                name: settings.owner_name || user.email.split('@')[0],
                email: user.email,
                phone: settings.owner_phone || '',
                fullAddress: settings.owner_street
                    ? `${settings.owner_street}, ${settings.owner_number}${settings.owner_complement ? ` (${settings.owner_complement})` : ''}, ${settings.owner_neighborhood}, ${settings.owner_city}-${settings.owner_state}`
                    : ''
            }

            const selectedItemsData = quote.rental_items.map(ri => ({
                id: ri.items?.id,
                name: ri.items?.name || 'Item desconhecido',
                quantity: ri.quantity,
                daily_price: ri.unit_price
            }))

            // Helper to convert URL to base64
            const imageToBase64 = async (url) => {
                if (!url) return null
                try {
                    const response = await fetch(url)
                    const blob = await response.blob()
                    return new Promise((resolve) => {
                        const reader = new FileReader()
                        reader.onloadend = () => resolve(reader.result)
                        reader.readAsDataURL(blob)
                    })
                } catch (e) {
                    console.error('Error converting logo to base64:', e)
                    return null
                }
            }

            const logoBase64 = settings.contract_logo_url ? await imageToBase64(settings.contract_logo_url) : null

            const pdf = generateQuotePDF(
                quote,
                quote.customers,
                selectedItemsData,
                ownerData,
                logoBase64,
                settings.contract_primary_color,
                settings.contract_secondary_color
            )

            pdf.save(`Orcamento_${quote.id.slice(0, 8)}.pdf`)
        } catch (error) {
            console.error('Error generating PDF:', error)
            toastError('Erro ao gerar PDF')
        }
    }

    async function sendWhatsappContract(rental, settings) {
        const customer = rental.customers
        if (!customer?.whatsapp) return

        try {
            const startDate = new Date(rental.delivery_date + 'T00:00:00')
            const endDate = new Date(rental.return_date + 'T00:00:00')
            const eventDate = new Date(rental.event_date + 'T00:00:00')
            const diffTime = Math.abs(endDate - startDate)
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

            const selectedItemsData = rental.rental_items.map(ri => ({
                ...ri.items,
                quantity: ri.quantity,
                unit_price: ri.unit_price
            }))

            const itemsText = selectedItemsData.map(i => `${i.quantity}x ${i.name}`).join(', ')
            const total = rental.total_value.toFixed(2)

            let number = customer.whatsapp.replace(/\D/g, '')
            if (number.length <= 11) {
                number = '55' + number
            }

            const baseUrl = EVOLUTION_URL.replace(/\/$/, '')
            const instanceName = settings.instance_name
            const uploadLink = `${window.location.origin}/upload-contract/${rental.id}`

            function replaceVars(template) {
                return template
                    .replace(/{cliente}/g, customer.name)
                    .replace(/{item}/g, itemsText)
                    .replace(/{inicio}/g, startDate.toLocaleDateString('pt-BR'))
                    .replace(/{evento}/g, eventDate.toLocaleDateString('pt-BR'))
                    .replace(/{fim}/g, endDate.toLocaleDateString('pt-BR'))
                    .replace(/{total}/g, total)
                    .replace(/{frete}/g, (rental.shipping_cost || 0).toFixed(2))
                    .replace(/{dias}/g, diffDays)
                    .replace(/{upload_link}/g, uploadLink)
            }

            // Converter logo para base64
            const imageToBase64 = async (url) => {
                if (!url) return null
                try {
                    const response = await fetch(url)
                    const blob = await response.blob()
                    return new Promise((resolve) => {
                        const reader = new FileReader()
                        reader.onloadend = () => resolve(reader.result)
                        reader.readAsDataURL(blob)
                    })
                } catch (e) {
                    return null
                }
            }
            const logoBase64 = settings.contract_logo_url ? await imageToBase64(settings.contract_logo_url) : null

            // 1. Initial text message
            const welcomeMsg = replaceVars(settings.contract_template || 'Olá {cliente}, seu aluguel está confirmado.')

            const eventInfo = rental.event_date ? (
                rental.event_end_date && rental.event_end_date !== rental.event_date
                    ? `Evento: ${new Date(rental.event_date + 'T00:00:00').toLocaleDateString('pt-BR')} até ${new Date(rental.event_end_date + 'T00:00:00').toLocaleDateString('pt-BR')}`
                    : `Evento: ${new Date(rental.event_date + 'T00:00:00').toLocaleDateString('pt-BR')}`
            ) : ''

            await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_APIKEY },
                body: JSON.stringify({ number, text: welcomeMsg + (eventInfo ? `\n\n${eventInfo}` : '') })
            })
            await new Promise(resolve => setTimeout(resolve, 2000))

            // 2. PDF message
            const ownerData = {
                name: settings.owner_name || user.email.split('@')[0],
                email: user.email,
                cpf_cnpj: settings.owner_cpf_cnpj || '',
                phone: settings.owner_phone || ''
            }

            const pdf = generateContractPDF(
                rental,
                customer,
                selectedItemsData,
                ownerData,
                settings.contract_pdf_template,
                logoBase64,
                settings.contract_primary_color,
                settings.contract_secondary_color
            )
            const pdfBlob = pdf.output('blob')
            const reader = new FileReader()
            const base64Promise = new Promise((resolve) => {
                reader.onloadend = () => resolve(reader.result.split(',')[1])
            })
            reader.readAsDataURL(pdfBlob)
            const base64PDF = await base64Promise

            const message2 = replaceVars(settings.pdf_message || 'Segue o contrato em anexo.')
            await fetch(`${baseUrl}/message/sendMedia/${instanceName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_APIKEY },
                body: JSON.stringify({
                    number,
                    mediatype: 'document',
                    mimetype: 'application/pdf',
                    caption: message2,
                    fileName: `Contrato_${rental.id.slice(0, 8)}.pdf`,
                    media: base64PDF
                })
            })
            await new Promise(resolve => setTimeout(resolve, 2000))

            // 3. Signature & Upload
            const message3 = replaceVars(settings.signature_message || 'Assine digitalmente.')
            await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_APIKEY },
                body: JSON.stringify({ number, text: message3 })
            })
            await new Promise(resolve => setTimeout(resolve, 2000))

            const message4 = replaceVars(settings.upload_message || 'Envie de volta: {upload_link}')
            await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_APIKEY },
                body: JSON.stringify({ number, text: message4 })
            })

        } catch (error) {
            console.error('Erro WhatsApp:', error)
        }
    }

    const [statusFilter, setStatusFilter] = useState('all') // 'all', 'draft', 'sent', 'approved', 'refused', 'converted'

    // Filter quotes based on status
    const filteredQuotes = quotes.filter(quote => {
        if (statusFilter === 'all') return true
        return quote.status === statusFilter
    })

    async function handleUpdateStatus(quote, newStatus) {
        try {
            const { error } = await supabase
                .from('rentals')
                .update({ status: newStatus })
                .eq('id', quote.id)

            if (error) throw error

            fetchQuotes()
            success(`Status atualizado para: ${getStatusLabel(newStatus)}`)
        } catch (error) {
            console.error('Error updating status:', error)
            toastError('Erro ao atualizar status')
        }
    }

    async function checkAvailabilityForConversion(quote) {
        // Retrieve rental items
        const { data: quoteItems, error: itemsError } = await supabase
            .from('rental_items')
            .select('*, items(*)')
            .eq('rental_id', quote.id)

        if (itemsError) throw itemsError

        // Check availability for each item
        for (const rentalItem of quoteItems) {
            const item = rentalItem.items

            // Count overlapping active rentals (excluding this quote)
            const { data: overlappingRentals } = await supabase
                .from('rental_items')
                .select('quantity, rentals!inner(status, start_date, end_date)')
                .eq('item_id', item.id)
                .neq('rental_id', quote.id) // Exclude self
                .neq('rentals.status', 'canceled')
                .neq('rentals.status', 'completed')
                .neq('rentals.status', 'draft')     // Ignore other drafts
                .neq('rentals.status', 'refused')   // Ignore refused
                .neq('rentals.status', 'expired')   // Ignore expired
                .lte('rentals.start_date', quote.end_date)
                .gte('rentals.end_date', quote.start_date)

            const rentedCount = overlappingRentals?.reduce((sum, r) => sum + (r.quantity || 1), 0) || 0
            const netAvailable = (item.total_quantity || 0) - (item.maintenance_quantity || 0) - (item.lost_quantity || 0) - rentedCount

            if (rentalItem.quantity > netAvailable) {
                return {
                    available: false,
                    message: `Item indisponível: ${item.name}. Solicitado: ${rentalItem.quantity}, Disponível: ${Math.max(0, netAvailable)}.`
                }
            }
        }

        return { available: true }
    }

    const [showConversionModal, setShowConversionModal] = useState(false)
    const [selectedQuoteForConversion, setSelectedQuoteForConversion] = useState(null)

    async function handleEfetivar(quote) {
        setSelectedQuoteForConversion(quote)
        setShowConversionModal(true)
    }

    async function handleConfirmConversion(modalData) {
        const quote = selectedQuoteForConversion
        setShowConversionModal(false)
        setSelectedQuoteForConversion(null)

        try {
            setLoading(true)

            // 1. Check Availability
            const availabilityCheck = await checkAvailabilityForConversion(quote)
            if (!availabilityCheck.available) {
                toastError(`Não é possível converter: \n${availabilityCheck.message}`)
                setLoading(false)
                return
            }

            // 2. Create NEW Rental based on Quote
            const rentalData = {
                client_id: quote.client_id,
                start_date: quote.start_date,
                end_date: quote.end_date,
                event_date: quote.event_date,
                event_end_date: quote.event_end_date,
                total_value: quote.total_value,
                shipping_cost: quote.shipping_cost,
                discount: quote.discount,
                obs: quote.obs,
                payment_status: 'PENDING',
                status: 'confirmed', // New active rental
                contract_status: 'pending',
                type: 'rental',
                custom_due_date: modalData.custom_due_date,
                payment_method: modalData.payment_method,
                installments: parseInt(modalData.installments) || 1,
                discount: parseFloat(modalData.discount) || 0,
                discount_type: modalData.discount_type,
                shipping_cost: parseFloat(modalData.shipping_cost) || 0,
                down_payment: parseFloat(modalData.down_payment) || 0,
                security_deposit_value: parseFloat(modalData.security_deposit_value) || 0,
                security_deposit_status: (parseFloat(modalData.security_deposit_value) || 0) > 0 ? 'PENDING' : 'RETURNED',
                subtotal_items: quote.subtotal_items,
                extra_charges: quote.extra_charges,
                damage_fee: 0,
                refund_value: 0,
                delivery_type: quote.delivery_type,
                return_type: quote.return_type,
                address_cep: quote.address_cep,
                address_street: quote.address_street,
                address_number: quote.address_number,
                address_complement: quote.address_complement,
                address_neighborhood: quote.address_neighborhood,
                address_city: quote.address_city,
                address_state: quote.address_state,
                user_id: user.id,
                delivery_time: quote.delivery_time,
                return_time: quote.return_time
            }

            const { data: newRental, error: createError } = await supabase
                .from('rentals')
                .insert(rentalData)
                .select()
                .single()

            if (createError) throw createError

            // 3. Clone Items
            if (quote.rental_items && quote.rental_items.length > 0) {
                const itemsToInsert = quote.rental_items.map(ri => ({
                    rental_id: newRental.id,
                    item_id: ri.items?.id || ri.item_id, // Accessing from relation
                    quantity: ri.quantity,
                    unit_price: ri.unit_price || 0,
                    user_id: user.id
                }))

                const { error: itemsError } = await supabase
                    .from('rental_items')
                    .insert(itemsToInsert)

                if (itemsError) throw itemsError
            }

            // 4. Mark Original Quote as Converted
            const { error: updateError } = await supabase
                .from('rentals')
                .update({ status: 'converted' })
                .eq('id', quote.id)

            if (updateError) throw updateError

            success('Orçamento aprovado e convertido em Locação com sucesso!')
            navigate(`/rentals/${newRental.id}`)

        } catch (error) {
            console.error('Error finalizing quote:', error)
            toastError('Erro ao efetivar orçamento.')
        } finally {
            setLoading(false)
        }
    }

    function getStatusLabel(status) {
        const map = {
            'draft': 'Rascunho',
            'sent': 'Enviado',
            'approved': 'Aprovado',
            'refused': 'Recusado',
            'expired': 'Expirado',
            'converted': 'Convertido'
        }
        return map[status] || status
    }

    function getItemsSummary(quote) {
        const itemsList = quote.rental_items || []
        if (itemsList.length > 0) {
            const firstItem = itemsList[0]?.items?.name || 'Item desconhecido'
            if (itemsList.length === 1) return firstItem
            return (
                <span className="flex items-center gap-2">
                    {firstItem}
                    <span className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-[10px] font-bold">+{itemsList.length - 1}</span>
                </span>
            )
        }
        return <span className="text-text-secondary-light/50 italic">Nenhum item</span>
    }

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <p className="mt-4 text-text-secondary-light dark:text-text-secondary-dark font-medium uppercase tracking-widest text-xs">Carregando orçamentos...</p>
        </div>
    )

    return (
        <div className="space-y-8 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-text-primary-light dark:text-text-primary-dark tracking-tight">Orçamentos</h2>
                    <p className="text-text-secondary-light dark:text-text-secondary-dark font-medium mt-1">Gerencie orçamentos enviados aos clientes.</p>
                </div>
                <Link to="/quotes/new" className="w-full md:w-auto px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-2xl font-bold shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2">
                    <Plus size={20} />
                    Novo Orçamento
                </Link>
            </div>

            {/* Status Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {['all', 'sent', 'refused', 'converted'].map(status => (
                    <button
                        key={status}
                        onClick={() => setStatusFilter(status)}
                        className={`px-4 py-2 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${statusFilter === status
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : 'bg-white dark:bg-slate-800 text-text-secondary-light dark:text-text-secondary-dark hover:bg-slate-50 dark:hover:bg-slate-700 border border-border-light dark:border-border-dark'
                            }`}
                    >
                        {status === 'all' ? 'Todos' : getStatusLabel(status)}
                    </button>
                ))}
            </div>

            <div className="app-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="app-table">
                        <thead>
                            <tr>
                                <th>Cliente</th>
                                <th>Itens</th>
                                <th>Status</th>
                                <th>Período Previsto</th>
                                <th className="text-right">Total</th>
                                <th className="text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-light dark:divide-border-dark">
                            {filteredQuotes.map((quote) => (
                                <tr
                                    key={quote.id}
                                    className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                                    onClick={() => navigate(`/quotes/${quote.id}`)}
                                >
                                    <td>
                                        <div className="font-bold text-text-primary-light dark:text-text-primary-dark">{quote.customers?.name}</div>
                                        <div className="text-[10px] text-text-secondary-light uppercase font-bold tracking-widest">
                                            Gerado em: {new Date(quote.created_at).toLocaleDateString('pt-BR')}
                                        </div>
                                    </td>
                                    <td>
                                        <div className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark max-w-[200px] truncate">
                                            {getItemsSummary(quote)}
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${quote.status === 'draft' ? 'bg-slate-100 text-slate-500' :
                                            quote.status === 'sent' ? 'bg-blue-100 text-blue-600' :
                                                quote.status === 'approved' ? 'bg-green-100 text-green-600' :
                                                    quote.status === 'refused' ? 'bg-red-100 text-red-600' :
                                                        quote.status === 'converted' ? 'bg-purple-100 text-purple-600' :
                                                            'bg-slate-100 text-slate-500'
                                            }`}>
                                            {getStatusLabel(quote.status)}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="text-sm font-bold text-text-secondary-light dark:text-text-secondary-dark whitespace-nowrap">
                                            {new Date(quote.start_date + 'T00:00:00').toLocaleDateString('pt-BR')} <span className="opacity-30 mx-1">→</span> {new Date(quote.end_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                        </div>
                                    </td>
                                    <td className="text-right">
                                        <div className="font-black text-primary">R$ {(quote.total_value || 0).toFixed(2)}</div>
                                    </td>
                                    <td className="text-right">
                                        <div className="flex justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                            {/* Actions based on status */}
                                            {quote.status === 'draft' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleUpdateStatus(quote, 'sent')
                                                    }}
                                                    className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all border border-blue-100 shadow-sm"
                                                    title="Marcar como Enviado"
                                                >
                                                    <Send size={18} />
                                                </button>
                                            )}

                                            {quote.status === 'sent' && (
                                                <>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleEfetivar(quote)
                                                        }}
                                                        className="p-2 text-green-500 hover:bg-green-50 rounded-xl transition-all border border-green-100 shadow-sm"
                                                        title="Aprovar e Converter"
                                                    >
                                                        <CheckCircle size={18} />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            handleUpdateStatus(quote, 'refused')
                                                        }}
                                                        className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-all border border-red-100 shadow-sm"
                                                        title="Recusar Orçamento"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </>
                                            )}

                                            {quote.status === 'approved' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleEfetivar(quote)
                                                    }}
                                                    className="p-2 bg-primary text-white hover:bg-primary-hover rounded-xl transition-all shadow-md shadow-primary/20"
                                                    title="Converter em Locação (Efetivar)"
                                                >
                                                    <CheckCircle size={18} />
                                                </button>
                                            )}

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    handleViewPDF(quote)
                                                }}
                                                className="p-2 text-secondary hover:bg-secondary/10 rounded-xl transition-all border border-secondary/20 shadow-sm"
                                                title="Ver PDF"
                                            >
                                                <Download size={18} />
                                            </button>

                                            {quote.status !== 'converted' && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        handleDelete(quote.id)
                                                    }}
                                                    className="p-2 text-danger hover:bg-danger/10 rounded-xl transition-all border border-danger/20 shadow-sm"
                                                    title="Excluir"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredQuotes.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="p-20 text-center">
                                        <div className="flex flex-col items-center">
                                            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-full mb-4">
                                                <FileText size={40} className="text-text-secondary-light/20" />
                                            </div>
                                            <p className="text-text-secondary-light dark:text-text-secondary-dark font-bold uppercase tracking-widest text-xs">Nenhum orçamento encontrado...</p>
                                            <p className="text-text-secondary-light/60 text-sm mt-1">Tente mudar o filtro ou crie um novo orçamento.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Modal de Conversão */}
            <QuoteConversionModal
                isOpen={showConversionModal}
                onClose={() => {
                    setShowConversionModal(false)
                    setSelectedQuoteForConversion(null)
                }}
                onConfirm={handleConfirmConversion}
                quote={selectedQuoteForConversion}
            />
        </div>
    )
}

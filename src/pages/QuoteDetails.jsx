
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, Download, FileText, Calendar, User, Package, DollarSign, Edit, CheckCircle, Trash2, XCircle, Send } from 'lucide-react'

import { generateQuotePDF, generateContractPDF } from '../lib/pdfGenerator'
import { useDialog } from '../components/DialogProvider'
import QuoteConversionModal from '../components/QuoteConversionModal'

export default function QuoteDetails() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const { alert: dialogAlert, confirm, success, error: toastError } = useDialog()

    const EVOLUTION_URL = import.meta.env.VITE_EVOLUTION_URL || ''
    const EVOLUTION_APIKEY = import.meta.env.VITE_EVOLUTION_APIKEY || ''
    const [sendingWpp, setSendingWpp] = useState(false)

    const [loading, setLoading] = useState(true)
    const [quote, setQuote] = useState(null)
    const [settings, setSettings] = useState(null)
    const [showConversionModal, setShowConversionModal] = useState(false)

    useEffect(() => {
        if (user && id) {
            fetchQuoteDetails()
        }
    }, [user, id])

    async function fetchQuoteDetails() {
        try {
            setLoading(true)

            const { data, error } = await supabase
                .from('rentals')
                .select(`
                    *,
                    customers (*),
                    rental_items (
                        *,
                        items (*)
                    )
                `)
                .eq('id', id)
                .single()

            if (error) throw error
            setQuote(data)

            const { data: setRes } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle()

            if (setRes) setSettings(setRes)

        } catch (error) {
            console.error('Error fetching quote:', error)
            toastError('Erro ao carregar orçamento')
        } finally {
            setLoading(false)
        }
    }

    async function handleDownloadPDF() {
        if (!settings || !quote) return

        try {
            const ownerData = {
                name: settings.owner_name || user.email.split('@')[0],
                email: user.email,
                phone: settings.owner_phone || '',
                fullAddress: settings.owner_street
                    ? `${settings.owner_street}, ${settings.owner_number}, ${settings.owner_city}-${settings.owner_state}`
                    : ''
            }

            const selectedItemsData = quote.rental_items.map(ri => ({
                id: ri.items?.id,
                name: ri.items?.name || 'Item desconhecido',
                quantity: ri.quantity,
                daily_price: ri.unit_price
            }))

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
            console.error('PDF Error:', error)
            toastError('Erro ao gerar PDF')
        }
    }

    async function handleResendWhatsapp() {
        if (!quote || !quote.customers?.whatsapp || !settings?.instance_name || !EVOLUTION_URL) {
            toastError('Configuração de WhatsApp incompleta ou cliente sem número.')
            return
        }

        try {
            setSendingWpp(true)
            const customer = quote.customers
            const startDate = new Date(quote.start_date + 'T00:00:00')
            const endDate = new Date(quote.end_date + 'T00:00:00')

            // Prepare items data for PDF
            const selectedItemsData = quote.rental_items.map(ri => ({
                id: ri.items?.id,
                name: ri.items?.name || 'Item desconhecido',
                quantity: ri.quantity,
                daily_price: ri.unit_price,
                ...ri.items
            }))

            const itemsText = selectedItemsData.map(i => `${i.quantity}x ${i.name}`).join(', ')
            const totalFormatted = quote.total_value.toFixed(2)

            let number = customer.whatsapp.replace(/\D/g, '')
            if (number.length <= 11) number = '55' + number

            const baseUrl = EVOLUTION_URL.replace(/\/$/, '')
            const instanceName = settings.instance_name

            // 1. Send Text message
            const welcomeMsg = `Olá *${customer.name}*, conforme solicitado, segue o orçamento para o período de ${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}.`

            const eventInfo = quote.event_date ? (
                quote.event_end_date && quote.event_end_date !== quote.event_date
                    ? `Evento: ${new Date(quote.event_date + 'T00:00:00').toLocaleDateString('pt-BR')} até ${new Date(quote.event_end_date + 'T00:00:00').toLocaleDateString('pt-BR')}`
                    : `Evento: ${new Date(quote.event_date + 'T00:00:00').toLocaleDateString('pt-BR')}`
            ) : ''

            await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_APIKEY },
                body: JSON.stringify({ number, text: welcomeMsg + (eventInfo ? `\n\n${eventInfo}` : '') })
            })

            await new Promise(resolve => setTimeout(resolve, 1000))

            // 2. Generate and Send PDF
            const ownerData = {
                name: settings.owner_name || user.email.split('@')[0],
                email: user.email,
                phone: settings.owner_phone || '',
                fullAddress: settings.owner_street
                    ? `${settings.owner_street}, ${settings.owner_number}, ${settings.owner_city}-${settings.owner_state}`
                    : ''
            }

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

            const pdf = generateQuotePDF(
                quote,
                customer,
                selectedItemsData,
                ownerData,
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

            await fetch(`${baseUrl}/message/sendMedia/${instanceName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_APIKEY },
                body: JSON.stringify({
                    number,
                    mediatype: 'document',
                    mimetype: 'application/pdf',
                    caption: 'Segue o detalhamento do orçamento em anexo.',
                    fileName: `Orcamento_${quote.id.slice(0, 8)}.pdf`,
                    media: base64PDF
                })
            })

            success('Orçamento reenviado com sucesso!')

        } catch (error) {
            console.error('Error sending whatsapp:', error)
            toastError('Erro ao reenviar WhatsApp.')
        } finally {
            setSendingWpp(false)
        }
    }

    if (loading) return (
        <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
    )

    if (!quote) return <div>Orçamento não encontrado.</div>

    async function handleDelete() {
        if (!await confirm('Deseja excluir este orçamento permanentemente?', 'Excluir Orçamento')) return
        try {
            const { error } = await supabase.from('rentals').delete().eq('id', id)
            if (error) throw error
            navigate('/quotes')
        } catch (error) {
            console.error('Error deleting quote:', error)
            toastError('Erro ao excluir orçamento')
        }
    }

    async function handleUpdateStatus(newStatus) {
        try {
            const { error } = await supabase
                .from('rentals')
                .update({ status: newStatus })
                .eq('id', quote.id)

            if (error) throw error

            setQuote(prev => ({ ...prev, status: newStatus }))
            success(`Status atualizado para: ${getStatusLabel(newStatus)}`)
        } catch (error) {
            console.error('Error updating status:', error)
            toastError('Erro ao atualizar status')
        }
    }

    async function checkAvailabilityForConversion() {
        const { data: quoteItems, error: itemsError } = await supabase.from('rental_items').select('*, items(*)').eq('rental_id', quote.id)
        if (itemsError) throw itemsError

        for (const rentalItem of quoteItems) {
            const item = rentalItem.items
            const { data: overlappingRentals } = await supabase
                .from('rental_items')
                .select('quantity, rentals!inner(status, start_date, end_date)')
                .eq('item_id', item.id)
                .neq('rental_id', quote.id)
                .neq('rentals.status', 'canceled')
                .neq('rentals.status', 'completed')
                .neq('rentals.status', 'draft')
                .neq('rentals.status', 'refused')
                .neq('rentals.status', 'expired')
                .lte('rentals.start_date', quote.end_date)
                .gte('rentals.end_date', quote.start_date)

            const rentedCount = overlappingRentals?.reduce((sum, r) => sum + (r.quantity || 1), 0) || 0
            const netAvailable = (item.total_quantity || 0) - (item.maintenance_quantity || 0) - (item.lost_quantity || 0) - rentedCount

            if (rentalItem.quantity > netAvailable) {
                return { available: false, message: `Item indisponível: ${item.name}.` }
            }
        }
        return { available: true }
    }

    async function handleEfetivar() {
        // Just open the modal
        setShowConversionModal(true)
    }

    async function handleConfirmConversion(modalData) {
        setShowConversionModal(false)

        try {
            setLoading(true)
            const availabilityCheck = await checkAvailabilityForConversion()
            if (!availabilityCheck.available) {
                toastError(`Não é possível converter: \n${availabilityCheck.message}`)
                setLoading(false)
                return
            }

            // 1. Create NEW Rental based on Quote + Modal Data
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
                security_deposit_status: (parseFloat(modalData.security_deposit_value) || 0) > 0 ? 'PENDING' : 'RETURNED', // Reset status if value changes
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
                delivery_time: quote.delivery_time, // Keep from quote
                return_time: quote.return_time      // Keep from quote
            }

            const { data: newRental, error: createError } = await supabase
                .from('rentals')
                .insert(rentalData)
                .select()
                .single()

            if (createError) throw createError

            // 2. Clone Items
            if (quote.rental_items && quote.rental_items.length > 0) {
                const itemsToInsert = quote.rental_items.map(ri => ({
                    rental_id: newRental.id,
                    item_id: ri.items?.id || ri.item_id, // Ensure we get the ID
                    quantity: ri.quantity,
                    unit_price: ri.unit_price,
                    user_id: user.id
                }))

                const { error: itemsError } = await supabase
                    .from('rental_items')
                    .insert(itemsToInsert)

                if (itemsError) throw itemsError
            }

            // 3. Mark Original Quote as Converted
            const { error: updateError } = await supabase
                .from('rentals')
                .update({ status: 'converted' }) // Keep as type='quote'
                .eq('id', quote.id)

            if (updateError) throw updateError

            success('Orçamento convertido em Locação com sucesso!')
            navigate(`/rentals/${newRental.id}`) // Navigate to the new rental

        } catch (error) {
            console.error('Error finalizing quote:', error)
            toastError('Erro ao efetivar orçamento.')
        } finally {
            setLoading(false)
        }
    }

    function getStatusLabel(status) {
        const map = { 'draft': 'Rascunho', 'sent': 'Enviado', 'approved': 'Aprovado', 'refused': 'Recusado', 'expired': 'Expirado', 'converted': 'Convertido' }
        return map[status] || status
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
            {/* Header / Nav */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/quotes')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-black text-text-primary-light dark:text-text-primary-dark tracking-tight">
                                Orçamento #{quote.id.slice(0, 8)}
                            </h1>
                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest bg-primary/10 text-primary`}>
                                {getStatusLabel(quote.status)}
                            </span>
                        </div>
                        <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark mt-1">
                            Criado em {new Date(quote.created_at).toLocaleDateString('pt-BR')}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2 flex-wrap justify-end">
                    {/* Actions */}
                    {quote.status === 'sent' && (
                        <>
                            <button
                                onClick={handleEfetivar}
                                className="px-3 py-2 bg-primary text-white hover:bg-primary-hover rounded-xl font-bold transition-all flex items-center gap-2 text-xs uppercase shadow-lg shadow-primary/20"
                            >
                                <CheckCircle size={16} /> Efetivar (Alugar)
                            </button>
                            <button
                                onClick={() => handleUpdateStatus('refused')}
                                className="px-3 py-2 bg-red-100 text-red-700 hover:bg-red-200 rounded-xl font-bold transition-all flex items-center gap-2 text-xs uppercase"
                            >
                                <XCircle size={16} /> Recusar
                            </button>
                        </>
                    )}

                    {quote.customers?.whatsapp && EVOLUTION_URL && settings?.instance_name && (
                        <button
                            onClick={handleResendWhatsapp}
                            disabled={sendingWpp}
                            className="px-3 py-2 bg-green-600 text-white hover:bg-green-700 rounded-xl font-bold transition-all flex items-center gap-2 text-xs uppercase disabled:opacity-50"
                        >
                            <Send size={16} />
                            {sendingWpp ? 'Enviando...' : 'WhatsApp'}
                        </button>
                    )}

                    <button
                        onClick={() => navigate(`/quotes/${quote.id}/edit`)}
                        className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-text-primary-light dark:text-text-primary-dark rounded-xl font-bold transition-all flex items-center gap-2 text-xs uppercase"
                    >
                        <Edit size={16} />
                        Editar
                    </button>

                    <button
                        onClick={handleDownloadPDF}
                        className="px-3 py-2 bg-secondary/10 hover:bg-secondary/20 text-secondary rounded-xl font-bold transition-all flex items-center gap-2 text-xs uppercase"
                    >
                        <Download size={16} />
                        PDF
                    </button>

                    <button
                        onClick={handleDelete}
                        className="px-3 py-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-xl font-bold transition-all flex items-center gap-2 text-xs uppercase"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Info */}
                <div className="md:col-span-2 space-y-6">
                    {/* Customer Card */}
                    <div className="app-card p-6 space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary-light dark:text-text-secondary-dark flex items-center gap-2">
                            <User size={16} /> Cliente
                        </h3>
                        <div>
                            <p className="font-bold text-lg text-text-primary-light dark:text-text-primary-dark">{quote.customers?.name}</p>
                            {quote.customers?.whatsapp && (
                                <p className="text-sm text-text-secondary-light">{quote.customers.whatsapp}</p>
                            )}
                        </div>
                    </div>

                    {/* Dates Card */}
                    <div className="app-card p-6 space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary-light dark:text-text-secondary-dark flex items-center gap-2">
                            <Calendar size={16} /> Datas
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-text-secondary-light uppercase font-bold">Início</p>
                                <p className="font-bold">{new Date(quote.start_date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                            </div>
                            <div>
                                <p className="text-xs text-text-secondary-light uppercase font-bold">Fim</p>
                                <p className="font-bold">{new Date(quote.end_date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                            </div>
                            {quote.event_date && (
                                <div className="col-span-2">
                                    <p className="text-xs text-text-secondary-light uppercase font-bold">Evento</p>
                                    <p className="font-bold">{new Date(quote.event_date + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Items Card */}
                    <div className="app-card p-6 space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary-light dark:text-text-secondary-dark flex items-center gap-2">
                            <Package size={16} /> Itens
                        </h3>
                        <div className="space-y-3">
                            {quote.rental_items?.map(ri => (
                                <div key={ri.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        {ri.items?.photo_url ? (
                                            <img src={ri.items.photo_url} alt={ri.items.name} className="w-10 h-10 rounded-lg object-cover" />
                                        ) : (
                                            <div className="w-10 h-10 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                                                <Package size={20} className="opacity-50" />
                                            </div>
                                        )}
                                        <div>
                                            <p className="font-bold text-sm text-text-primary-light dark:text-text-primary-dark">{ri.items?.name}</p>
                                            <p className="text-xs text-text-secondary-light">Qtd: {ri.quantity}</p>
                                        </div>
                                    </div>
                                    <div className="font-bold text-sm">
                                        R$ {(ri.unit_price * ri.quantity).toFixed(2)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Sidebar / Totals */}
                <div className="space-y-6">
                    <div className="app-card p-6 space-y-6 bg-primary/5 border-primary/20">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                            <DollarSign size={16} /> Valores
                        </h3>

                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-text-secondary-light">Frete</span>
                                <span className="font-bold">R$ {quote.shipping_cost?.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary-light">Desconto</span>
                                <span className="font-bold text-green-600">- R$ {quote.discount?.toFixed(2)}</span>
                            </div>
                            <div className="pt-4 border-t border-primary/20 flex justify-between items-end">
                                <span className="font-bold text-lg">Total</span>
                                <span className="font-black text-2xl text-primary">R$ {quote.total_value?.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Modal Conversion */}
            <QuoteConversionModal
                isOpen={showConversionModal}
                onClose={() => setShowConversionModal(false)}
                onConfirm={handleConfirmConversion}
                quote={quote}
            />
        </div>
    )
}

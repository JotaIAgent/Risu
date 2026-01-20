
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { MessageCircle, Plus, Trash2, FileText, Send, Eye, CheckCircle } from 'lucide-react'
import { generateQuotePDF } from '../lib/pdfGenerator'
import { useDialog } from '../components/DialogProvider'
import QuickCustomerModal from '../components/QuickCustomerModal'
import SearchableSelect from '../components/SearchableSelect'

export default function QuoteForm() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const { alert: dialogAlert, success, error: toastError } = useDialog()
    const { id } = useParams()

    const [loading, setLoading] = useState(false)
    const [savingDraft, setSavingDraft] = useState(false)
    const [customers, setCustomers] = useState([])
    const [items, setItems] = useState([])
    const [settings, setSettings] = useState(null)
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)

    const [formData, setFormData] = useState({
        customerId: '',
        deliveryDate: '',
        delivery_time: '', // Added
        eventDate: '',
        eventEndDate: '',
        returnDate: '',
        return_time: '', // Added
        payment_method: 'Dinheiro',
        discount: 0,
        discount_type: 'value',
        down_payment: 0,
        installments: 1,
        selectedItems: [{ itemId: '', quantity: 1 }],
        sendWhatsapp: true,
        shipping_cost: 0,
        delivery_type: 'pickup',
        return_type: 'return',
        address_cep: '',
        address_street: '',
        address_number: '',
        address_complement: '',
        address_neighborhood: '',
        address_city: '',
        address_state: '',
        security_deposit_value: 0,
        security_deposit_status: 'PENDING',
        status: 'draft'
    })

    const [itemAvailabilities, setItemAvailabilities] = useState({})
    const [loadingAvailabilities, setLoadingAvailabilities] = useState({})

    useEffect(() => {
        if (formData.selectedItems.length > 0 && formData.deliveryDate && formData.returnDate) {
            formData.selectedItems.forEach((_, index) => {
                checkItemAvailability(index)
            })
        }
    }, [formData.selectedItems, formData.deliveryDate, formData.returnDate, items])

    async function checkItemAvailability(index) {
        const selectedItem = formData.selectedItems[index]
        if (!selectedItem.itemId || !formData.deliveryDate || !formData.returnDate) return

        if (loadingAvailabilities[selectedItem.itemId]) return

        const item = items.find(i => i.id === selectedItem.itemId)
        if (!item) return

        try {
            setLoadingAvailabilities(prev => ({ ...prev, [selectedItem.itemId]: true }))

            // Here we count anything that isn't cancelled, including other quotes
            const { data: overlappingRentals } = await supabase
                .from('rental_items')
                .select('quantity, rentals!inner(status, start_date, end_date, type)')
                .eq('item_id', selectedItem.itemId)
                .neq('rentals.status', 'canceled')
                .neq('rentals.status', 'completed')
                .or('type.eq.rental,type.is.null', { foreignTable: 'rentals' })
                .lte('rentals.start_date', formData.returnDate)
                .gte('rentals.end_date', formData.deliveryDate)

            const rentedCount = overlappingRentals?.reduce((sum, r) => sum + (r.quantity || 1), 0) || 0

            const totalStock = item.total_quantity || 1
            const maintenance = item.maintenance_quantity || 0
            const lost = item.lost_quantity || 0
            const netAvailable = totalStock - maintenance - lost - rentedCount

            setItemAvailabilities(prev => ({
                ...prev,
                [selectedItem.itemId]: {
                    total: totalStock,
                    rented: rentedCount,
                    maintenance,
                    lost,
                    available: Math.max(0, netAvailable)
                }
            }))
        } catch (error) {
            console.error('Error checking availability:', error)
        } finally {
            setLoadingAvailabilities(prev => ({ ...prev, [selectedItem.itemId]: false }))
        }
    }

    const EVOLUTION_URL = import.meta.env.VITE_EVOLUTION_URL || ''
    const EVOLUTION_APIKEY = import.meta.env.VITE_EVOLUTION_APIKEY || ''

    useEffect(() => {
        if (user) {
            loadData()
        }
    }, [user])

    useEffect(() => {
        if (id && user) {
            fetchQuote(id)
        }
    }, [id, user])

    async function fetchQuote(quoteId) {
        try {
            setLoading(true)
            const { data: quote, error } = await supabase
                .from('rentals')
                .select(`
                    *,
                    rental_items (
                        item_id,
                        quantity
                    )
                `)
                .eq('id', quoteId)
                .single()

            if (error) throw error

            if (quote) {
                console.log('Quote loaded:', quote)
                setFormData({
                    customerId: quote.client_id,
                    deliveryDate: quote.start_date,
                    delivery_time: quote.delivery_time || '', // Load time
                    eventDate: quote.event_date || quote.start_date,
                    eventEndDate: quote.event_end_date || '',
                    returnDate: quote.end_date,
                    return_time: quote.return_time || '', // Load time
                    payment_method: 'Dinheiro',
                    discount: quote.discount || 0,
                    discount_type: quote.discount_type || 'value',
                    down_payment: quote.security_deposit_value || 0,
                    installments: 1,
                    selectedItems: quote.rental_items && quote.rental_items.length > 0
                        ? quote.rental_items.map(ri => ({
                            itemId: ri.item_id,
                            quantity: ri.quantity
                        }))
                        : [{ itemId: '', quantity: 1 }],
                    sendWhatsapp: true,
                    shipping_cost: quote.shipping_cost || 0, // Ensure shipping cost is loaded
                    delivery_type: quote.delivery_type || 'pickup',
                    return_type: quote.return_type || 'return',
                    address_cep: quote.address_cep || '',
                    address_street: quote.address_street || '',
                    address_number: quote.address_number || '',
                    address_complement: quote.address_complement || '',
                    address_neighborhood: quote.address_neighborhood || '',
                    address_city: quote.address_city || '',
                    address_state: quote.address_state || '',
                    security_deposit_value: quote.security_deposit_value || 0,
                    security_deposit_status: quote.security_deposit_status || 'PENDING',
                    status: quote.status
                })
            }
        } catch (error) {
            console.error('Error loading quote:', error)
            toastError('Erro ao carregar dados do orçamento.')
        } finally {
            setLoading(false)
        }
    }

    async function loadData() {
        try {
            const [custRes, itemRes, setRes] = await Promise.all([
                supabase.from('customers').select('*').eq('user_id', user.id),
                supabase.from('items').select('*').eq('user_id', user.id),
                supabase.from('user_settings').select('*').eq('user_id', user.id).maybeSingle()
            ])

            if (custRes.data) setCustomers(custRes.data)
            if (itemRes.data) setItems(itemRes.data)
            if (setRes.data) setSettings(setRes.data)

        } catch (error) {
            console.error('Error loading data:', error)
        }
    }

    async function handleCEPLookup(cep) {
        const cleanCEP = cep.replace(/\D/g, '')
        if (cleanCEP.length !== 8) return

        try {
            const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`)
            const data = await response.json()

            if (!data.erro) {
                setFormData(prev => ({
                    ...prev,
                    address_street: data.logradouro,
                    address_neighborhood: data.bairro,
                    address_city: data.localidade,
                    address_state: data.uf
                }))
            }
        } catch (error) {
            console.error('Error fetching CEP:', error)
        }
    }



    async function sendWhatsappQuote_REMOVED(quote) {
        const customer = customers.find(c => c.id === formData.customerId)
        if (!customer?.whatsapp) return

        try {
            const selectedItemsData = formData.selectedItems.map(si => ({
                ...items.find(i => i.id === si.itemId),
                quantity: si.quantity
            }))

            const itemsText = selectedItemsData.map(i => `${i.quantity}x ${i.name}`).join(', ')
            const total = (quote.total_value || 0).toFixed(2)

            let number = customer.whatsapp.replace(/\D/g, '')
            if (number.length <= 11) {
                number = '55' + number
            }

            const baseUrl = EVOLUTION_URL.replace(/\/$/, '')
            const instanceName = settings.instance_name

            // 1. Send Text
            const welcomeMsg = `Olá ${customer.name}, segue o seu orçamento no valor de R$ ${total}.\n\nItens: ${itemsText}`

            await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_APIKEY },
                body: JSON.stringify({ number, text: welcomeMsg })
            })
            await new Promise(resolve => setTimeout(resolve, 1000))

            // 2. Send PDF
            const ownerData = {
                name: settings.owner_name || user.email.split('@')[0],
                email: user.email,
                phone: settings.owner_phone || ''
            }

            const logoBase64 = settings.contract_logo_url ? await imageToBase64(settings.contract_logo_url) : null

            // Construct full quote object for PDF
            const pdfQuote = { ...quote, customers: customer, rental_items: selectedItemsData }

            const pdf = generateQuotePDF(
                pdfQuote,
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
                    caption: 'Segue orçamento em PDF.',
                    fileName: `Orcamento_${quote.id.slice(0, 8)}.pdf`,
                    media: base64PDF
                })
            })

        } catch (error) {
            console.error('Error sending WhatsApp quote:', error)
            toastError('Orçamento criado, mas erro ao enviar WhatsApp.')
        }
    }

    const handleSubmitInternal = async (targetStatus, showSuccessMessage = true) => {
        if (new Date(formData.deliveryDate) > new Date(formData.returnDate)) {
            toastError('A data de devolução deve ser após a data de entrega')
            if (targetStatus === 'draft') setSavingDraft(false)
            else setLoading(false)
            return false
        }
        try {
            if (targetStatus === 'draft') setSavingDraft(true)
            else setLoading(true)

            if (!formData.customerId || !formData.deliveryDate || !formData.returnDate || formData.selectedItems.some(i => !i.itemId)) {
                toastError('Preencha os campos obrigatórios (Cliente, Datas e Itens).')
                return false
            }

            // 1. Create OR Update Rental record (type='quote')
            const quotePayload = {
                client_id: formData.customerId,
                start_date: formData.deliveryDate,
                end_date: formData.returnDate,
                delivery_date: formData.deliveryDate, // Ensure consistency
                return_date: formData.returnDate,     // Ensure consistency
                delivery_time: formData.delivery_time || null, // Sanitize to null
                return_time: formData.return_time || null,     // Sanitize to null
                event_date: formData.eventDate || null,
                event_end_date: formData.eventEndDate || null,
                status: targetStatus, // 'draft' or 'sent'
                type: 'quote',
                user_id: user.id,
                total_value: totals?.finalValue || 0,
                discount: formData.discount || 0,
                discount_type: formData.discount_type,
                shipping_cost: formData.shipping_cost || 0,
                delivery_type: formData.delivery_type,
                return_type: formData.return_type,
                address_cep: formData.address_cep,
                address_street: formData.address_street,
                address_number: formData.address_number,
                address_complement: formData.address_complement,
                address_neighborhood: formData.address_neighborhood,
                address_city: formData.address_city,
                address_state: formData.address_state,
                security_deposit_value: formData.security_deposit_value || 0,
                security_deposit_status: formData.security_deposit_status
            }

            let quoteId = id

            if (id) {
                // UPDATE
                const { error: updateError } = await supabase
                    .from('rentals')
                    .update(quotePayload)
                    .eq('id', id)

                if (updateError) throw updateError
            } else {
                // INSERT
                const { data: newQuote, error: insertError } = await supabase
                    .from('rentals')
                    .insert(quotePayload)
                    .select()
                    .single()

                if (insertError) throw insertError
                quoteId = newQuote.id
            }

            // 2. Manage Rental Items (Delete all and re-insert for simplicity, or upsert)
            // For updates, simpler to clear old items and insert new ones
            if (id) {
                const { error: deleteItemsError } = await supabase
                    .from('rental_items')
                    .delete()
                    .eq('rental_id', id)
                if (deleteItemsError) throw deleteItemsError
            }

            // Create Quote Items Records
            const quoteItemsPayload = formData.selectedItems.map(item => ({
                rental_id: quoteId,
                item_id: item.itemId,
                quantity: parseInt(item.quantity) || 1,
                unit_price: items.find(i => i.id === item.itemId)?.daily_price || 0,
                user_id: user.id
            }))

            const { error: itemsError } = await supabase
                .from('rental_items')
                .insert(quoteItemsPayload)
                .select()

            if (itemsError) throw itemsError

            // 3. Create Financial Transaction (if down payment exists)
            const downPayment = parseFloat(formData.down_payment) || 0
            if (downPayment > 0) {
                try {
                    // Fetch default business account
                    const { data: accounts } = await supabase
                        .from('accounts')
                        .select('id')
                        .eq('user_id', user.id)
                        .eq('context', 'business')
                        .eq('is_default', true)
                        .single()

                    const accountId = accounts?.id || null

                    await supabase
                        .from('financial_transactions')
                        .insert([{
                            user_id: user.id,
                            type: 'income',
                            category: 'Aluguel',
                            amount: downPayment,
                            description: `Entrada Orçamento #${quoteId.slice(0, 8)}`,
                            date: new Date().toISOString().split('T')[0],
                            rental_id: quoteId,
                            client_id: formData.customerId,
                            account_id: accountId
                        }])
                } catch (transError) {
                    console.error('Error creating financial transaction:', transError)
                }
            }

            if (targetStatus === 'sent' && formData.sendWhatsapp && settings?.instance_name && EVOLUTION_URL) {
                // Fetch fresh quote data for WhatsApp to ensure nothing missing
                const { data: freshQuote } = await supabase.from('rentals').select('*').eq('id', quoteId).single()
                await sendWhatsappQuote(freshQuote)
            }

            if (showSuccessMessage) {
                success(`Orçamento ${targetStatus === 'draft' ? 'salvo como rascunho' : 'enviado'} com sucesso!`)
                navigate('/quotes')
            }
            return true

        } catch (error) {
            console.error('Error creating quote:', error)
            toastError('Erro ao criar orçamento: ' + (error.message || 'Erro desconhecido'))
            return false
        } finally {
            setLoading(false)
            setSavingDraft(false)
        }
    }

    const handleSaveDraft = (e) => {
        e.preventDefault()
        handleSubmitInternal('draft')
    }

    const handleSaveAndSend = (e) => {
        e.preventDefault()
        handleSubmitInternal('sent')
    }

    async function handlePreview() {
        if (!user || !settings) return

        try {
            const { finalValue } = totals || { finalValue: 0 }
            const customer = customers.find(c => c.id === formData.customerId)

            const selectedItemsData = formData.selectedItems.map(si => ({
                ...items.find(i => i.id === si.itemId),
                quantity: si.quantity
            }))

            const ownerData = {
                name: settings.owner_name || user.email.split('@')[0],
                email: user.email,
                phone: settings.owner_phone || ''
            }

            const logoBase64 = settings.contract_logo_url ? await imageToBase64(settings.contract_logo_url) : null

            // Create a temporary quote object for the PDF generator
            const tempQuote = {
                id: 'PREVIEW',
                delivery_date: formData.deliveryDate,
                return_date: formData.returnDate,
                event_date: formData.eventDate,
                event_end_date: formData.eventEndDate,
                discount: parseFloat(formData.discount) || 0,
                discount_type: formData.discount_type,
                shipping_cost: parseFloat(formData.shipping_cost) || 0,
                total_value: finalValue,
                delivery_type: formData.delivery_type,
                return_type: formData.return_type,
                address_street: formData.address_street,
                address_number: formData.address_number,
                address_complement: formData.address_complement,
                address_neighborhood: formData.address_neighborhood,
                address_city: formData.address_city,
                address_state: formData.address_state
            }

            const pdf = generateQuotePDF(
                tempQuote,
                customer || { name: 'Cliente Teste' },
                selectedItemsData,
                ownerData,
                logoBase64,
                settings.contract_primary_color,
                settings.contract_secondary_color
            )

            const pdfUrl = pdf.output('bloburl')
            window.open(pdfUrl, '_blank')
        } catch (error) {
            console.error('Error generating preview:', error)
            toastError('Erro ao gerar a pré-visualização do PDF')
        }
    }

    async function imageToBase64(url) {
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

    async function sendWhatsappQuote(quote) {
        const customer = customers.find(c => c.id === quote.client_id)
        if (!customer?.whatsapp) return

        try {
            const startDate = new Date(quote.delivery_date + 'T00:00:00')
            const endDate = new Date(quote.return_date + 'T00:00:00')

            const selectedItemsData = formData.selectedItems.map(si => ({
                ...items.find(i => i.id === si.itemId),
                quantity: si.quantity
            }))

            const itemsText = selectedItemsData.map(i => `${i.quantity}x ${i.name}`).join(', ')
            const totalFormatted = quote.total_value.toFixed(2)

            let number = customer.whatsapp.replace(/\D/g, '')
            if (number.length <= 11) number = '55' + number

            const baseUrl = EVOLUTION_URL.replace(/\/$/, '')
            const instanceName = settings.instance_name

            const replaceVars = (template) => {
                return template
                    .replace(/{cliente}/g, customer.name)
                    .replace(/{item}/g, itemsText)
                    .replace(/{inicio}/g, startDate.toLocaleDateString('pt-BR'))
                    .replace(/{fim}/g, endDate.toLocaleDateString('pt-BR'))
                    .replace(/{total}/g, totalFormatted)
            }

            // 1. Send Text message
            const welcomeMsg = `Olá *${customer.name}*, conforme solicitado, segue o orçamento para o período de ${startDate.toLocaleDateString('pt-BR')} a ${endDate.toLocaleDateString('pt-BR')}.`

            const eventInfo = formData.eventDate ? (
                formData.eventEndDate && formData.eventEndDate !== formData.eventDate
                    ? `Evento: ${new Date(formData.eventDate + 'T00:00:00').toLocaleDateString('pt-BR')} até ${new Date(formData.eventEndDate + 'T00:00:00').toLocaleDateString('pt-BR')}`
                    : `Evento: ${new Date(formData.eventDate + 'T00:00:00').toLocaleDateString('pt-BR')}`
            ) : ''

            await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_APIKEY },
                body: JSON.stringify({ number, text: welcomeMsg + (eventInfo ? `\n\n${eventInfo}` : '') })
            })

            await new Promise(resolve => setTimeout(resolve, 1500))

            // 2. Generate and Send PDF
            const ownerData = {
                name: settings.owner_name || user.email.split('@')[0],
                email: user.email,
                phone: settings.owner_phone || ''
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
                    fileName: `Orcamento_${quote.id}.pdf`,
                    media: base64PDF
                })
            })

        } catch (error) {
            console.error('Erro WhatsApp Orçamento:', error)
            toastError('Orçamento salvo, mas erro ao enviar WhatsApp.')
        }
    }

    const calculateTotals = () => {
        if (!formData.deliveryDate || !formData.returnDate || formData.selectedItems.length === 0) return null

        const start = new Date(formData.deliveryDate + 'T00:00:00')
        const end = new Date(formData.returnDate + 'T00:00:00')

        if (isNaN(start) || isNaN(end) || start > end) return null

        const diffTime = Math.abs(end - start)
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

        let subtotal = 0
        formData.selectedItems.forEach(si => {
            const item = items.find(i => i.id === si.itemId)
            if (item) {
                subtotal += item.daily_price * diffDays * (parseInt(si.quantity) || 1)
            }
        })

        if (subtotal === 0) return null

        const discount = parseFloat(formData.discount) || 0
        const discountValue = formData.discount_type === 'percent' ? (subtotal * discount) / 100 : discount
        const shippingValue = parseFloat(formData.shipping_cost) || 0
        const finalValue = subtotal - discountValue + shippingValue

        return {
            diffDays,
            subtotal,
            discountValue,
            shippingValue,
            finalValue
        }
    }

    const totals = calculateTotals()

    return (
        <div className="max-w-2xl mx-auto space-y-8 pb-12">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <FileText size={24} />
                </div>
                <h2 className="text-2xl font-bold uppercase tracking-tight">Novo Orçamento</h2>
            </div>

            <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
                <div className="app-card p-6 space-y-6">
                    <div className="space-y-2">
                        <div className="flex justify-between items-end">
                            <label className="app-label">Cliente *</label>
                            <button
                                type="button"
                                onClick={() => setIsCustomerModalOpen(true)}
                                className="text-xs font-bold text-primary hover:text-primary-hover flex items-center gap-1 transition-colors pb-1"
                            >
                                <Plus size={14} />
                                Novo Cliente
                            </button>
                        </div>
                        <SearchableSelect
                            options={customers}
                            value={formData.customerId}
                            onChange={(val) => setFormData({ ...formData, customerId: val })}
                            placeholder="Pesquisar cliente..."
                            displayFn={(option) => option.name}
                            required
                        />
                    </div>

                    <div className="space-y-4 pt-4 border-t border-border-light dark:border-border-dark">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary-light dark:text-text-secondary-dark flex items-center gap-2">
                                Itens do Orçamento
                            </h3>
                            <button
                                type="button"
                                className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                                onClick={() => setFormData({
                                    ...formData,
                                    selectedItems: [...formData.selectedItems, { itemId: '', quantity: 1 }]
                                })}
                            >
                                <Plus size={14} />
                                Adicionar Item
                            </button>
                        </div>

                        <div className="space-y-4">
                            {formData.selectedItems.map((selected, index) => {
                                const availability = itemAvailabilities[selected.itemId]
                                const isLoading = loadingAvailabilities[selected.itemId]

                                return (
                                    <div key={index} className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-border-light dark:border-border-dark space-y-3 relative group">
                                        <div className="flex gap-4 items-end">
                                            <div className="flex-1 space-y-1">
                                                <label className="text-[10px] font-bold uppercase text-text-secondary-light tracking-widest pl-1">Produto / Item</label>
                                                <SearchableSelect
                                                    options={items}
                                                    value={selected.itemId}
                                                    onChange={(val) => {
                                                        const newItems = [...formData.selectedItems]
                                                        newItems[index].itemId = val
                                                        setFormData({ ...formData, selectedItems: newItems })
                                                    }}
                                                    placeholder="Selecione..."
                                                    displayFn={(i) => `${i.name} (R$ ${i.daily_price}/dia)`}
                                                    required
                                                    className="w-full"
                                                />
                                            </div>
                                            <div className="w-24 space-y-1">
                                                <label className="text-[10px] font-bold uppercase text-text-secondary-light tracking-widest pl-1">Qtd</label>
                                                <input
                                                    type="number"
                                                    className="app-input h-10 py-0"
                                                    min="1"
                                                    value={selected.quantity}
                                                    onChange={e => {
                                                        const newItems = [...formData.selectedItems]
                                                        newItems[index].quantity = e.target.value
                                                        setFormData({ ...formData, selectedItems: newItems })
                                                    }}
                                                    required
                                                />
                                            </div>
                                            {formData.selectedItems.length > 1 && (
                                                <button
                                                    type="button"
                                                    className="p-2.5 text-danger hover:bg-danger/10 rounded-lg transition-colors mb-[1px]"
                                                    onClick={() => {
                                                        const newItems = formData.selectedItems.filter((_, i) => i !== index)
                                                        setFormData({ ...formData, selectedItems: newItems })
                                                    }}
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>

                                        {selected.itemId && (
                                            <div className={`px-3 py-2 rounded-lg border text-xs flex justify-between items-center transition-all ${isLoading ? 'bg-slate-100 dark:bg-slate-800 border-border-light dark:border-border-dark' :
                                                (!formData.deliveryDate || !formData.returnDate ? 'bg-slate-50 dark:bg-slate-900/50 border-border-light dark:border-border-dark opacity-60' :
                                                    (availability?.available > 0 ? 'bg-secondary/5 border-secondary/20 text-secondary' : 'bg-danger/5 border-danger/20 text-danger'))
                                                }`}>
                                                <span className="font-medium">Consulta de Disponibilidade:</span>
                                                {isLoading ? (
                                                    <span className="animate-pulse">Consultando...</span>
                                                ) : !formData.deliveryDate || !formData.returnDate ? (
                                                    <span className="italic">Defina as datas para verificar disponibilidade</span>
                                                ) : availability ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold">
                                                            {availability.available} {availability.available === 1 ? 'disponível' : 'disponíveis'}
                                                        </span>
                                                    </div>
                                                ) : (
                                                    <span>N/A</span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border-light dark:border-border-dark">
                        <div className="space-y-2">
                            <label className="app-label">Prev. Entrega *</label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    onClick={(e) => { try { e.target.showPicker() } catch (error) { } }}
                                    className="app-input flex-1"
                                    value={formData.deliveryDate}
                                    onChange={e => {
                                        const val = e.target.value
                                        setFormData(prev => ({
                                            ...prev,
                                            deliveryDate: val,
                                            // Auto-suggest event and return if empty
                                            eventDate: prev.eventDate || val,
                                            returnDate: prev.returnDate || val
                                        }))
                                    }}
                                    required
                                />
                                <input
                                    type="time"
                                    className="app-input w-24 sm:w-32"
                                    value={formData.delivery_time}
                                    onChange={e => setFormData({ ...formData, delivery_time: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="app-label">Prev. Devolução *</label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    onClick={(e) => { try { e.target.showPicker() } catch (error) { } }}
                                    className="app-input flex-1"
                                    value={formData.returnDate}
                                    onChange={e => setFormData({ ...formData, returnDate: e.target.value })}
                                    required
                                />
                                <input
                                    type="time"
                                    className="app-input w-24 sm:w-32"
                                    value={formData.return_time}
                                    onChange={e => setFormData({ ...formData, return_time: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="app-label">Início do Evento *</label>
                            <input
                                type="date"
                                onClick={(e) => { try { e.target.showPicker() } catch (error) { } }}
                                className="app-input border-secondary/20 bg-secondary/[0.02]"
                                value={formData.eventDate}
                                onChange={e => {
                                    const val = e.target.value
                                    setFormData(prev => ({
                                        ...prev,
                                        eventDate: val,
                                        eventEndDate: prev.eventEndDate || val
                                    }))
                                }}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="app-label">Fim do Evento (Opcional)</label>
                            <input
                                type="date"
                                onClick={(e) => { try { e.target.showPicker() } catch (error) { } }}
                                className="app-input border-secondary/20 bg-secondary/[0.02]"
                                value={formData.eventEndDate}
                                onChange={e => setFormData({ ...formData, eventEndDate: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Logística */}
                    <div className="pt-4 border-t border-border-light dark:border-border-dark space-y-4">
                        <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary-light flex items-center gap-2">
                            Logística de Entrega e Coleta
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light">Início: Como o item chega ao cliente?</label>
                                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-border-light dark:border-border-dark">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, delivery_type: 'pickup' })}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${formData.delivery_type === 'pickup' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-text-secondary-light hover:text-text-primary-light'}`}
                                    >
                                        Cliente Retira
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, delivery_type: 'delivery' })}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${formData.delivery_type === 'delivery' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-text-secondary-light hover:text-text-primary-light'}`}
                                    >
                                        Nós Entregamos
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light">Fim: Como o item retorna para nós?</label>
                                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-border-light dark:border-border-dark">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, return_type: 'return' })}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${formData.return_type === 'return' ? 'bg-white dark:bg-slate-700 shadow-sm text-secondary' : 'text-text-secondary-light hover:text-text-primary-light'}`}
                                    >
                                        Cliente Devolve
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, return_type: 'collection' })}
                                        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${formData.return_type === 'collection' ? 'bg-white dark:bg-slate-700 shadow-sm text-secondary' : 'text-text-secondary-light hover:text-text-primary-light'}`}
                                    >
                                        Nós Coletamos
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Endereço do Evento (Condicional) */}
                    {(formData.delivery_type === 'delivery' || formData.return_type === 'collection') && (
                        <div className="pt-4 border-t border-border-light dark:border-border-dark space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                            <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary-light flex items-center gap-2">
                                Endereço do Evento / Entrega
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="space-y-2">
                                    <label className="app-label">CEP *</label>
                                    <input
                                        type="text"
                                        className="app-input"
                                        placeholder="00000-000"
                                        value={formData.address_cep}
                                        onChange={e => {
                                            const val = e.target.value
                                            setFormData({ ...formData, address_cep: val })
                                            if (val.replace(/\D/g, '').length === 8) {
                                                handleCEPLookup(val)
                                            }
                                        }}
                                    />
                                </div>
                                <div className="md:col-span-2 space-y-2">
                                    <label className="app-label">Rua / Logradouro *</label>
                                    <input
                                        type="text"
                                        className="app-input"
                                        value={formData.address_street}
                                        onChange={e => setFormData({ ...formData, address_street: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="app-label">Número *</label>
                                    <input
                                        type="text"
                                        className="app-input"
                                        value={formData.address_number}
                                        onChange={e => setFormData({ ...formData, address_number: e.target.value })}
                                        placeholder="Ex: 123"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="app-label">Bairro *</label>
                                    <input
                                        type="text"
                                        className="app-input"
                                        value={formData.address_neighborhood}
                                        onChange={e => setFormData({ ...formData, address_neighborhood: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="app-label">Cidade *</label>
                                    <input
                                        type="text"
                                        className="app-input"
                                        value={formData.address_city}
                                        onChange={e => setFormData({ ...formData, address_city: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="app-label">Estado *</label>
                                    <input
                                        type="text"
                                        className="app-input"
                                        value={formData.address_state}
                                        onChange={e => setFormData({ ...formData, address_state: e.target.value })}
                                        maxLength={2}
                                        placeholder="UF"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="app-label">Complemento</label>
                                    <input
                                        type="text"
                                        className="app-input"
                                        value={formData.address_complement}
                                        onChange={e => setFormData({ ...formData, address_complement: e.target.value })}
                                        placeholder="Apto, Sala, KM..."
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
                        <div className="space-y-2">
                            <label className="app-label">Pagamento</label>
                            <select
                                className="app-input"
                                value={formData.payment_method}
                                onChange={e => setFormData({ ...formData, payment_method: e.target.value })}
                            >
                                <option value="Dinheiro">Dinheiro</option>
                                <option value="PIX">PIX</option>
                                <option value="Cartão de Crédito">Cartão de Crédito</option>
                                <option value="Cartão de Débito">Cartão de Débito</option>
                                <option value="Transferência">Transferência</option>
                                <option value="Boleto">Boleto</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="app-label">Parcelas</label>
                            <select
                                className="app-input"
                                value={formData.installments}
                                onChange={e => setFormData({ ...formData, installments: e.target.value })}
                            >
                                {[...Array(12)].map((_, i) => (
                                    <option key={i + 1} value={i + 1}>{i + 1}x</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="app-label">Tipo Desconto</label>
                            <select
                                className="app-input"
                                value={formData.discount_type}
                                onChange={e => setFormData({ ...formData, discount_type: e.target.value })}
                            >
                                <option value="value">Valor (R$)</option>
                                <option value="percent">Percentual (%)</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div className="space-y-2">
                            <label className="app-label">Desconto</label>
                            <input
                                type="number"
                                className="app-input"
                                value={formData.discount}
                                onChange={e => setFormData({ ...formData, discount: e.target.value })}
                                placeholder={formData.discount_type === 'percent' ? 'Ex: 10 (%)' : 'Ex: 50.00'}
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="app-label">Valor do Frete (R$)</label>
                            <input
                                type="number"
                                className="app-input"
                                value={formData.shipping_cost}
                                onChange={e => setFormData({ ...formData, shipping_cost: e.target.value })}
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                        <div className="space-y-2">
                            <label className="app-label">Entrada / Sinal (R$)</label>
                            <input
                                type="number"
                                className="app-input"
                                value={formData.down_payment}
                                onChange={e => setFormData({ ...formData, down_payment: e.target.value })}
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="app-label">Valor da Caução (R$)</label>
                            <input
                                type="number"
                                className="app-input border-warning/20 bg-warning/[0.02]"
                                value={formData.security_deposit_value}
                                onChange={e => setFormData({ ...formData, security_deposit_value: e.target.value })}
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                            />
                        </div>
                    </div>

                    {totals && (
                        <div className="p-6 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/20 space-y-4">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-primary/70">Sumário do Orçamento</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center text-text-secondary-light">
                                    <span>Subtotal ({totals.diffDays} dias):</span>
                                    <span>R$ {totals.subtotal.toFixed(2)}</span>
                                </div>
                                {totals.discountValue > 0 && (
                                    <div className="flex justify-between items-center font-bold text-secondary">
                                        <span>Desconto:</span>
                                        <span>- R$ {totals.discountValue.toFixed(2)}</span>
                                    </div>
                                )}
                                {totals.shippingValue > 0 && (
                                    <div className="flex justify-between items-center font-bold text-primary">
                                        <span>Frete:</span>
                                        <span>+ R$ {totals.shippingValue.toFixed(2)}</span>
                                    </div>
                                )}
                                <div className="pt-4 border-t border-primary/10 flex justify-between items-end">
                                    <span className="font-bold">Total Final:</span>
                                    <span className="text-2xl font-black text-primary leading-none">R$ {totals.finalValue.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4 pt-4 border-t border-border-light dark:border-border-dark">
                        <div className={`p-4 rounded-xl border transition-all flex items-center gap-4 ${formData.sendWhatsapp ? 'bg-secondary/5 border-secondary/30' : 'bg-slate-50 dark:bg-slate-800 border-border-light dark:border-border-dark'}`}>
                            <div className="relative">
                                <input
                                    type="checkbox"
                                    id="sendWpp"
                                    className="sr-only"
                                    checked={formData.sendWhatsapp}
                                    onChange={e => setFormData({ ...formData, sendWhatsapp: e.target.checked })}
                                />
                                <label
                                    htmlFor="sendWpp"
                                    className={`block w-12 h-6 rounded-full cursor-pointer transition-colors relative ${formData.sendWhatsapp ? 'bg-secondary' : 'bg-slate-300 dark:bg-slate-700'}`}
                                >
                                    <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform duration-300 ${formData.sendWhatsapp ? 'translate-x-6' : ''}`}></span>
                                </label>
                            </div>

                            <div className="flex-1">
                                <div className={`flex items-center gap-2 text-sm font-bold ${formData.sendWhatsapp ? 'text-secondary' : 'opacity-40'}`}>
                                    <MessageCircle size={18} />
                                    {formData.sendWhatsapp ? 'Enviar orçamento via WhatsApp' : 'Mensagem automática desativada'}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                type="button"
                                onClick={handleSaveAndSend}
                                className="bg-primary hover:bg-primary-hover text-white py-4 px-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-primary/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs sm:text-sm"
                                disabled={loading || savingDraft}
                            >
                                {loading ? 'Salvando...' : 'Salvar'}
                                <CheckCircle size={18} />
                            </button>

                            <button
                                type="button"
                                onClick={handlePreview}
                                className="border border-secondary/30 text-secondary hover:bg-secondary/5 py-4 px-4 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs sm:text-sm"
                                disabled={loading || savingDraft || !formData.customerId || formData.selectedItems.some(i => !i.itemId)}
                            >
                                <Eye size={18} />
                                Visualizar
                            </button>
                        </div>
                    </div>
                    <div className="flex justify-center pt-2">
                        <button
                            type="button"
                            className="text-text-secondary-light hover:text-danger text-sm font-bold transition-colors"
                            onClick={() => navigate('/quotes')}
                            disabled={loading || savingDraft}
                        >
                            Cancelar e Voltar
                        </button>
                    </div>
                </div>
            </form >

            <QuickCustomerModal
                isOpen={isCustomerModalOpen}
                onClose={() => setIsCustomerModalOpen(false)}
                onSuccess={(newCustomer) => {
                    setCustomers(prev => [...prev, newCustomer])
                    setFormData(prev => ({ ...prev, customerId: newCustomer.id }))
                }}
            />
        </div >
    )
}

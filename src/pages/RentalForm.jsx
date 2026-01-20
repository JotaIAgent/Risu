
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { FileText, MessageCircle, Plus, Trash2 } from 'lucide-react'
import { generateContractPDF } from '../lib/pdfGenerator'
import { useDialog } from '../components/DialogProvider'
import QuickCustomerModal from '../components/QuickCustomerModal'
import SearchableSelect from '../components/SearchableSelect'

export default function RentalForm() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const preSelectedClientId = searchParams.get('client_id')
    const { user } = useAuth()
    const { success, error: toastError, alert: dialogAlert } = useDialog()

    const [loading, setLoading] = useState(false)
    const [customers, setCustomers] = useState([])
    const [items, setItems] = useState([])
    const [settings, setSettings] = useState(null)
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false)

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

    const [formData, setFormData] = useState({
        customerId: preSelectedClientId || '',
        deliveryDate: '',
        eventDate: '',
        eventEndDate: '',
        returnDate: '',
        payment_method: 'Dinheiro',
        discount: 0,
        discount_type: 'value',
        down_payment: 0,
        installments: 1,
        selectedItems: [{ itemId: '', quantity: 1 }],
        sendWhatsapp: true,
        shipping_cost: 0,
        security_deposit_value: 0,
        delivery_type: 'pickup',
        return_type: 'return',
        address_cep: '',
        address_street: '',
        address_number: '',
        address_complement: '',
        address_neighborhood: '',
        address_city: '',
        address_state: '',
        delivery_time: '',
        return_time: '',
        custom_due_date: ''
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

        // If already loading this specific item, wait
        if (loadingAvailabilities[selectedItem.itemId]) return

        const item = items.find(i => i.id === selectedItem.itemId)
        if (!item) return

        try {
            setLoadingAvailabilities(prev => ({ ...prev, [selectedItem.itemId]: true }))

            const { data: overlappingRentals } = await supabase
                .from('rental_items')
                .select('quantity, rentals!inner(status, start_date, end_date, type)')
                .eq('item_id', selectedItem.itemId)
                .neq('rentals.status', 'canceled')
                .neq('rentals.status', 'completed')
                .or('type.eq.rental,type.is.null', { foreignTable: 'rentals' })
                .lte('rentals.start_date', formData.returnDate)
                .gte('rentals.end_date', formData.deliveryDate)

            const { data: oldRentals } = await supabase
                .from('rentals')
                .select('quantity')
                .eq('item_id', selectedItem.itemId)
                .neq('status', 'canceled')
                .neq('status', 'completed')
                .or('type.eq.rental,type.is.null')
                .lte('start_date', formData.returnDate)
                .gte('end_date', formData.deliveryDate)

            const rentedCount = (overlappingRentals?.reduce((sum, r) => sum + (r.quantity || 1), 0) || 0) +
                (oldRentals?.reduce((sum, r) => sum + (r.quantity || 1), 0) || 0)

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
        if (formData.customerId && settings) {
            const customer = customers.find(c => c.id === formData.customerId)
            const globalEnabled = settings.global_auto_send !== false
            const customerEnabled = (customer?.whatsapp_opt_in !== false)
            setFormData(prev => ({ ...prev, sendWhatsapp: globalEnabled && customerEnabled }))
        }
    }, [formData.customerId, settings, customers])

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

    async function handleSubmit(e) {
        e.preventDefault()
        if (!user) return

        try {
            setLoading(true)

            if (new Date(formData.deliveryDate) > new Date(formData.returnDate)) {
                toastError('A data de devolução deve ser após a data de entrega')
                setLoading(false)
                return
            }
            if (formData.eventDate && (new Date(formData.eventDate) < new Date(formData.deliveryDate) || new Date(formData.eventDate) > new Date(formData.returnDate))) {
                toastError('A data do evento deve estar entre a entrega e a devolução')
                setLoading(false)
                return
            }

            // Validate all items availability
            for (const selected of formData.selectedItems) {
                const availability = itemAvailabilities[selected.itemId]
                if (availability && parseInt(selected.quantity) > availability.available) {
                    const item = items.find(i => i.id === selected.itemId)
                    toastError(`Saldo insuficiente para ${item?.name}! Estoque disponível: ${availability.available} unidades.`)
                    setLoading(false)
                    return
                }
            }

            const { finalValue } = totals || { finalValue: 0 }

            // 1. Create Rental Record
            const { data: rental, error: rentalError } = await supabase
                .from('rentals')
                .insert([{
                    user_id: user.id,
                    client_id: formData.customerId,
                    item_id: formData.selectedItems[0].itemId, // Added for backward compatibility
                    quantity: parseInt(formData.selectedItems[0].quantity) || 1, // Added for backward compatibility
                    start_date: formData.deliveryDate, // Backward sync
                    end_date: formData.returnDate,     // Backward sync
                    delivery_date: formData.deliveryDate,
                    delivery_time: formData.delivery_time,
                    return_time: formData.return_time,
                    custom_due_date: formData.custom_due_date || null,
                    event_date: formData.eventDate,
                    event_end_date: formData.eventEndDate || formData.eventDate,
                    return_date: formData.returnDate,
                    payment_method: formData.payment_method,
                    discount: parseFloat(formData.discount) || 0,
                    discount_type: formData.discount_type,
                    down_payment: parseFloat(formData.down_payment) || 0,
                    installments: parseInt(formData.installments) || 1,
                    status: 'confirmed',
                    contract_status: 'pending',
                    shipping_cost: parseFloat(formData.shipping_cost) || 0,
                    total_value: finalValue,
                    security_deposit_value: parseFloat(formData.security_deposit_value) || 0,
                    security_deposit_status: (parseFloat(formData.security_deposit_value) || 0) > 0 ? 'PENDING' : 'RETURNED',
                    payment_status: (parseFloat(formData.down_payment) || 0) >= finalValue ? 'PAID' :
                        (parseFloat(formData.down_payment) || 0) > 0 ? 'PARTIAL' : 'PENDING',
                    delivery_type: formData.delivery_type,
                    return_type: formData.return_type,
                    address_cep: formData.address_cep,
                    address_street: formData.address_street,
                    address_number: formData.address_number,
                    address_complement: formData.address_complement,
                    address_neighborhood: formData.address_neighborhood,
                    address_city: formData.address_city,
                    address_state: formData.address_state
                }])
                .select()
                .single()

            if (rentalError) throw rentalError

            // 2. Create Rental Items Records
            const rentalItemsPayload = formData.selectedItems.map(item => ({
                rental_id: rental.id,
                item_id: item.itemId,
                quantity: parseInt(item.quantity) || 1,
                unit_price: items.find(i => i.id === item.itemId)?.daily_price || 0,
                user_id: user.id
            }))

            const { error: itemsError } = await supabase
                .from('rental_items')
                .insert(rentalItemsPayload)

            if (itemsError) throw itemsError

            if (formData.sendWhatsapp && settings?.global_auto_send !== false && settings?.instance_name && EVOLUTION_URL) {
                await sendWhatsappMessages(rental)
            }

            success('Aluguel criado com sucesso!')
            navigate('/rentals')

        } catch (error) {
            console.error('Error creating rental:', error)
            toastError('Erro ao criar aluguel')
        } finally {
            setLoading(false)
        }
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
                cpf_cnpj: settings.owner_cpf_cnpj || '',
                phone: settings.owner_phone || '',
                fullAddress: settings.owner_street
                    ? `${settings.owner_street}, ${settings.owner_number}${settings.owner_complement ? ` (${settings.owner_complement})` : ''}, ${settings.owner_neighborhood}, ${settings.owner_city}-${settings.owner_state}`
                    : ''
            }

            const logoBase64 = settings.contract_logo_url ? await imageToBase64(settings.contract_logo_url) : null

            // Create a temporary rental object for the PDF generator
            const tempRental = {
                id: 'PREVIEW',
                delivery_date: formData.deliveryDate,
                delivery_time: formData.delivery_time,
                return_date: formData.returnDate,
                return_time: formData.return_time,
                custom_due_date: formData.custom_due_date,
                event_date: formData.eventDate,
                event_end_date: formData.eventEndDate,
                start_date: formData.deliveryDate,
                end_date: formData.returnDate,
                discount: parseFloat(formData.discount) || 0,
                discount_type: formData.discount_type,
                down_payment: parseFloat(formData.down_payment) || 0,
                shipping_cost: parseFloat(formData.shipping_cost) || 0,
                delivery_type: formData.delivery_type,
                return_type: formData.return_type,
                address_street: formData.address_street,
                address_number: formData.address_number,
                address_complement: formData.address_complement,
                address_neighborhood: formData.address_neighborhood,
                address_city: formData.address_city,
                address_state: formData.address_state,
                payment_method: formData.payment_method,
                installments: parseInt(formData.installments) || 1,
                total_value: finalValue
            }

            const pdf = generateContractPDF(
                tempRental,
                customer || { name: 'Cliente Teste' },
                selectedItemsData,
                ownerData,
                settings.contract_pdf_template,
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

    async function sendWhatsappMessages(rental) {
        const customer = customers.find(c => c.id === rental.client_id)
        if (!customer?.whatsapp) return

        try {
            const startDate = new Date(rental.delivery_date + 'T00:00:00')
            const endDate = new Date(rental.return_date + 'T00:00:00')
            const eventDate = new Date(rental.event_date + 'T00:00:00')
            const diffTime = Math.abs(endDate - startDate)
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

            // Build items list text
            const selectedItemsData = formData.selectedItems.map(si => ({
                ...items.find(i => i.id === si.itemId),
                quantity: si.quantity
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

            // 1. Initial text message
            const welcomeMsg = replaceVars(settings.contract_template || 'Olá {cliente}, seu aluguel está confirmado.')

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
            console.log('✅ Mensagem 1 enviada')
            await new Promise(resolve => setTimeout(resolve, 2000))

            // 2. PDF message
            try {
                const ownerData = {
                    name: settings.owner_name || user.email.split('@')[0],
                    email: user.email,
                    cpf_cnpj: settings.owner_cpf_cnpj || '',
                    phone: settings.owner_phone || ''
                }

                const logoBase64 = settings.contract_logo_url ? await imageToBase64(settings.contract_logo_url) : null

                const pdf = generateContractPDF(
                    rental,
                    customer,
                    selectedItemsData, // Pass the array of items
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
                        fileName: `Contrato_${rental.id}.pdf`,
                        media: base64PDF
                    })
                })
                console.log('✅ Mensagem 2 enviada (PDF)')
                await new Promise(resolve => setTimeout(resolve, 2000))
            } catch (pdfError) {
                console.error('Erro PDF:', pdfError)
            }

            // 3. Signature instructions
            const message3 = replaceVars(settings.signature_message || 'Assine digitalmente.')
            await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_APIKEY },
                body: JSON.stringify({ number, text: message3 })
            })
            console.log('✅ Mensagem 3 enviada')
            await new Promise(resolve => setTimeout(resolve, 2000))

            // 4. Upload link
            const message4 = replaceVars(settings.upload_message || 'Envie de volta: {upload_link}')
            await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_APIKEY },
                body: JSON.stringify({ number, text: message4 })
            })
            console.log('✅ Mensagem 4 enviada')
            console.log('🎉 Todas as mensagens enviadas!')

        } catch (error) {
            console.error('Erro WhatsApp:', error)
            toastError('Aluguel salvo, mas erro no envio do WhatsApp.')
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
        const downPayment = parseFloat(formData.down_payment) || 0

        return {
            diffDays,
            subtotal,
            discountValue,
            shippingValue,
            downPayment,
            finalValue,
            balance: finalValue - downPayment
        }
    }

    const totals = calculateTotals()

    return (
        <div className="max-w-2xl mx-auto space-y-8 pb-12">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <Plus size={24} />
                </div>
                <h2 className="text-2xl font-bold">Novo Aluguel</h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
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
                                Itens do Aluguel
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
                                                <span className="font-medium">Status do Estoque:</span>
                                                {isLoading ? (
                                                    <span className="animate-pulse">Consultando...</span>
                                                ) : !formData.deliveryDate || !formData.returnDate ? (
                                                    <span className="italic">Defina as datas para verificar disponibilidade</span>
                                                ) : availability ? (
                                                    <div className="flex items-center gap-2">
                                                        {parseInt(selected.quantity) > availability.available && (
                                                            <div className="w-2 h-2 rounded-full bg-danger animate-ping"></div>
                                                        )}
                                                        <span className="font-bold">
                                                            {availability.available} {availability.available === 1 ? 'disponível' : 'disponíveis'}
                                                            {availability.maintenance > 0 && ` (-${availability.maintenance} em manutenção)`}
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
                            <label className="app-label">Retirada / Entrega *</label>
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
                            <label className="app-label">Devolução / Coleta *</label>
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
                                required
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
                                    <label className="app-label">Logradouro / Rua *</label>
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
                                    <label className="app-label">Estado (UF) *</label>
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                            <label className="app-label">Data de Vencimento *</label>
                            <input
                                type="date"
                                className="app-input"
                                value={formData.custom_due_date}
                                onChange={e => setFormData({ ...formData, custom_due_date: e.target.value })}
                                required
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
                            <h3 className="text-xs font-bold uppercase tracking-widest text-primary/70">Sumário Financeiro</h3>

                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between items-center text-text-secondary-light dark:text-text-secondary-dark">
                                    <span>Subtotal ({totals.diffDays} dias):</span>
                                    <span>R$ {totals.subtotal.toFixed(2)}</span>
                                </div>

                                {totals.discountValue > 0 && (
                                    <div className="flex justify-between items-center font-bold text-secondary">
                                        <span>Desconto Aplicado:</span>
                                        <span>- R$ {totals.discountValue.toFixed(2)}</span>
                                    </div>
                                )}

                                {totals.shippingValue > 0 && (
                                    <div className="flex justify-between items-center font-bold text-primary">
                                        <span>Frete:</span>
                                        <span>+ R$ {totals.shippingValue.toFixed(2)}</span>
                                    </div>
                                )}

                                {totals.downPayment > 0 && (
                                    <div className="flex justify-between items-center font-bold text-primary">
                                        <span>Entrada (Sinal):</span>
                                        <span>- R$ {totals.downPayment.toFixed(2)}</span>
                                    </div>
                                )}

                                <div className="pt-4 border-t border-primary/10 flex justify-between items-end">
                                    <span className="font-bold">Total Final:</span>
                                    <span className="text-2xl font-black text-primary leading-none">R$ {totals.finalValue.toFixed(2)}</span>
                                </div>

                                {totals.downPayment > 0 && (
                                    <div className="flex justify-between items-center pt-2 text-xs font-bold text-text-secondary-light">
                                        <span className="uppercase tracking-wider">Saldo Restante</span>
                                        <span className="text-sm">R$ {totals.balance.toFixed(2)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {settings?.instance_name && (
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
                                <div className={`flex items-center gap-2 text-sm font-bold ${formData.sendWhatsapp && settings?.global_auto_send !== false ? 'text-secondary' : 'opacity-40'}`}>
                                    <MessageCircle size={18} />
                                    {settings?.global_auto_send === false
                                        ? 'Bloqueado (Envio Global Desativado)'
                                        : formData.sendWhatsapp ? 'Enviar contrato via WhatsApp' : 'Mensagem automática desativada'}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                        <button
                            type="submit"
                            className="bg-primary hover:bg-primary-hover text-white py-4 px-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-primary/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs sm:text-sm"
                            disabled={loading}
                        >
                            {loading ? 'Processando...' : 'Finalizar Aluguel'}
                        </button>
                        <button
                            type="button"
                            onClick={handlePreview}
                            className="border border-secondary/30 text-secondary hover:bg-secondary/5 py-4 px-4 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50 text-xs sm:text-sm"
                            disabled={loading || !formData.customerId || formData.selectedItems.some(i => !i.itemId)}
                        >
                            <FileText size={18} />
                            Visualizar
                        </button>
                        <button
                            type="button"
                            className="border border-border-light dark:border-border-dark hover:bg-slate-50 dark:hover:bg-slate-800 py-4 px-4 rounded-2xl font-bold transition-all text-sm"
                            onClick={() => navigate('/rentals')}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </form>

            <QuickCustomerModal
                isOpen={isCustomerModalOpen}
                onClose={() => setIsCustomerModalOpen(false)}
                onSuccess={(newCustomer) => {
                    setCustomers(prev => [...prev, newCustomer])
                    setFormData(prev => ({ ...prev, customerId: newCustomer.id }))
                }}
            />
        </div>
    )
}

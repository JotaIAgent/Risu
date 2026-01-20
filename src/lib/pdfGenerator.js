import jsPDF from 'jspdf'

function formatPhone(phone) {
    if (!phone) return 'Não informado'
    const cleaned = phone.replace(/\D/g, '')

    if (cleaned.length === 11) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`
    }
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`
    }
    return phone
}

export const generateContractPDF = (
    rental,
    customer,
    items, // Now an array
    ownerData,
    pdfTemplate,
    logoUrl,
    primaryColor,
    secondaryColor
) => {
    const doc = new jsPDF()

    const margin = 20
    const pageWidth = doc.internal.pageSize.width
    const pageHeight = doc.internal.pageSize.height
    let yPos = margin

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 20, g: 184, b: 166 }
    }

    const primary = hexToRgb(primaryColor || '#14b8a6')
    const secondary = hexToRgb(secondaryColor || '#0d9488')

    // Header
    doc.setFillColor(primary.r, primary.g, primary.b)
    doc.rect(0, 0, pageWidth, 25, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    const title = pdfTemplate?.title || 'CONTRATO DE LOCAÇÃO DE EQUIPAMENTO'
    doc.text(title, pageWidth / 2, 15, { align: 'center' })

    doc.setTextColor(0, 0, 0)
    yPos = 35

    // Logo (if provided and valid)
    // Note: To use images in jsPDF from external URLs, they usually need to be base64.
    // For now we'll attempt to add it if it's already a base64 or a local data path.
    // If it's a URL, the user should provide a base64 or we handle it in the component.
    if (logoUrl) {
        try {
            // Use 'FAST' compression and auto-aspect ratio (height = 0)
            // margin, y, width, height
            doc.addImage(logoUrl, 'JPEG', margin, 30, 25, 0)
            yPos = 65 // Move content down if logo is present
        } catch (e) {
            console.error('Error adding logo to PDF:', e)
        }
    }

    // Calculate rental details
    const startDate = new Date(rental.start_date + 'T00:00:00')
    const endDate = new Date(rental.end_date + 'T00:00:00')
    const diffTime = Math.abs(endDate - startDate)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

    // Calculate subtotal from all items
    const subtotal = items.reduce((sum, item) => {
        const price = parseFloat(item.daily_price) || 0
        return sum + (price * diffDays * (parseInt(item.quantity) || 1))
    }, 0)

    // Calculate discount
    const discount = rental.discount || 0
    const discountType = rental.discount_type || 'value'
    let discountValue = 0

    if (discountType === 'percent') {
        discountValue = (subtotal * discount) / 100
    } else {
        discountValue = discount
    }

    const shippingCost = rental.shipping_cost || 0
    const totalAfterDiscount = subtotal - discountValue
    const finalValue = totalAfterDiscount + shippingCost // Valor final é o total do contrato
    const downPayment = rental.down_payment || 0
    const paymentMethod = rental.payment_method || 'Dinheiro'
    const installments = rental.installments || 1
    const securityDeposit = rental.security_deposit_value || 0

    const leftCol = margin
    const rightCol = pageWidth / 2 + 5
    const colWidth = (pageWidth - 2 * margin) / 2 - 5

    // Sections
    doc.setFillColor(secondary.r, secondary.g, secondary.b)
    doc.rect(leftCol, yPos, colWidth, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Informações do proprietário', leftCol + 2, yPos + 5.5)

    doc.setFillColor(secondary.r, secondary.g, secondary.b)
    doc.rect(rightCol, yPos, colWidth, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Informações do locatário', rightCol + 2, yPos + 5.5)

    yPos += 12
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(9)

    // Owner Info
    let yLeft = yPos
    doc.setFont('helvetica', 'bold')
    doc.text('Nome do proprietário', leftCol, yLeft)
    yLeft += 4
    doc.setFont('helvetica', 'normal')
    doc.text(ownerData.name || 'Não informado', leftCol, yLeft)

    yLeft += 6
    doc.setFont('helvetica', 'bold')
    doc.text('Email do proprietário', leftCol, yLeft)
    yLeft += 4
    doc.setFont('helvetica', 'normal')
    doc.text(ownerData.email || 'Não informado', leftCol, yLeft)

    yLeft += 6
    doc.setFont('helvetica', 'bold')
    doc.text('Telefone do proprietário', leftCol, yLeft)
    yLeft += 4
    doc.setFont('helvetica', 'normal')
    doc.text(formatPhone(ownerData.phone), leftCol, yLeft)

    yLeft += 6
    doc.setFont('helvetica', 'bold')
    doc.text('CPF/CNPJ do proprietário', leftCol, yLeft)
    yLeft += 4
    doc.setFont('helvetica', 'normal')
    doc.text(ownerData.cpf_cnpj || 'Não informado', leftCol, yLeft)

    // Renter Info
    let yRight = yPos
    doc.setFont('helvetica', 'bold')
    doc.text('Nome do locatário', rightCol, yRight)
    yRight += 4
    doc.setFont('helvetica', 'normal')
    doc.text(customer.name, rightCol, yRight)

    yRight += 6
    doc.setFont('helvetica', 'bold')
    doc.text('Email do locatário', rightCol, yRight)
    yRight += 4
    doc.setFont('helvetica', 'normal')
    doc.text(customer.email || 'Não informado', rightCol, yRight)

    yRight += 6
    doc.setFont('helvetica', 'bold')
    doc.text('Telefone do locatário', rightCol, yRight)
    yRight += 4
    doc.setFont('helvetica', 'normal')
    doc.text(formatPhone(customer.whatsapp), rightCol, yRight)

    yRight += 6
    doc.setFont('helvetica', 'bold')
    doc.text('CPF do locatário', rightCol, yRight)
    yRight += 4
    doc.setFont('helvetica', 'normal')
    doc.text(customer.cpf || 'Não informado', rightCol, yRight)

    yPos = Math.max(yLeft, yRight) + 10

    // Equipment Section
    doc.setFillColor(secondary.r, secondary.g, secondary.b)
    doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Informações do equipamento', margin + 2, yPos + 5.5)

    yPos += 12
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(9)

    doc.setFont('helvetica', 'bold')
    doc.text('Descrição do equipamento', margin, yPos)
    doc.text('Valor diária', pageWidth / 2, yPos)
    doc.text('Quantidade', pageWidth - margin - 30, yPos)

    yPos += 5
    doc.setFont('helvetica', 'normal')

    items.forEach((item) => {
        const name = item.name || 'Item desconhecido'
        const price = parseFloat(item.daily_price) || 0
        const qty = item.quantity || 1

        doc.text(name, margin, yPos)
        doc.text(`R$ ${price.toFixed(2)}`, pageWidth / 2, yPos)
        doc.text(String(qty), pageWidth - margin - 30, yPos)
        yPos += 5
    })

    yPos += 5

    // Rental Section
    doc.setFillColor(secondary.r, secondary.g, secondary.b)
    doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Informações do aluguel', margin + 2, yPos + 5.5)

    yPos += 12
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(9)

    doc.setFont('helvetica', 'bold')
    doc.text('Data de início do aluguel', margin, yPos)
    doc.text('Data final do aluguel', pageWidth / 2, yPos)
    yPos += 4
    doc.setFont('helvetica', 'normal')
    doc.text(startDate.toLocaleDateString('pt-BR'), margin, yPos)
    doc.text(endDate.toLocaleDateString('pt-BR'), pageWidth / 2, yPos)

    yPos += 8
    doc.setFont('helvetica', 'bold')
    doc.text(`Total de dias: ${diffDays}`, margin, yPos)

    if (rental.event_date) {
        yPos += 10
        doc.setFont('helvetica', 'bold')
        doc.text('Período do Evento:', margin, yPos)
        doc.setFont('helvetica', 'normal')
        const eventStart = new Date(rental.event_date + 'T00:00:00').toLocaleDateString('pt-BR')
        const eventEnd = rental.event_end_date ? new Date(rental.event_end_date + 'T00:00:00').toLocaleDateString('pt-BR') : eventStart
        const eventText = eventStart === eventEnd ? eventStart : `${eventStart} até ${eventEnd}`
        doc.text(eventText, margin + 40, yPos)
    }

    yPos += 10

    // Logistics & Address Section
    const isPickup = rental.delivery_type === 'pickup'
    const isCollection = rental.return_type === 'return'

    doc.setFillColor(secondary.r, secondary.g, secondary.b)
    doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Logística e Localização', margin + 2, yPos + 5.5)

    yPos += 12
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(9)

    doc.setFont('helvetica', 'bold')
    doc.text('Logística:', margin, yPos)
    doc.setFont('helvetica', 'normal')
    const deliveryLabel = isPickup ? 'Cliente Retira no Local' : 'Empresa Entrega no Endereço'
    const returnLabel = isCollection ? 'Cliente Devolve no Local' : 'Empresa Coleta no Endereço'
    doc.text(`${deliveryLabel} / ${returnLabel}`, margin + 35, yPos)
    yPos += 6

    doc.setFont('helvetica', 'bold')
    doc.text('Local do Evento/Entrega:', margin, yPos)
    doc.setFont('helvetica', 'normal')

    let addressValue = ''
    if (isPickup) {
        addressValue = ownerData.fullAddress || 'Endereço da empresa não informado'
    } else if (rental.address_street) {
        addressValue = `${rental.address_street}, ${rental.address_number}${rental.address_complement ? ` (${rental.address_complement})` : ''}, ${rental.address_neighborhood}, ${rental.address_city}-${rental.address_state}`
    } else {
        addressValue = 'Endereço não informado'
    }

    const addressLines = doc.splitTextToSize(addressValue, pageWidth - 2 * margin - 45)
    doc.text(addressLines, margin + 45, yPos)
    yPos += (addressLines.length * 4) + 6

    // Payment Section
    doc.setFillColor(secondary.r, secondary.g, secondary.b)
    doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Detalhes do pagamento', margin + 2, yPos + 5.5)

    yPos += 12
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(9)

    doc.setFont('helvetica', 'bold')
    doc.text('Subtotal:', margin, yPos)
    doc.setFont('helvetica', 'normal')
    doc.text(`R$ ${subtotal.toFixed(2)}`, margin + 60, yPos)

    if (discountValue > 0) {
        yPos += 5
        doc.setFont('helvetica', 'bold')
        const discountLabel = discountType === 'percent' ? `Desconto (${discount}%):` : 'Desconto:'
        doc.text(discountLabel, margin, yPos)
        doc.setFont('helvetica', 'normal')
        doc.text(`- R$ ${discountValue.toFixed(2)}`, margin + 60, yPos)
    }

    yPos += 5
    doc.setFont('helvetica', 'bold')
    doc.text('Frete:', margin, yPos)
    doc.setFont('helvetica', 'normal')
    doc.text(`R$ ${shippingCost.toFixed(2)}`, margin + 60, yPos)

    if (securityDeposit > 0) {
        yPos += 5
        doc.setFont('helvetica', 'bold')
        doc.text('Caução (Devolvível):', margin, yPos)
        doc.setFont('helvetica', 'normal')
        doc.text(`+ R$ ${securityDeposit.toFixed(2)}`, margin + 60, yPos)
    }

    if (downPayment > 0) {
        yPos += 5
        doc.setFont('helvetica', 'bold')
        doc.text('Entrada/Sinal:', margin, yPos)
        doc.setFont('helvetica', 'normal')
        doc.text(`- R$ ${downPayment.toFixed(2)}`, margin + 60, yPos)
    }

    yPos += 7
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Total do Aluguel:', margin, yPos)
    doc.text(`R$ ${finalValue.toFixed(2)}`, margin + 60, yPos)

    if (downPayment > 0) {
        yPos += 7
        doc.setFontSize(10)
        doc.text('Saldo Remanescente:', margin, yPos)
        doc.text(`R$ ${(finalValue - downPayment).toFixed(2)}`, margin + 60, yPos)
    }

    yPos += 7
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Condição de Pagamento:', margin, yPos)
    doc.setFont('helvetica', 'bold')
    doc.text(`${paymentMethod}${installments > 1 ? ` (${installments}x)` : ''}`, margin + 60, yPos)

    // Force page break for Clauses and Signatures
    doc.addPage()
    yPos = margin

    // Header for second page (Branding)
    doc.setFillColor(primary.r, primary.g, primary.b)
    doc.rect(0, 0, pageWidth, 15, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(title, pageWidth / 2, 10, { align: 'center' })

    yPos = 30
    doc.setTextColor(0, 0, 0)

    // Clauses
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('CLÁUSULAS:', margin, yPos)
    yPos += 8

    const clauses = pdfTemplate?.clauses || []
    doc.setFontSize(9)
    clauses.forEach((clause, index) => {
        doc.setFont('helvetica', 'normal')
        const lines = doc.splitTextToSize(`${index + 1}. ${clause}`, pageWidth - 2 * margin)
        if (yPos + 10 > pageHeight - margin) {
            doc.addPage()
            yPos = margin
        }
        doc.text(lines, margin, yPos)
        yPos += lines.length * 5 + 3
    })

    yPos += 10

    // Signatures
    if (yPos > pageHeight - 40) {
        doc.addPage()
        yPos = margin
    }

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, margin, yPos)
    yPos += 20

    const signatureY = yPos
    doc.line(margin, signatureY, pageWidth / 2 - 10, signatureY)
    doc.line(pageWidth / 2 + 10, signatureY, pageWidth - margin, signatureY)

    yPos += 5
    doc.setFontSize(8)
    doc.text('LOCADOR', margin, yPos)
    doc.text('LOCATÁRIO', pageWidth / 2 + 10, yPos)

    return doc
}

export const generateQuotePDF = (
    rental,
    customer,
    items,
    ownerData,
    logoUrl,
    primaryColor,
    secondaryColor
) => {
    const doc = new jsPDF()

    const margin = 20
    const pageWidth = doc.internal.pageSize.width
    let yPos = margin

    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 20, g: 184, b: 166 }
    }

    const primary = hexToRgb(primaryColor || '#14b8a6')
    const secondary = hexToRgb(secondaryColor || '#0d9488')

    // Header
    doc.setFillColor(primary.r, primary.g, primary.b)
    doc.rect(0, 0, pageWidth, 25, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text('ORÇAMENTO DE LOCAÇÃO', pageWidth / 2, 15, { align: 'center' })

    doc.setTextColor(0, 0, 0)
    yPos = 35

    if (logoUrl) {
        try {
            doc.addImage(logoUrl, 'JPEG', margin, 30, 25, 0)
            yPos = 65
        } catch (e) {
            console.error('Error adding logo to PDF:', e)
        }
    }

    // Rental Dates
    const startDate = new Date(rental.delivery_date || rental.start_date + 'T00:00:00')
    const endDate = new Date(rental.return_date || rental.end_date + 'T00:00:00')
    const diffTime = Math.abs(endDate - startDate)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

    // Calculations
    const subtotal = items.reduce((sum, item) => {
        const price = parseFloat(item.daily_price) || 0
        return sum + (price * diffDays * (parseInt(item.quantity) || 1))
    }, 0)

    const discount = rental.discount || 0
    const discountType = rental.discount_type || 'value'
    let discountValue = (discountType === 'percent') ? (subtotal * discount) / 100 : discount

    const shippingCost = rental.shipping_cost || 0
    const finalValue = subtotal - discountValue + shippingCost

    // New fields
    const securityDeposit = rental.security_deposit_value || 0
    const downPayment = rental.down_payment || 0
    const paymentMethod = rental.payment_method || 'Dinheiro'
    const installments = rental.installments || 1

    const leftCol = margin
    const rightCol = pageWidth / 2 + 5
    const colWidth = (pageWidth - 2 * margin) / 2 - 5

    // Sections
    doc.setFillColor(secondary.r, secondary.g, secondary.b)
    doc.rect(leftCol, yPos, colWidth, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Dados do Locador', leftCol + 2, yPos + 5.5)

    doc.setFillColor(secondary.r, secondary.g, secondary.b)
    doc.rect(rightCol, yPos, colWidth, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Dados do Locatário', rightCol + 2, yPos + 5.5)

    yPos += 12
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(9)

    // Owner Info
    let yLeft = yPos
    doc.setFont('helvetica', 'bold')
    doc.text(ownerData.name || 'Empresa', leftCol, yLeft)
    yLeft += 4
    doc.setFont('helvetica', 'normal')
    doc.text(`Email: ${ownerData.email || 'N/A'}`, leftCol, yLeft)
    yLeft += 4
    doc.text(`Tel: ${formatPhone(ownerData.phone)}`, leftCol, yLeft)

    // Customer Info
    let yRight = yPos
    doc.setFont('helvetica', 'bold')
    doc.text(customer.name, rightCol, yRight)
    yRight += 4
    doc.setFont('helvetica', 'normal')
    doc.text(`Email: ${customer.email || 'N/A'}`, rightCol, yRight)
    yRight += 4
    doc.text(`Tel: ${formatPhone(customer.whatsapp)}`, rightCol, yRight)

    yPos = Math.max(yLeft, yRight) + 10

    // Content Section
    doc.setFillColor(secondary.r, secondary.g, secondary.b)
    doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Detalhamento do Orçamento', margin + 2, yPos + 5.5)

    yPos += 12
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(9)

    doc.setFont('helvetica', 'bold')
    doc.text('Itens', margin, yPos)
    doc.text('Prazo', pageWidth / 2, yPos)
    doc.text('Total Item', pageWidth - margin - 30, yPos)

    yPos += 6
    doc.setFont('helvetica', 'normal')

    items.forEach((item) => {
        const name = item.name || 'Item'
        const qty = item.quantity || 1
        const price = parseFloat(item.daily_price) || 0
        const itemTotal = price * diffDays * qty

        doc.text(`${qty}x ${name}`, margin, yPos)
        doc.text(`${diffDays} dias`, pageWidth / 2, yPos)
        doc.text(`R$ ${itemTotal.toFixed(2)}`, pageWidth - margin - 30, yPos)
        yPos += 5
    })

    yPos += 10

    // Dates Section
    doc.setFont('helvetica', 'bold')
    doc.text('Período Previsto:', margin, yPos)
    doc.setFont('helvetica', 'normal')
    doc.text(`${startDate.toLocaleDateString('pt-BR')} até ${endDate.toLocaleDateString('pt-BR')}`, margin + 35, yPos)

    if (rental.event_date) {
        yPos += 6
        doc.setFont('helvetica', 'bold')
        doc.text('Data do Evento:', margin, yPos)
        doc.setFont('helvetica', 'normal')
        const eventStart = new Date(rental.event_date + 'T00:00:00').toLocaleDateString('pt-BR')
        const eventEnd = rental.event_end_date ? new Date(rental.event_end_date + 'T00:00:00').toLocaleDateString('pt-BR') : eventStart
        const eventText = eventStart === eventEnd ? eventStart : `${eventStart} até ${eventEnd}`
        doc.text(eventText, margin + 35, yPos)
    }

    yPos += 15

    // Logistics & Address Section
    const isPickup = rental.delivery_type === 'pickup'
    const isCollection = rental.return_type === 'return' // return from customer point of view = "Cliente Devolve"

    doc.setFillColor(secondary.r, secondary.g, secondary.b)
    doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Logística e Localização', margin + 2, yPos + 5.5)

    yPos += 12
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(9)

    doc.setFont('helvetica', 'bold')
    doc.text('Logística:', margin, yPos)
    doc.setFont('helvetica', 'normal')
    const deliveryLabel = isPickup ? 'Cliente Retira no Local' : 'Empresa Entrega no Endereço'
    const returnLabel = isCollection ? 'Cliente Devolve no Local' : 'Empresa Coleta no Endereço'
    doc.text(`${deliveryLabel} / ${returnLabel}`, margin + 35, yPos)
    yPos += 6

    // Address Logic: If pickup, show owner address. If delivery, show event address.
    doc.setFont('helvetica', 'bold')
    doc.text('Local do Evento/Entrega:', margin, yPos)
    doc.setFont('helvetica', 'normal')

    let addressValue = ''
    if (isPickup) {
        addressValue = ownerData.fullAddress || 'Endereço da empresa não informado'
    } else if (rental.address_street) {
        addressValue = `${rental.address_street}, ${rental.address_number}${rental.address_complement ? ` (${rental.address_complement})` : ''}, ${rental.address_neighborhood}, ${rental.address_city}-${rental.address_state}`
    } else {
        addressValue = 'Endereço não informado'
    }

    const addressLines = doc.splitTextToSize(addressValue, pageWidth - 2 * margin - 45)
    doc.text(addressLines, margin + 45, yPos) // Adjusted margin for the longer label
    yPos += (addressLines.length * 4) + 6

    // Totals Section
    doc.setFillColor(secondary.r, secondary.g, secondary.b)
    doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Resumo Financeiro', margin + 2, yPos + 5.5)

    yPos += 12
    doc.setTextColor(0, 0, 0)
    doc.setFontSize(10)

    doc.setFont('helvetica', 'normal')
    doc.text('Subtotal:', margin, yPos)
    doc.text(`R$ ${subtotal.toFixed(2)}`, margin + 60, yPos)

    if (discountValue > 0) {
        yPos += 6
        doc.text(`Desconto (${discountType === 'percent' ? discount + '%' : 'Val.'}):`, margin, yPos)
        doc.text(`- R$ ${discountValue.toFixed(2)}`, margin + 60, yPos)
    }

    yPos += 6
    doc.text('Frete:', margin, yPos)
    doc.text(`R$ ${shippingCost.toFixed(2)}`, margin + 60, yPos)

    yPos += 8
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text('VALOR TOTAL:', margin, yPos)
    doc.text(`R$ ${finalValue.toFixed(2)}`, margin + 60, yPos)

    if (securityDeposit > 0) {
        yPos += 6
        doc.setFontSize(10)
        doc.text('Caução (Reembolsável):', margin, yPos)
        doc.setFont('helvetica', 'normal')
        doc.text(`+ R$ ${securityDeposit.toFixed(2)}`, margin + 60, yPos)
    }

    yPos += 10
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Condições de Pagamento:', margin, yPos)
    yPos += 5
    doc.setFont('helvetica', 'normal')
    doc.text(`Forma: ${paymentMethod}${installments > 1 ? ` (${installments}x)` : ''}`, margin, yPos)
    if (downPayment > 0) {
        yPos += 5
        doc.text(`Entrada antecipada: R$ ${downPayment.toFixed(2)}`, margin, yPos)
        yPos += 5
        doc.text(`Saldo a pagar: R$ ${(finalValue - downPayment).toFixed(2)}`, margin, yPos)
    }

    yPos += 20
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Orçamento gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR').slice(0, 5)}`, margin, yPos)
    yPos += 5
    doc.text('Este orçamento é válido por 5 dias corridos.', margin, yPos)

    return doc
}

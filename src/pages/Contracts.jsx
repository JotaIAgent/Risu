
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Save, FileText, Info, MessageSquare, Upload, FileSignature, Plus, Trash2, Clock } from 'lucide-react'
import { useDialog } from '../components/DialogProvider'
import PageTitle from '../components/PageTitle'
import { generateQuotePDF, generateContractPDF } from '../lib/pdfGenerator'

export default function Contracts() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(false)
    const { alert: dialogAlert, success, error: toastError } = useDialog()

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

    const [settings, setSettings] = useState({
        contract_template: '',
        pdf_message: '',
        signature_message: '',
        upload_message: '',
        global_auto_send: true,
        contract_logo_url: '',
        contract_primary_color: '#14b8a6',
        contract_secondary_color: '#0d9488',
        contract_pdf_template: {
            title: 'CONTRATO DE LOCAÇÃO DE EQUIPAMENTO',
            clauses: []
        },
        payment_alert_message: '',
        whatsapp_logistics_message: '',
        return_alert_message: '',
        collection_schedule: {
            reminder_days: [0, 5],
            daily_after_days: 10,
            daily_enabled: true
        },
    })

    useEffect(() => {
        if (user) fetchSettings()
    }, [user])

    async function fetchSettings() {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('user_settings')
                .select('contract_template, pdf_message, signature_message, upload_message, global_auto_send, contract_pdf_template, contract_logo_url, contract_primary_color, contract_secondary_color, payment_alert_message, return_alert_message, collection_schedule, whatsapp_logistics_message')
                .eq('user_id', user.id)
                .maybeSingle()

            if (data) {
                setSettings({
                    contract_template: data.contract_template || '',
                    pdf_message: data.pdf_message || '',
                    signature_message: data.signature_message || '',
                    upload_message: data.upload_message || '',
                    global_auto_send: data.global_auto_send !== false,
                    contract_logo_url: data.contract_logo_url || '',
                    contract_primary_color: data.contract_primary_color || '#14b8a6',
                    contract_secondary_color: data.contract_secondary_color || '#0d9488',
                    payment_alert_message: data.payment_alert_message || 'Olá {nome}, identificamos um pagamento pendente referente ao seu aluguel #{aluguel_id} no valor de R$ {valor_pendente}. Por favor, entre em contato para regularizar.',
                    return_alert_message: data.return_alert_message || 'Olá {nome}, lembramos que o prazo para devolução dos itens do aluguel #{aluguel_id} venceu no dia {data_devolucao}. Quando podemos realizar a coleta?',
                    collection_schedule: data.collection_schedule || {
                        reminder_days: [0, 5],
                        daily_after_days: 10,
                        daily_enabled: true
                    },
                    contract_pdf_template: data.contract_pdf_template || {
                        title: 'CONTRATO DE LOCAÇÃO DE EQUIPAMENTO',
                        clauses: [
                            'O LOCATÁRIO se compromete a devolver o equipamento nas mesmas condições em que o recebeu, no prazo estabelecido.',
                            'Qualquer dano causado ao equipamento será de responsabilidade do LOCATÁRIO.',
                            'O atraso na devolução acarretará em multa de 20% sobre o valor da diária por dia de atraso.',
                            'O LOCATÁRIO declara ter recebido o equipamento em perfeitas condições de uso.'
                        ]
                    },
                })
            }
        } catch (error) {
            console.error('Error fetching settings:', error)
        } finally {
            setLoading(false)
        }
    }

    async function handleSave(e) {
        e.preventDefault()
        try {
            setLoading(true)
            const updates = {
                user_id: user.id,
                contract_template: settings.contract_template,
                pdf_message: settings.pdf_message,
                signature_message: settings.signature_message,
                upload_message: settings.upload_message,
                global_auto_send: settings.global_auto_send,
                contract_pdf_template: settings.contract_pdf_template,
                contract_logo_url: settings.contract_logo_url,
                contract_primary_color: settings.contract_primary_color,
                contract_secondary_color: settings.contract_secondary_color,
                payment_alert_message: settings.payment_alert_message,
                whatsapp_logistics_message: settings.whatsapp_logistics_message,
                return_alert_message: settings.return_alert_message,
                collection_schedule: settings.collection_schedule
            }

            const { error: upsertError } = await supabase.from('user_settings').upsert(updates)

            if (upsertError) throw upsertError
            success('Modelos salvos com sucesso!')
        } catch (error) {
            console.error('Error saving settings:', error)
            toastError('Erro ao salvar modelos')
        } finally {
            setLoading(false)
        }
    }

    function addClause() {
        setSettings({
            ...settings,
            contract_pdf_template: {
                ...settings.contract_pdf_template,
                clauses: [...settings.contract_pdf_template.clauses, '']
            }
        })
    }

    function updateClause(index, value) {
        const newClauses = [...settings.contract_pdf_template.clauses]
        newClauses[index] = value
        setSettings({
            ...settings,
            contract_pdf_template: {
                ...settings.contract_pdf_template,
                clauses: newClauses
            }
        })
    }

    function removeClause(index) {
        const newClauses = settings.contract_pdf_template.clauses.filter((_, i) => i !== index)
        setSettings({
            ...settings,
            contract_pdf_template: {
                ...settings.contract_pdf_template,
                clauses: newClauses
            }
        })
    }


    async function handleLogoUpload(e) {
        const file = e.target.files[0]
        if (!file) return

        try {
            setLoading(true)

            // Upload to Supabase Storage
            const fileExt = file.name.split('.').pop()
            const fileName = `${user.id}-${Date.now()}.${fileExt}`
            const filePath = `logos/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('contract-logos')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('contract-logos')
                .getPublicUrl(filePath)

            setSettings({ ...settings, contract_logo_url: publicUrl })
            success('Logo enviada com sucesso!')
        } catch (error) {
            console.error('Error uploading logo:', error)
            toastError('Erro ao enviar logo: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    async function handleRemoveLogo() {
        if (!settings.contract_logo_url) return

        try {
            setLoading(true)

            // Extract file path from URL
            const urlParts = settings.contract_logo_url.split('/contract-logos/')
            if (urlParts.length > 1) {
                const filePath = urlParts[1]

                // Delete from storage
                const { error: deleteError } = await supabase.storage
                    .from('contract-logos')
                    .remove([`logos/${filePath}`])

                if (deleteError) {
                    console.error('Error deleting logo:', deleteError)
                }
            }

            // Clear from settings
            setSettings({ ...settings, contract_logo_url: '' })
            success('Logo removida com sucesso!')
        } catch (error) {
            console.error('Error removing logo:', error)
            toastError('Erro ao remover logo: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    async function handlePreviewPDF() {
        try {
            const { generateContractPDF } = await import('../lib/pdfGenerator')

            // Mock data for preview
            const mockRental = {
                start_date: '2024-01-01',
                end_date: '2024-01-05',
                id: 'preview',
                payment_method: 'PIX',
                discount: 10,
                discount_type: 'percent',
                down_payment: 50,
                installments: 3
            }

            const mockCustomer = {
                name: 'João José da Silva',
                whatsapp: '(23) 655-588552',
                cpf: '123.456.789-00'
            }

            const mockItems = [
                { name: 'Cadeira de Ferro', daily_price: 15.50, quantity: 4 },
                { name: 'Mesa de Madeira', daily_price: 45.00, quantity: 1 }
            ]

            // Fetch Company Data from tenant_settings (New Source of Truth)
            const { data: tenantSettings } = await supabase
                .from('tenant_settings')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle()

            const { data: legacySettings } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle()

            let addressString = ''
            if (tenantSettings?.address) {
                const { street, number, complement, neighborhood, city, state, cep } = tenantSettings.address
                if (street) {
                    addressString = `${street}, ${number}${complement ? ` (${complement})` : ''}, ${neighborhood}, ${city}-${state}, CEP: ${cep}`
                }
            }

            // Fallback
            if (!addressString && legacySettings?.owner_street) {
                addressString = `${legacySettings.owner_street}, ${legacySettings.owner_number}${legacySettings.owner_complement ? ` (${legacySettings.owner_complement})` : ''}, ${legacySettings.owner_neighborhood}, ${legacySettings.owner_city}-${legacySettings.owner_state}`
            }

            const mockOwner = {
                name: tenantSettings?.company_name || tenantSettings?.display_name || legacySettings?.owner_name || user.email.split('@')[0],
                email: tenantSettings?.finance_email || user.email,
                cpf_cnpj: tenantSettings?.cnpj_cpf || legacySettings?.owner_cpf_cnpj || '00.000.000/0001-00',
                phone: tenantSettings?.phone || legacySettings?.owner_phone || '(11) 99999-9999',
                fullAddress: addressString
            }

            const logoBase64 = settings.contract_logo_url ? await imageToBase64(settings.contract_logo_url) : null

            const pdf = generateContractPDF(
                mockRental,
                mockCustomer,
                mockItems,
                mockOwner,
                settings.contract_pdf_template,
                logoBase64,
                settings.contract_primary_color,
                settings.contract_secondary_color
            )

            // Open in new tab
            const pdfBlob = pdf.output('bloburl')
            window.open(pdfBlob, '_blank')
        } catch (error) {
            console.error('Error generating preview:', error)
            toastError('Erro ao gerar preview: ' + error.message)
        }
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <PageTitle title="Contratos" />
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Modelos e Configurações</h2>
            </div>

            <form onSubmit={handleSave} className="space-y-8">


                {/* Visual Customization */}
                <div className="app-card overflow-hidden">
                    <div className="p-6 border-b border-border-light dark:border-border-dark flex items-center gap-2">
                        <FileText size={20} className="text-primary" />
                        <h3 className="font-bold text-lg">Personalização Visual do PDF</h3>
                    </div>

                    <div className="p-6 space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                            <div className="space-y-4">
                                <label className="app-label">Logo da Empresa (opcional)</label>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleLogoUpload}
                                            className="hidden"
                                            id="logo-upload"
                                            disabled={loading}
                                        />
                                        <label
                                            htmlFor="logo-upload"
                                            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-border-light dark:border-border-dark rounded-xl cursor-pointer hover:border-primary hover:bg-primary/5 transition-all text-sm font-bold opacity-70 hover:opacity-100"
                                        >
                                            <Upload size={18} />
                                            {settings.contract_logo_url ? 'Alterar Logo' : 'Escolher Logo'}
                                        </label>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-border-light dark:border-border-dark">
                                            <input
                                                type="color"
                                                value={settings.contract_primary_color}
                                                onChange={e => setSettings({ ...settings, contract_primary_color: e.target.value })}
                                                className="w-12 h-12 rounded-lg cursor-pointer border-0 p-0 overflow-hidden flex-shrink-0 shadow-sm"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light block mb-1">Cor Primária</label>
                                                <input
                                                    type="text"
                                                    value={settings.contract_primary_color}
                                                    onChange={e => setSettings({ ...settings, contract_primary_color: e.target.value })}
                                                    className="w-full px-2 py-1 rounded border border-border-light dark:border-border-dark bg-white dark:bg-slate-900 text-[10px] font-mono uppercase"
                                                />
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-border-light dark:border-border-dark">
                                            <input
                                                type="color"
                                                value={settings.contract_secondary_color}
                                                onChange={e => setSettings({ ...settings, contract_secondary_color: e.target.value })}
                                                className="w-12 h-12 rounded-lg cursor-pointer border-0 p-0 overflow-hidden flex-shrink-0 shadow-sm"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light block mb-1">Cor Secundária</label>
                                                <input
                                                    type="text"
                                                    value={settings.contract_secondary_color}
                                                    onChange={e => setSettings({ ...settings, contract_secondary_color: e.target.value })}
                                                    className="w-full px-2 py-1 rounded border border-border-light dark:border-border-dark bg-white dark:bg-slate-900 text-[10px] font-mono uppercase"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="app-label">Pré-visualização da Logo</label>
                                {settings.contract_logo_url ? (
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-full h-32 bg-slate-50 dark:bg-slate-900/50 border border-border-light dark:border-border-dark rounded-xl flex items-center justify-center overflow-hidden">
                                            <img
                                                src={settings.contract_logo_url}
                                                alt="Logo preview"
                                                key={settings.contract_logo_url} // Force re-render on URL change
                                                className="w-full h-full object-contain p-2"
                                                onError={(e) => {
                                                    console.error("Logo failed to load:", settings.contract_logo_url);
                                                    e.target.style.display = 'none';
                                                }}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleRemoveLogo}
                                            className="text-xs text-danger font-bold hover:underline flex items-center gap-1"
                                            disabled={loading}
                                        >
                                            <Trash2 size={12} />
                                            Remover Logo
                                        </button>
                                    </div>
                                ) : (
                                    <div className="w-full h-32 bg-slate-50 dark:bg-slate-900/50 border border-dashed border-border-light dark:border-border-dark rounded-xl flex items-center justify-center text-[10px] font-black text-text-secondary-light uppercase tracking-widest opacity-40">
                                        Nenhuma Logo Selecionada
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                </div>

                {/* PDF Template Editor */}
                <div className="app-card overflow-hidden">
                    <div className="p-6 border-b border-border-light dark:border-border-dark flex items-center gap-2">
                        <FileText size={20} className="text-secondary" />
                        <h3 className="font-bold text-lg">Conteúdo do Contrato (PDF)</h3>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="space-y-2">
                            <label className="app-label">Título do Documento</label>
                            <input
                                type="text"
                                className="app-input"
                                value={settings.contract_pdf_template.title}
                                onChange={e => setSettings({
                                    ...settings,
                                    contract_pdf_template: {
                                        ...settings.contract_pdf_template,
                                        title: e.target.value
                                    }
                                })}
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="app-label">Cláusulas e Termos</label>
                                <button
                                    type="button"
                                    onClick={addClause}
                                    className="px-3 py-1.5 bg-secondary/10 text-secondary hover:bg-secondary/20 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors"
                                >
                                    <Plus size={16} />
                                    Adicionar Cláusula
                                </button>
                            </div>

                            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                {settings.contract_pdf_template.clauses.map((clause, index) => (
                                    <div key={index} className="flex gap-4 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-border-light dark:border-border-dark group">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-bold">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <textarea
                                                className="app-input min-h-[80px]"
                                                rows={2}
                                                value={clause}
                                                onChange={e => updateClause(index, e.target.value)}
                                                placeholder={`Descreva a cláusula ${index + 1}...`}
                                            />
                                            <div className="flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => removeClause(index)}
                                                    className="text-xs text-danger font-bold flex items-center gap-1 hover:underline opacity-60 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Trash2 size={12} />
                                                    Remover Cláusula
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>


                {/* Variable Cheat Sheet */}
                <div className="p-6 bg-primary/5 dark:bg-primary/10 rounded-2xl border border-primary/10 dark:border-primary/20 backdrop-blur-sm">
                    <div className="flex items-center gap-2 font-black text-[10px] uppercase tracking-[0.2em] text-primary mb-5">
                        <Info size={14} className="animate-pulse" /> Variáveis Dinâmicas Disponíveis
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                        {[
                            { tag: '{cliente}', label: 'Nome' },
                            { tag: '{item}', label: 'Itens' },
                            { tag: '{resumo}', label: 'Resumo' },
                            { tag: '{inicio}', label: 'Início' },
                            { tag: '{fim}', label: 'Fim' },
                            { tag: '{total}', label: 'Valor' },
                            { tag: '{frete}', label: 'Frete' },
                            { tag: '{dias}', label: 'Prazo' },
                            { tag: '{upload_link}', label: 'Link' },
                        ].map(v => (
                            <div key={v.tag} className="flex flex-col bg-white dark:bg-slate-900 p-3 rounded-xl border border-primary/5 shadow-sm">
                                <code className="text-xs font-black text-primary mb-1">{v.tag}</code>
                                <span className="text-[9px] uppercase font-black text-text-secondary-light/60 tracking-wider leading-none">
                                    {v.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 pt-4 border-t border-border-light dark:border-border-dark">
                    <button
                        type="button"
                        onClick={handlePreviewPDF}
                        className="flex-1 py-4 flex items-center justify-center gap-2 border border-border-light dark:border-border-dark bg-surface-light dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl font-bold transition-all"
                    >
                        <FileSignature size={20} className="text-primary" />
                        Visualizar Contrato
                    </button>

                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 py-4 flex items-center justify-center gap-2 bg-primary hover:bg-primary-hover text-white rounded-xl font-bold shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
                    >
                        <Save size={20} />
                        {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </form >
        </div >
    )
}

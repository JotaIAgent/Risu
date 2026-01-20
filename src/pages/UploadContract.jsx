
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Upload, CheckCircle, FileText } from 'lucide-react'
import { useDialog } from '../components/DialogProvider'

export default function UploadContract() {
    const { rentalId } = useParams()
    const [uploading, setUploading] = useState(false)
    const [uploaded, setUploaded] = useState(false)
    const [file, setFile] = useState(null)
    const { alert: dialogAlert, success, error: toastError } = useDialog()

    async function handleUpload(e) {
        e.preventDefault()
        if (!file) {
            toastError('Por favor, selecione um arquivo')
            return
        }

        try {
            setUploading(true)

            // Upload to Supabase Storage
            const fileExt = file.name.split('.').pop()
            const fileName = `${rentalId}-${Date.now()}.${fileExt}`
            const filePath = `contracts/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('rental-contracts')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
                .from('rental-contracts')
                .getPublicUrl(filePath)

            // Update rental record
            const { error: updateError } = await supabase
                .from('rentals')
                .update({
                    signed_contract_url: publicUrl,
                    contract_status: 'signed'
                })
                .eq('id', rentalId)

            if (updateError) throw updateError

            setUploaded(true)
        } catch (error) {
            console.error('Error uploading:', error)
            toastError('Erro ao enviar arquivo: ' + error.message)
        } finally {
            setUploading(false)
        }
    }

    if (uploaded) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors duration-500 font-sans">
                <div className="app-card max-w-md w-full p-10 text-center space-y-6 shadow-2xl shadow-secondary/5 border-t-4 border-t-secondary animate-in fade-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-secondary/10 rounded-full flex items-center justify-center mx-auto text-secondary">
                        <CheckCircle size={48} />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-3xl font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-tight">
                            Sucesso!
                        </h2>
                        <p className="text-text-secondary-light dark:text-text-secondary-dark font-medium leading-relaxed">
                            O contrato assinado foi recebido. O administrador já pode prosseguir com a locação.
                        </p>
                    </div>
                    <div className="pt-4">
                        <p className="text-[10px] font-black uppercase text-text-secondary-light/40 tracking-[0.3em]">
                            Antigravity Gestão Digital
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors duration-500 font-sans">
            <div className="app-card max-w-md w-full p-8 md:p-10 space-y-8 shadow-2xl shadow-primary/5">
                <div className="text-center space-y-3">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto text-primary mb-2">
                        <FileText size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-text-primary-light dark:text-text-primary-dark uppercase tracking-tight">
                        Enviar Assinatura
                    </h2>
                    <p className="text-sm text-text-secondary-light dark:text-text-secondary-dark font-medium leading-tight">
                        Selecione o arquivo PDF do contrato devidamente assinado.
                    </p>
                </div>

                <form onSubmit={handleUpload} className="space-y-6">
                    <div className="space-y-4">
                        <div className={`relative group border-2 border-dashed rounded-2xl p-8 transition-all flex flex-col items-center justify-center text-center ${file ? 'border-secondary/50 bg-secondary/5' : 'border-border-light dark:border-border-dark hover:border-primary/50 bg-slate-50/50 dark:bg-slate-900/30'}`}>
                            <input
                                type="file"
                                accept=".pdf"
                                onChange={e => setFile(e.target.files[0])}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                required
                            />

                            <div className={`p-4 rounded-full mb-3 ${file ? 'bg-secondary/20 text-secondary' : 'bg-white dark:bg-slate-800 text-text-secondary-light dark:text-text-secondary-dark shadow-sm'}`}>
                                <Upload size={24} />
                            </div>

                            {file ? (
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-secondary truncate max-w-[200px]">{file.name}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-secondary/60">Arquivo Selecionado</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <p className="text-sm font-bold text-text-primary-light dark:text-text-primary-dark">Toque para selecionar</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-text-secondary-light/60">Apenas arquivos PDF</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-primary hover:bg-primary-hover text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-primary/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        disabled={uploading || !file}
                    >
                        {uploading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                <span>Enviando...</span>
                            </>
                        ) : (
                            <>
                                <Upload size={18} />
                                <span>Finalizar Envio</span>
                            </>
                        )}
                    </button>
                </form>

                <p className="text-center text-[10px] font-bold text-text-secondary-light/40 uppercase tracking-widest pt-4">
                    Documento seguro via SSL/TSL
                </p>
            </div>
        </div>
    )
}

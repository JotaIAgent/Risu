import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function ConfirmEmail() {
    const location = useLocation()
    const email = location.state?.email || ''
    const [resending, setResending] = useState(false)
    const [resendSuccess, setResendSuccess] = useState(false)
    const [resendError, setResendError] = useState(null)

    const handleResendEmail = async () => {
        if (!email) {
            setResendError('Email não encontrado. Por favor, tente se cadastrar novamente.')
            return
        }

        setResending(true)
        setResendError(null)
        setResendSuccess(false)

        try {
            const { error } = await supabase.auth.resend({
                type: 'signup',
                email: email,
            })

            if (error) throw error

            setResendSuccess(true)
        } catch (err) {
            console.error('Resend error:', err)
            setResendError('Erro ao reenviar. Aguarde alguns minutos e tente novamente.')
        } finally {
            setResending(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-[#0a1118] transition-colors duration-500">
            <div className="w-full max-w-md text-center">
                <div className="bg-white dark:bg-[#13283b] rounded-[3rem] p-12 shadow-2xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800">
                    {/* Icon */}
                    <div className="w-24 h-24 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-8">
                        <Mail size={40} className="text-green-500" />
                    </div>

                    {/* Title */}
                    <h1 className="text-2xl font-black text-[#13283b] dark:text-white uppercase tracking-tighter mb-4">
                        Verifique seu Email
                    </h1>

                    {/* Email Display */}
                    {email && (
                        <p className="text-sm font-bold text-secondary bg-secondary/10 inline-block px-4 py-2 rounded-xl mb-6">
                            {email}
                        </p>
                    )}

                    {/* Description */}
                    <p className="text-slate-500 dark:text-slate-400 font-medium mb-8 leading-relaxed">
                        Enviamos um link de confirmação para o seu email.
                        <br />
                        <strong className="text-[#13283b] dark:text-white">Clique no link</strong> para ativar sua conta.
                    </p>

                    {/* Success/Error Messages */}
                    {resendSuccess && (
                        <div className="bg-green-50 text-green-600 p-4 rounded-2xl mb-6 text-sm font-bold flex items-center gap-2 justify-center">
                            <CheckCircle2 size={18} />
                            Email reenviado com sucesso!
                        </div>
                    )}
                    {resendError && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-2xl mb-6 text-sm font-bold flex items-center gap-2 justify-center">
                            <AlertCircle size={18} />
                            {resendError}
                        </div>
                    )}

                    {/* Tips */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 mb-8 text-left space-y-3">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                Verifique sua caixa de entrada
                            </span>
                        </div>
                        <div className="flex items-start gap-3">
                            <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                Confira a pasta de Spam ou Promoções
                            </span>
                        </div>
                        <div className="flex items-start gap-3">
                            <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                O link expira em 24 horas
                            </span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-4">
                        {/* Resend Button */}
                        <button
                            onClick={handleResendEmail}
                            disabled={resending || !email}
                            className="w-full bg-secondary/10 text-secondary py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-secondary hover:text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {resending ? (
                                <>
                                    <RefreshCw size={16} className="animate-spin" />
                                    Reenviando...
                                </>
                            ) : (
                                <>
                                    <RefreshCw size={16} />
                                    Reenviar Email
                                </>
                            )}
                        </button>

                        <Link
                            to="/login"
                            className="block w-full bg-[#13283b] dark:bg-white dark:text-[#13283b] text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg hover:scale-[1.02] transition-all"
                        >
                            Ir para o Login
                        </Link>
                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400 hover:text-[#13283b] dark:hover:text-white transition-colors"
                        >
                            <ArrowLeft size={14} />
                            Voltar ao Início
                        </Link>
                    </div>
                </div>

                {/* Footer */}
                <p className="mt-8 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300 dark:text-slate-600">
                    Se o problema persistir, entre em contato com o suporte.
                </p>
            </div>
        </div>
    )
}

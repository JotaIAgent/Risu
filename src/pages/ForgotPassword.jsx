
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail, CheckCircle2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { translateAuthError } from '../lib/auth-translations'

export default function ForgotPassword() {
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)

    const handleResetRequest = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        setSuccess(false)

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
            })

            if (error) throw error
            setSuccess(true)
        } catch (err) {
            setError(translateAuthError(err.message))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
            <div className="w-full max-w-md">
                <Link to="/login" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#13283b] dark:text-white mb-8 hover:opacity-70 transition-opacity">
                    <ArrowLeft size={16} />
                    Voltar para o Login
                </Link>

                <div className="space-y-8">
                    <div className="text-center space-y-2">
                        <div className="inline-block p-4 bg-primary/10 rounded-3xl mb-4">
                            <Mail className="w-12 h-12 text-primary" />
                        </div>
                        <h2 className="text-4xl font-black tracking-tight text-text-primary-light dark:text-text-primary-dark uppercase">Recuperar</h2>
                        <p className="text-text-secondary-light dark:text-text-secondary-dark font-medium">Enviaremos um link de acesso para o seu email.</p>
                    </div>

                    <div className="app-card p-8 md:p-10 shadow-2xl shadow-primary/5">
                        {error && (
                            <div className="bg-danger/10 border border-danger/20 text-danger p-4 rounded-2xl mb-6 text-sm font-bold flex items-center gap-3 animate-shake">
                                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        {success ? (
                            <div className="space-y-6 text-center py-4">
                                <div className="bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 p-6 rounded-2xl">
                                    <CheckCircle2 size={48} className="mx-auto mb-4" />
                                    <h3 className="text-lg font-bold mb-2">Email Enviado!</h3>
                                    <p className="text-sm font-medium opacity-80">
                                        Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
                                    </p>
                                </div>
                                <Link
                                    to="/login"
                                    className="block w-full bg-primary hover:bg-primary-hover text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-primary/30 transition-all"
                                >
                                    Voltar ao Login
                                </Link>
                            </div>
                        ) : (
                            <form onSubmit={handleResetRequest} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="app-label" htmlFor="email">Email Cadastrado</label>
                                    <input
                                        id="email"
                                        type="email"
                                        className="app-input"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="seu-email@exemplo.com"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-primary hover:bg-primary-hover text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-primary/30 transition-all disabled:opacity-50"
                                    disabled={loading}
                                >
                                    {loading ? 'Processando...' : 'Enviar Link de Recuperação'}
                                </button>
                            </form>
                        )}
                    </div>

                    <p className="text-center text-[10px] uppercase font-black tracking-[0.2em] text-text-secondary-light/40 py-8">
                        &copy; 2025 Antigravity Gestão Profissional
                    </p>
                </div>
            </div>
        </div>
    )
}

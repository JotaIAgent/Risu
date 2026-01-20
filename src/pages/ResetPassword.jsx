
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, AlertCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { translateAuthError } from '../lib/auth-translations'

export default function ResetPassword() {
    const [loading, setLoading] = useState(false)
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)
    const navigate = useNavigate()

    const handleResetPassword = async (e) => {
        e.preventDefault()

        if (password !== confirmPassword) {
            setError('As senhas não coincidem.')
            return
        }

        if (password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            })

            if (error) throw error
            setSuccess(true)

            // Redirect after a short delay
            setTimeout(() => {
                navigate('/login')
            }, 3000)
        } catch (err) {
            setError(translateAuthError(err.message))
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
            <div className="w-full max-w-md">
                <div className="space-y-8">
                    <div className="text-center space-y-2">
                        <div className="inline-block p-4 bg-primary/10 rounded-3xl mb-4">
                            <Lock className="w-12 h-12 text-primary" />
                        </div>
                        <h2 className="text-4xl font-black tracking-tight text-text-primary-light dark:text-text-primary-dark uppercase">Nova Senha</h2>
                        <p className="text-text-secondary-light dark:text-text-secondary-dark font-medium">Defina sua nova senha de acesso.</p>
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
                                    <h3 className="text-lg font-bold mb-2">Senha Redefinida!</h3>
                                    <p className="text-sm font-medium opacity-80">
                                        Sua senha foi atualizada com sucesso. Você será redirecionado para o login em instantes.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleResetPassword} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="app-label" htmlFor="password">Nova Senha</label>
                                    <input
                                        id="password"
                                        type="password"
                                        className="app-input"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="app-label" htmlFor="confirmPassword">Confirmar Nova Senha</label>
                                    <input
                                        id="confirmPassword"
                                        type="password"
                                        className="app-input"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        placeholder="••••••••"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-primary hover:bg-primary-hover text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-primary/30 transition-all disabled:opacity-50"
                                    disabled={loading}
                                >
                                    {loading ? 'Redefinindo...' : 'Atualizar Senha'}
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

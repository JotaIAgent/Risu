
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { translateAuthError } from '../lib/auth-translations'

export default function Login() {
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState(null)
    const navigate = useNavigate()

    const handleLogin = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        })

        if (error) {
            setError(translateAuthError(error.message))
            setLoading(false)
        } else {
            navigate('/')
        }
    }



    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 transition-colors duration-500">
            <div className="w-full max-w-md">
                <Link to="/" className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#13283b] dark:text-white mb-8 hover:opacity-70 transition-opacity">
                    <ArrowLeft size={16} />
                    Voltar para o Início
                </Link>

                <div className="space-y-8">
                    <div className="text-center space-y-2">
                        <div className="inline-block p-4 bg-primary/10 rounded-3xl mb-4">
                            <svg className="w-12 h-12 text-primary" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M7 14L2 9L7 4" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M2 9H12C16.4183 9 20 12.5817 20 17V20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                        <h2 className="text-4xl font-black tracking-tight text-text-primary-light dark:text-text-primary-dark uppercase">Acesso</h2>
                        <p className="text-text-secondary-light dark:text-text-secondary-dark font-medium">Bem-vindo ao Risu.</p>
                    </div>

                    <div className="app-card p-8 md:p-10 shadow-2xl shadow-primary/5">
                        {error && (
                            <div className="bg-danger/10 border border-danger/20 text-danger p-4 rounded-2xl mb-6 text-sm font-bold flex items-center gap-3 animate-shake">
                                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {error}
                            </div>
                        )}


                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-2">
                                <label className="app-label" htmlFor="email">Email Corporativo</label>
                                <input
                                    id="email"
                                    type="email"
                                    className="app-input"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="nome@empresa.com"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <label className="app-label" htmlFor="password">Senha de Acesso</label>
                                    <Link
                                        to="/forgot-password"
                                        className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline decoration-2 underline-offset-4"
                                    >
                                        Esqueci minha senha
                                    </Link>
                                </div>
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

                            <button
                                type="submit"
                                className="w-full bg-primary hover:bg-primary-hover text-white py-4 rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-primary/30 transition-all disabled:opacity-50"
                                disabled={loading}
                            >
                                {loading ? 'Validando...' : 'Entrar no Sistema'}
                            </button>
                        </form>

                        <div className="mt-8 pt-8 border-t border-border-light dark:border-border-dark text-center">
                            <p className="text-sm font-medium text-text-secondary-light dark:text-text-secondary-dark leading-loose">
                                Novo por aqui?{' '}
                                <Link to="/signup" className="text-primary font-black uppercase tracking-widest hover:underline decoration-2 underline-offset-4">
                                    Criar Conta
                                </Link>
                            </p>
                        </div>
                    </div>

                    <p className="text-center text-[10px] uppercase font-black tracking-[0.2em] text-text-secondary-light/40 py-8">
                        &copy; {new Date().getFullYear()} Risu. Todos os direitos reservados.
                    </p>
                </div>
            </div>
        </div>
    )
}

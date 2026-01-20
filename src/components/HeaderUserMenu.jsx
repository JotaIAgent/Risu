import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, LogOut, LayoutDashboard, CreditCard, Settings, ChevronDown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function HeaderUserMenu() {
    const { user, signOut, subscriptionStatus } = useAuth()
    const navigate = useNavigate()
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef(null)

    // Check if user has access to dashboard
    const hasActiveSubscription = subscriptionStatus === 'active' || subscriptionStatus === 'trialing'

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const handleLogout = async () => {
        await signOut()
        navigate('/login')
    }

    if (!user) return null

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all group"
            >
                <div className="w-8 h-8 rounded-full bg-[#13283b] text-white flex items-center justify-center text-xs font-black">
                    {user.user_metadata?.full_name?.charAt(0) || <User size={14} />}
                </div>
                <div className="hidden md:block text-left mr-2">
                    <p className="text-[10px] uppercase font-black tracking-widest text-[#13283b] leading-tight">
                        {user.user_metadata?.full_name?.split(' ')[0]}
                    </p>
                </div>
                <ChevronDown size={14} className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 py-1 z-50">
                    <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50">
                        <p className="text-xs font-bold text-[#13283b] truncate">
                            {user.user_metadata?.full_name || 'Usuário'}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate font-medium">
                            {user.email}
                        </p>
                    </div>

                    <div className="p-1">
                        {/* Dashboard button - only shows if subscription is active */}
                        {hasActiveSubscription ? (
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-600 hover:text-[#13283b] hover:bg-slate-50 rounded-xl transition-colors text-left"
                            >
                                <LayoutDashboard size={14} />
                                Acessar Dashboard
                            </button>
                        ) : (
                            <button
                                onClick={() => navigate('/pricing')}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-secondary hover:bg-secondary/10 rounded-xl transition-colors text-left"
                            >
                                <CreditCard size={14} />
                                Ativar Assinatura
                            </button>
                        )}

                        <button
                            onClick={() => navigate('/account')}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-slate-600 hover:text-[#13283b] hover:bg-slate-50 rounded-xl transition-colors text-left"
                        >
                            <Settings size={14} />
                            Minha Conta
                        </button>

                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-3 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors text-left mt-1"
                        >
                            <LogOut size={14} />
                            Sair da Conta
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}

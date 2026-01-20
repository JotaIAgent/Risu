
import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Package, Users, Calendar, LogOut, MessageCircle, FileText, UserCircle, CalendarDays, ClipboardList, Truck, DollarSign, BarChart3, LifeBuoy, Settings, Rocket } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export function Sidebar() {
    const { signOut } = useAuth()

    const navItems = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/calendar', icon: CalendarDays, label: 'Agenda' },
        { to: '/rentals', icon: Calendar, label: 'Locações' },
        { to: '/logistics', icon: Truck, label: 'Logística' },
        { to: '/inventory', icon: Package, label: 'Estoque' },
        { to: '/customers', icon: Users, label: 'Clientes' },
        { to: '/finance', icon: DollarSign, label: 'Financeiro' },
        { to: '/quotes', icon: ClipboardList, label: 'Orçamentos' },
        { to: '/whatsapp', icon: MessageCircle, label: 'WhatsApp' },
        { to: '/reports', icon: BarChart3, label: 'Relatórios' },
        { to: '/support', icon: LifeBuoy, label: 'Ajuda & Suporte' },
        { to: '/contracts', icon: FileText, label: 'Contratos' },
    ]

    return (
        <aside className="w-64 flex flex-col bg-surface-light dark:bg-surface-dark border-r border-border-light dark:border-border-dark hidden md:flex transition-colors duration-300 z-20">
            <div className="h-20 flex items-center justify-center border-b border-border-light dark:border-border-dark px-6">
                <span className="text-2xl font-bold text-primary tracking-tight">Gestão<span className="text-text-primary-light dark:text-white">Rental</span></span>
            </div>

            <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) => `
                            flex items-center px-4 py-3 rounded-xl font-medium transition-colors group
                            ${isActive
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-primary'
                                : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-50 dark:hover:bg-slate-800'
                            }
                        `}
                    >
                        <item.icon size={20} className="mr-3 group-hover:text-primary transition-colors" />
                        {item.label}
                    </NavLink>
                ))}
            </nav>

            <div className="p-4 border-t border-border-light dark:border-border-dark space-y-1">
                <NavLink
                    to="/guide"
                    className={({ isActive }) => `
                        flex items-center px-4 py-3 rounded-xl font-medium transition-colors group
                        ${isActive
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-primary'
                            : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-50 dark:hover:bg-slate-800'
                        }
                    `}
                >
                    <Rocket size={20} className="mr-3 group-hover:text-primary transition-colors" />
                    Guia do Usuário
                </NavLink>
                <NavLink
                    to="/settings"
                    className={({ isActive }) => `
                        flex items-center px-4 py-3 rounded-xl font-medium transition-colors group
                        ${isActive
                            ? 'bg-blue-50 dark:bg-blue-900/20 text-primary'
                            : 'text-text-secondary-light dark:text-text-secondary-dark hover:bg-gray-50 dark:hover:bg-slate-800'
                        }
                    `}
                >
                    <Settings size={20} className="mr-3 group-hover:text-primary transition-colors" />
                    Configurações
                </NavLink>
                <button
                    onClick={signOut}
                    className="flex items-center w-full px-4 py-3 text-danger hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl font-medium transition-colors"
                >
                    <LogOut size={20} className="mr-3" />
                    Sair
                </button>
            </div>
        </aside>
    )
}

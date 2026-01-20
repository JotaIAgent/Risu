import { Sidebar } from './Sidebar'
import { Outlet } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { Sun, Moon, Menu, ChevronDown } from 'lucide-react'
import { LanguageSwitcher } from './LanguageSwitcher'

export function Layout() {
    const { theme, toggleTheme } = useTheme()

    return (
        <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark text-text-primary-light dark:text-text-primary-dark transition-colors duration-300">
            <Sidebar />

            <main className="flex-1 flex flex-col h-full overflow-hidden relative">
                <header className="h-20 bg-surface-light dark:bg-surface-dark border-b border-border-light dark:border-border-dark flex items-center justify-between px-8 z-10 transition-colors duration-300">
                    <div className="flex items-center md:hidden">
                        <button className="text-text-secondary-light dark:text-text-secondary-dark hover:text-primary focus:outline-none">
                            <Menu size={24} />
                        </button>
                        <span className="ml-4 text-xl font-bold text-primary">Gestão</span>
                    </div>

                    <h1 className="text-2xl font-bold hidden md:block">Sistema de Gestão</h1>

                    <div className="flex items-center gap-4">
                        <button
                            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 text-text-secondary-light dark:text-text-secondary-dark transition-colors"
                            onClick={toggleTheme}
                            title={theme === 'dark' ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
                        >
                            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                        </button>

                        <LanguageSwitcher />
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 md:p-8">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                    <div className="h-8"></div>
                </div>
            </main>
        </div>
    )
}

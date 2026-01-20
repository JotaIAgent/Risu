import { useEffect, useState } from 'react'
import { Globe } from 'lucide-react'

export function LanguageSwitcher() {
    const [currentLanguage, setCurrentLanguage] = useState('pt')
    const [isOpen, setIsOpen] = useState(false)

    useEffect(() => {
        // 1. Evitar reinicialização duplicada
        if (window.googleTranslateScriptLoaded) return

        window.googleTranslateScriptLoaded = true

        const addScript = document.createElement('script')
        addScript.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit'
        addScript.async = true
        document.body.appendChild(addScript)

        window.googleTranslateElementInit = () => {
            if (window.google?.translate?.TranslateElement) {
                new window.google.translate.TranslateElement(
                    {
                        pageLanguage: 'pt',
                        includedLanguages: 'pt,en,es',
                        autoDisplay: false
                    },
                    'google_translate_element'
                )
            }
        }
    }, [])

    const handleLanguageChange = (langCode) => {
        setIsOpen(false)
        setCurrentLanguage(langCode)

        // Mágica do Google Translate: Setar cookie e forçar reload se necessário ou alterar combo
        // A forma mais estável sem refresh é tentar alterar o combo

        const tryChange = () => {
            const select = document.querySelector('.goog-te-combo')
            if (select) {
                select.value = langCode
                select.dispatchEvent(new Event('change'))
            }
        }

        // Tenta imediatamente e também com pequenos delays caso o elemento esteja carregando
        tryChange()
        setTimeout(tryChange, 500)
    }

    const languages = [
        { code: 'pt', label: 'Português', flag: '🇧🇷' },
        { code: 'en', label: 'English', flag: '🇺🇸' },
        { code: 'es', label: 'Español', flag: '🇪🇸' }
    ]

    return (
        <div className="relative">
            {/* Elemento oficial do Google (escondido) */}
            <div id="google_translate_element" style={{ display: 'none' }} />

            <button
                onClick={() => setIsOpen(!isOpen)}
                className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-primary transition-all shadow-sm border border-border-light dark:border-border-dark"
                title="Mudar idioma"
            >
                <Globe size={20} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-12 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-border-light dark:border-border-dark py-2 z-50 animate-fade-in-down">
                    {languages.map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => handleLanguageChange(lang.code)}
                            className={`w-full text-left px-4 py-3 text-sm flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors
                                ${currentLanguage === lang.code ? 'font-bold text-primary bg-blue-50/50 dark:bg-blue-900/10' : 'text-text-primary-light dark:text-text-primary-dark'}
                            `}
                        >
                            <span className="text-lg">{lang.flag}</span>
                            <span>{lang.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

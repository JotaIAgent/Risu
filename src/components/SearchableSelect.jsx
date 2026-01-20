
import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

export default function SearchableSelect({
    options = [],
    value,
    onChange,
    placeholder = "Selecione...",
    label,
    displayFn, // Optional function to render option text: (option) => string
    required = false,
    className = ""
}) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')
    const wrapperRef = useRef(null)

    // Close when clicking outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    // Derived state
    const selectedOption = options.find(o => o.id === value)

    const filteredOptions = options.filter(option => {
        const text = displayFn ? displayFn(option) : (option.name || option.label || '')
        return text.toLowerCase().includes(search.toLowerCase())
    })

    const handleSelect = (option) => {
        onChange(option.id)
        setIsOpen(false)
        setSearch('')
    }

    const getDisplayLabel = (option) => {
        if (!option) return ''
        return displayFn ? displayFn(option) : (option.name || option.label || '')
    }

    return (
        <div className={`relative ${className}`} ref={wrapperRef}>
            {label && <label className="app-label block mb-2">{label} {required && '*'}</label>}

            <div
                className={`app-input flex items-center justify-between cursor-pointer ${!selectedOption && 'text-text-secondary-light'}`}
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate">
                    {selectedOption ? getDisplayLabel(selectedOption) : placeholder}
                </span>
                <ChevronDown size={16} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-border-light dark:border-border-dark rounded-xl shadow-xl max-h-60 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="p-2 border-b border-border-light dark:border-border-dark bg-slate-50 dark:bg-slate-900/50 sticky top-0">
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary-light" />
                            <input
                                type="text"
                                autoFocus
                                className="w-full pl-9 pr-3 py-1.5 text-sm bg-white dark:bg-slate-800 border border-border-light dark:border-border-dark rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                                placeholder="Pesquisar..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                            />
                        </div>
                    </div>

                    <div className="overflow-y-auto flex-1 p-1">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(option => (
                                <div
                                    key={option.id}
                                    className={`px-3 py-2 rounded-lg text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${option.id === value ? 'bg-primary/10 text-primary font-bold' : 'text-text-primary-light dark:text-text-primary-dark'}`}
                                    onClick={() => handleSelect(option)}
                                >
                                    {getDisplayLabel(option)}
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center text-xs text-text-secondary-light italic">
                                Nenhum resultado encontrado.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

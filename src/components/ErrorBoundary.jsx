
import React from 'react'

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = { hasError: false, error: null, errorInfo: null }
    }

    static getDerivedStateFromError(error) {
        return { hasError: true }
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo })
        console.error("Critical Runtime Error:", error, errorInfo)
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-[#13283b] text-white p-12 font-sans flex items-center justify-center">
                    <div className="max-w-2xl w-full bg-red-500/10 border border-red-500/20 p-8 rounded-3xl backdrop-blur-xl">
                        <h1 className="text-2xl font-black uppercase tracking-tighter mb-4 flex items-center gap-3">
                            <span className="bg-red-500 text-white px-2 py-0.5 rounded text-sm">FATAL ERROR</span>
                            Runtime Crash Detected
                        </h1>
                        <p className="text-slate-300 mb-6 font-medium">
                            Ocorreu um erro crítico que impediu a renderização da interface.
                            Por favor, informe ao desenvolvedor os detalhes abaixo:
                        </p>
                        <div className="bg-black/40 p-6 rounded-2xl overflow-auto max-h-[400px] border border-white/5">
                            <pre className="text-red-400 text-xs font-mono whitespace-pre-wrap leading-relaxed">
                                {this.state.error?.toString()}
                                {"\n\nComponent Stack:\n"}
                                {this.state.errorInfo?.componentStack}
                            </pre>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-8 bg-white text-[#13283b] px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-white/5"
                        >
                            Forçar Recarregamento
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

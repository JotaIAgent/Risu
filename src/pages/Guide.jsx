import React from 'react'
import PageTitle from '../components/PageTitle'
import { useNavigate } from 'react-router-dom'
import {
    LayoutDashboard,
    Calendar,
    Package,
    Users,
    DollarSign,
    Truck,
    MessageCircle,
    ArrowRight,
    Home,
    Rocket,
    CheckCircle2,
    ShieldCheck,
    Zap
} from 'lucide-react'

const GuideSection = ({ icon: Icon, title, description, items }) => (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30 hover:shadow-2xl hover:shadow-slate-200/40 transition-all duration-500 group">
        <div className="flex items-center gap-4 mb-6">
            <div className="p-4 rounded-2xl bg-[#13283b] text-white group-hover:scale-110 transition-transform duration-500 shadow-lg shadow-[#13283b]/20">
                <Icon size={24} />
            </div>
            <h3 className="text-xl font-black text-[#13283b] uppercase tracking-tight">{title}</h3>
        </div>
        <p className="text-slate-600 font-medium leading-relaxed mb-6">{description}</p>
        <ul className="space-y-3">
            {items.map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm font-bold text-slate-500">
                    <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                    {item}
                </li>
            ))}
        </ul>
    </div>
)

export default function Guide() {
    const navigate = useNavigate()

    const sections = [
        {
            icon: LayoutDashboard,
            title: "Dashboard Central",
            description: "Sua torre de comando. Aqui você vê o resumo de tudo o que importa em tempo real.",
            items: ["Faturamento do mês", "Total de locações ativas", "Alertas de devolução", "Gráficos de crescimento"]
        },
        {
            icon: Calendar,
            title: "Agenda & Locações",
            description: "Controle total do tempo. Nunca mais perca um agendamento ou contrato.",
            items: ["Visualização em calendário", "Status de entrega/coleta", "Geração automática de PDF", "Assinatura digital"]
        },
        {
            icon: Package,
            title: "Estoque Inteligente",
            description: "Gerencie seu patrimônio com precisão cirúrgica e evite furos no estoque.",
            items: ["Controle de disponibilidade", "Histórico de danos", "Categorização por grupos", "Fotos e detalhes técnicos"]
        },
        {
            icon: DollarSign,
            title: "Financeiro Master",
            description: "Pinte o lucro de verde. Controle entradas, saídas e impostos automaticamente.",
            items: ["Fluxo de caixa detalhado", "Cálculo de impostos e taxas", "Custos fixos e variáveis", "Conciliação bancária"]
        },
        {
            icon: Truck,
            title: "Logística Completa",
            description: "Acompanhe cada movimento. Saiba onde seus equipamentos estão agora.",
            items: ["Roteiro de entregas", "Confirmação de recebimento", "Checklist de saída/entrada", "Status do transporte"]
        },
        {
            icon: MessageCircle,
            title: "Automação WhatsApp",
            description: "Comunicação profissional. Envie orçamentos e lembretes com 1 clique.",
            items: ["Envio de PDF por WhatsApp", "Lembretes de vencimento", "Mensagens de boas-vindas", "Notificações de cobrança"]
        }
    ]

    return (
        <div className="min-h-screen bg-slate-50 pt-10 pb-20 px-6 animate-in fade-in duration-700">
            <PageTitle title="Guia do Risu" />
            <div className="max-w-6xl mx-auto">
                {/* Header Actions */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-6 mb-16">
                    <div className="text-center md:text-left">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                            <Rocket size={12} /> Comece por aqui
                        </div>
                        <h1 className="text-4xl md:text-5xl font-black text-[#13283b] uppercase tracking-tighter leading-none">
                            Bem-vindo ao <span className="text-blue-600">Risu</span>
                        </h1>
                        <p className="mt-3 text-slate-500 font-medium tracking-wide">Descubra como transformar sua gestão em poucos minutos.</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate('/')}
                            className="px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-white hover:text-[#13283b] transition-all flex items-center gap-2 border border-transparent hover:border-slate-200"
                        >
                            <Home size={16} /> Voltar ao Início
                        </button>
                        <button
                            onClick={() => navigate('/dashboard')}
                            className="px-8 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-[#13283b] text-white hover:scale-105 transition-all shadow-xl shadow-[#13283b]/20 flex items-center gap-2"
                        >
                            Ir para o Dashboard <ArrowRight size={16} />
                        </button>
                    </div>
                </div>

                {/* Grid de Seções */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
                    {sections.map((section, idx) => (
                        <GuideSection key={idx} {...section} />
                    ))}
                </div>

                {/* Final CTA Card */}
                <div className="bg-[#13283b] rounded-[3rem] p-12 text-center text-white relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 p-12 opacity-10 rotate-12 pointer-events-none">
                        <Zap size={200} />
                    </div>

                    <h2 className="text-3xl font-black uppercase tracking-tighter mb-4 relative z-10">Tudo pronto para decolar?</h2>
                    <p className="text-blue-200 font-medium mb-10 max-w-xl mx-auto relative z-10">
                        Explore cada funcionalidade e profissionalize sua locadora hoje. Se precisar de ajuda, conte com nosso suporte.
                    </p>

                    <button
                        onClick={() => navigate('/dashboard')}
                        className="bg-white text-[#13283b] px-12 py-5 rounded-2xl text-sm font-black uppercase tracking-widest hover:scale-110 transition-transform shadow-2xl relative z-10 inline-flex items-center gap-3"
                    >
                        Começar Agora <ArrowRight size={20} />
                    </button>
                </div>
            </div>
        </div>
    )
}

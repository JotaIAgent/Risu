
import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, RefreshCcw, AlertCircle } from 'lucide-react'

export default function Refund() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
            {/* Header / Navigation */}
            <header className="p-8 flex justify-between items-center max-w-7xl mx-auto w-full">
                <Link
                    to="/"
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-secondary transition-colors"
                >
                    <ArrowLeft size={16} /> Voltar para o Início
                </Link>
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm">
                        <RefreshCcw className="text-secondary" size={20} />
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-4xl mx-auto w-full p-8 pb-20">
                <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-12 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800">
                    <h1 className="text-4xl font-black text-[#13283b] dark:text-white uppercase tracking-tighter mb-4">
                        Política de <span className="text-secondary italic">Cancelamento</span> e Reembolso
                    </h1>
                    <p className="text-sm font-bold text-slate-400 mb-12 uppercase tracking-widest">Última atualização: 10 de Fevereiro de 2026</p>

                    <div className="space-y-12 text-slate-600 dark:text-slate-400 leading-relaxed">
                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">01.</span> Período de Teste Gerátis
                            </h2>
                            <p className="font-medium">
                                Oferecemos um período de teste gratuito de 3 (três) dias para novos usuários. Durante este período,
                                você pode explorar todas as funcionalidades do sistema sem qualquer compromisso financeiro.
                                Após o término do trial, o acesso será restrito até a escolha e pagamento de um plano.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">02.</span> Direito de Arrependimento
                            </h2>
                            <p className="font-medium">
                                Em conformidade com o Código de Defesa do Consumidor (Art. 49), o usuário tem o direito de desistir da
                                contratação no prazo de 7 (sete) dias a contar da assinatura ou do ato de recebimento do serviço.
                                Nestes casos, o reembolso será integral.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">03.</span> Cobrança Recorrente e Renovação
                            </h2>
                            <p className="font-medium">
                                Nossas assinaturas (mensal, trimestral, semestral e anual) são renovadas automaticamente ao final de cada período.
                                A renovação ocorre utilizando o mesmo método de pagamento registrado anteriormente via Asaas.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">04.</span> Como Cancelar
                            </h2>
                            <p className="font-medium">
                                Você pode cancelar sua renovação a qualquer momento diretamente na área de "Faturamento" ou "Assinatura" dentro do sistema.
                                O cancelamento interrompe cobranças futuras, mas não gera reembolso proporcional ao período já utilizado,
                                mantendo seu acesso ativo até o fim do ciclo vigente.
                            </p>
                            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl flex gap-3 italic text-sm text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                                <AlertCircle size={20} className="shrink-0" />
                                <p>Nota: O desinstalar de aplicativos ou não uso do sistema não constitui cancelamento da assinatura.</p>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">05.</span> Reembolsos Excepcionais
                            </h2>
                            <p className="font-medium">
                                Casos não previstos nos itens anteriores serão analisados individualmente pelo nosso suporte.
                                Erros técnicos graves ou indisponibilidades prolongadas documentadas podem justificar reembolsos parciais ou totais.
                            </p>
                        </section>
                    </div>

                    <div className="mt-20 pt-12 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-[#13283b] dark:text-white">
                            <ShieldCheck className="text-green-500" size={20} />
                            <span className="text-xs font-black uppercase tracking-widest">Política Transparente</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">© 2026 Risu</p>
                    </div>
                </div>
            </main>
        </div>
    )
}


import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, FileText, Scale } from 'lucide-react'

export default function Terms() {
    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col">
            {/* Header / Navigation */}
            <header className="p-8 flex justify-between items-center max-w-7xl mx-auto w-full">
                <Link
                    to="/signup"
                    className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-secondary transition-colors"
                >
                    <ArrowLeft size={16} /> Voltar para o Cadastro
                </Link>
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm">
                        <Scale className="text-secondary" size={20} />
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-4xl mx-auto w-full p-8 pb-20">
                <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-12 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800">
                    <h1 className="text-4xl font-black text-[#13283b] dark:text-white uppercase tracking-tighter mb-4">
                        Termos de <span className="text-secondary italic">Uso</span>
                    </h1>
                    <p className="text-sm font-bold text-slate-400 mb-12 uppercase tracking-widest">Última atualização: 15 de Janeiro de 2026</p>

                    <div className="space-y-12 text-slate-600 dark:text-slate-400 leading-relaxed">
                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">01.</span> Aceitação dos Termos
                            </h2>
                            <p className="font-medium">
                                Ao acessar e utilizar o sistema Gestão Aluguel, você concorda em cumprir e estar vinculado a estes Termos de Uso.
                                Se você não concordar com qualquer parte destes termos, não deverá utilizar nossos serviços.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">02.</span> Descrição do Serviço
                            </h2>
                            <p className="font-medium">
                                O Gestão Aluguel é um Micro-SaaS focado na automação e gestão de locações de bens e equipamentos.
                                O serviço inclui controle de estoque, agenda de locações, emissão de contratos e gestão financeira básica.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">03.</span> Responsabilidades do Usuário
                            </h2>
                            <p className="font-medium">
                                Você é responsável por manter a confidencialidade de sua conta e senha sob todas as circunstâncias.
                                Além disso, compromete-se a fornecer informações verídicas e atualizadas durante o cadastro.
                            </p>
                            <ul className="list-disc pl-6 space-y-2 font-medium">
                                <li>Uso legal do sistema apenas.</li>
                                <li>Não compartilhar credenciais de acesso.</li>
                                <li>Backup regular de seus dados de locação.</li>
                            </ul>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">04.</span> Planos e Pagamentos
                            </h2>
                            <p className="font-medium">
                                O acesso ao sistema é baseado em assinaturas recorrentes. O não pagamento nas datas estipuladas
                                poderá resultar na suspensão temporária ou cancelamento do acesso aos recursos do sistema.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">05.</span> Propriedade Intelectual
                            </h2>
                            <p className="font-medium">
                                Todo o software, design, logotipos e códigos-fonte são de propriedade exclusiva do Gestão Aluguel
                                ou de seus licenciadores, protegidos pelas leis de direitos autorais.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">06.</span> Limitação de Responsabilidade
                            </h2>
                            <p className="font-medium">
                                O sistema é fornecido "como está". Não nos responsabilizamos por perdas financeiras decorrentes
                                do uso incorreto da plataforma ou indisponibilidades técnicas momentâneas.
                            </p>
                        </section>
                    </div>

                    <div className="mt-20 pt-12 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-[#13283b] dark:text-white">
                            <ShieldCheck className="text-green-500" size={20} />
                            <span className="text-xs font-black uppercase tracking-widest">Navegação Segura</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">© 2026 Gestão Aluguel</p>
                    </div>
                </div>
            </main>
        </div>
    )
}

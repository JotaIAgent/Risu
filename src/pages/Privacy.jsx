
import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Lock, EyeOff } from 'lucide-react'

export default function Privacy() {
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
                        <Lock className="text-secondary" size={20} />
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-4xl mx-auto w-full p-8 pb-20">
                <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-12 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800">
                    <h1 className="text-4xl font-black text-[#13283b] dark:text-white uppercase tracking-tighter mb-4">
                        Política de <span className="text-secondary italic">Privacidade</span>
                    </h1>
                    <p className="text-sm font-bold text-slate-400 mb-12 uppercase tracking-widest">Última atualização: 15 de Janeiro de 2026</p>

                    <div className="space-y-12 text-slate-600 dark:text-slate-400 leading-relaxed">
                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">01.</span> Coleta de Dados
                            </h2>
                            <p className="font-medium">
                                Coletamos as informações necessárias para a prestação de nossos serviços, como seu nome, email, CPF/CNPJ,
                                e informações de contato. Esses dados são coletados no momento do seu cadastro.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">02.</span> Uso das Informações
                            </h2>
                            <p className="font-medium">
                                Utilizamos seus dados exclusivamente para:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 font-medium">
                                <li>Gerenciar seu acesso ao sistema.</li>
                                <li>Processar pagamentos e assinaturas.</li>
                                <li>Enviar atualizações críticas e comunicações de suporte.</li>
                                <li>Personalizar sua experiência no dashboard.</li>
                            </ul>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">03.</span> Proteção de Dados
                            </h2>
                            <p className="font-medium">
                                Implementamos medidas de segurança técnicas e administrativas para proteger seus dados pessoais
                                contra acesso não autorizado, alteração, divulgação ou destruição. Utilizamos criptografia e
                                protocolos de segurança de ponta.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">04.</span> Compartilhamento de Terceiros
                            </h2>
                            <p className="font-medium">
                                Não vendemos seus dados para terceiros. O compartilhamento ocorre apenas com parceiros essenciais
                                para o funcionamento do serviço, como processadores de pagamento e provedores de infraestrutura cloud.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">05.</span> Seus Direitos (LGPD)
                            </h2>
                            <p className="font-medium">
                                De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem o direito de acessar, corrigir,
                                excluir ou solicitar a portabilidade de seus dados pessoais a qualquer momento através do seu perfil.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">06.</span> Cookies
                            </h2>
                            <p className="font-medium">
                                Utilizamos cookies funcionais para manter sua sessão ativa e salvar suas preferências de visualização.
                                Cookies analíticos podem ser usados de forma anonimizada para melhoria do produto.
                            </p>
                        </section>
                    </div>

                    <div className="mt-20 pt-12 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-[#13283b] dark:text-white">
                            <ShieldCheck className="text-green-500" size={20} />
                            <span className="text-xs font-black uppercase tracking-widest">Privacidade Garantida</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">© 2026 Gestão Aluguel</p>
                    </div>
                </div>
            </main>
        </div>
    )
}

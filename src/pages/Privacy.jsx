
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
                                Coletamos dados essenciais como nome, email, CPF/CNPJ, e endereço para a prestação do serviço.
                                A base legal para este tratamento é a execução de contrato (Art. 7º, V da LGPD).
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">02.</span> Operação e Pagamentos
                            </h2>
                            <p className="font-medium">
                                Seus dados de pagamento são processados de forma segura pelo gateway <span className="font-bold">Asaas</span>.
                                O Risu não armazena números de cartões de crédito em seus servidores, mantendo apenas tokens de cobrança.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">03.</span> Proteção e Segurança
                            </h2>
                            <p className="font-medium">
                                Implementamos criptografia SSL e firewalls em nossa infraestrutura na nuvem. Mantemos registros de acesso
                                (logs) conforme exigido pelo Marco Civil da Internet.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">04.</span> Compartilhamento
                            </h2>
                            <p className="font-medium">
                                Seus dados são compartilhados apenas com parceiros operacionais necessários: processador de pagamentos (Asaas),
                                serviço de hospedagem (AWS/Supabase) e ferramentas de comunicação (WhatsApp/Email).
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

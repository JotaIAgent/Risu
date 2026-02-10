
import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Database, UserCheck } from 'lucide-react'

export default function LGPD() {
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
                        <Database className="text-secondary" size={20} />
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-4xl mx-auto w-full p-8 pb-20">
                <div className="bg-white dark:bg-slate-900 rounded-[3rem] p-12 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-slate-800">
                    <h1 className="text-4xl font-black text-[#13283b] dark:text-white uppercase tracking-tighter mb-4">
                        Tratamento de <span className="text-secondary italic">Dados Pessoais</span> (LGPD)
                    </h1>
                    <p className="text-sm font-bold text-slate-400 mb-12 uppercase tracking-widest">Última atualização: 10 de Fevereiro de 2026</p>

                    <div className="space-y-12 text-slate-600 dark:text-slate-400 leading-relaxed">
                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">01.</span> Compromisso LGPD
                            </h2>
                            <p className="font-medium">
                                O Risu está plenamente comprometido com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).
                                Adotamos rigorosos padrões de segurança e privacidade para garantir que seus dados e os dados de seus clientes
                                estejam sempre protegidos.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">02.</span> Agentes de Tratamento
                            </h2>
                            <p className="font-medium">
                                No contexto do nosso SaaS:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 font-medium">
                                <li><strong>Nós (Risu):</strong> Somos os <span className="italic">Controladores</span> dos dados de sua conta de usuário e <span className="italic">Operadores</span> dos dados que você insere sobre suas locações.</li>
                                <li><strong>Você (Usuário):</strong> É o <span className="italic">Controlador</span> dos dados de seus clientes que você cadastra no sistema.</li>
                            </ul>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">03.</span> Finalidade e Compartilhamento
                            </h2>
                            <p className="font-medium">
                                Seus dados são utilizados exclusivamente para a execução do contrato de serviço. Compartilhamos informações estritamente necessárias com:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 font-medium">
                                <li><strong>Asaas:</strong> Processamento de pagamentos e emissão de cobranças.</li>
                                <li><strong>Supabase/AWS:</strong> Armazenamento seguro de banco de dados e arquivos.</li>
                                <li><strong>Serviços de Email/WhatsApp:</strong> Envio de notificações do sistema.</li>
                            </ul>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">04.</span> Direitos do Titular
                            </h2>
                            <p className="font-medium">
                                Você pode exercer seus direitos garantidos pela LGPD a qualquer momento:
                            </p>
                            <ul className="list-disc pl-6 space-y-2 font-medium">
                                <li>Confirmação da existência de tratamento.</li>
                                <li>Acesso e correção de dados incompletos ou inexatos.</li>
                                <li>Eliminação de dados (observando prazos legais de guarda fiscal).</li>
                                <li>Revogação de consentimento.</li>
                            </ul>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-xl font-black text-[#13283b] dark:text-white uppercase tracking-tight flex items-center gap-3">
                                <span className="text-secondary font-serif">05.</span> Segurança e Incidentes
                            </h2>
                            <p className="font-medium">
                                Utilizamos criptografia SSL, firewalls e backups redundantes. Em caso de qualquer incidente de segurança
                                que possa acarretar risco ou dano relevante, notificaremos os titulares e a ANPD conforme exigido por lei.
                            </p>
                        </section>
                    </div>

                    <div className="mt-20 pt-12 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                        <div className="flex items-center gap-2 text-[#13283b] dark:text-white">
                            <UserCheck className="text-blue-500" size={20} />
                            <span className="text-xs font-black uppercase tracking-widest">Conformidade Legal</span>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">© 2026 Risu</p>
                    </div>
                </div>
            </main>
        </div>
    )
}

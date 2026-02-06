import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Check, ShieldCheck, Zap, ArrowLeft, Ticket, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import logoRisu from '../assets/logo_risu.jpg'

const plans = {
    'monthly': {
        id: 'monthly',
        name: 'Plano Mensal',
        price: 99.90,
        billing: 'mensal',
        stripePriceId: 'price_1SqHrZJrvxBiHEjISBIjF1Xg'
    },
    'quarterly': {
        id: 'quarterly',
        name: 'Plano Trimestral',
        price: 269.70,
        billing: 'cada 3 meses',
        stripePriceId: 'price_1SqHtTJrvxBiHEIgyTx6ECr'
    },
    'semiannual': {
        id: 'semiannual',
        name: 'Plano Semestral',
        price: 479.40,
        billing: 'cada 6 meses',
        stripePriceId: 'price_1SqHu6JrvxBiHEjIcFJOrE7Y'
    },
    'annual': {
        id: 'annual',
        name: 'Plano Anual',
        price: 838.80,
        billing: 'anual',
        stripePriceId: 'price_1SqHuVJrvxBiHEjIUNJCWLFm'
    }
}

export default function Checkout() {
    const { planId } = useParams()
    const { user } = useAuth()
    const navigate = useNavigate()

    const [couponCode, setCouponCode] = useState('')
    const [isValidatingCoupon, setIsValidatingCoupon] = useState(false)
    const [couponError, setCouponError] = useState('')
    const [appliedCoupon, setAppliedCoupon] = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')

    const plan = plans[planId] || plans['monthly']

    useEffect(() => {
        if (!user) {
            navigate('/signup')
        }
    }, [user, navigate])

    const handleApplyCoupon = async () => {
        if (!couponCode) return

        setIsValidatingCoupon(true)
        setCouponError('')

        try {
            const { data: coupon, error: fetchError } = await supabase
                .from('saas_coupons')
                .select('*')
                .eq('code', couponCode.toUpperCase())
                .eq('is_active', true)
                .maybeSingle()

            if (fetchError) throw fetchError

            if (!coupon) {
                setCouponError('Cupom não encontrado ou inativo.')
                setAppliedCoupon(null)
                return
            }

            const now = new Date()
            if (coupon.valid_until && new Date(coupon.valid_until) < now) {
                setCouponError('Cupom expirado.')
                setAppliedCoupon(null)
                return
            }

            if (coupon.current_uses >= coupon.max_uses) {
                setCouponError('Cupom esgotado.')
                setAppliedCoupon(null)
                return
            }

            // Calculate Discount
            let discountValue = 0
            if (coupon.type === 'percentage') {
                discountValue = (plan.price * (coupon.value / 100))
            } else {
                discountValue = coupon.value
            }

            setAppliedCoupon({
                ...coupon,
                discountValue: Math.min(discountValue, plan.price)
            })
            setCouponError('')
        } catch (err) {
            console.error('Error validating coupon:', err)
            setCouponError('Erro ao validar cupom. Tente novamente.')
        } finally {
            setIsValidatingCoupon(false)
        }
    }

    const handleSubscribe = async () => {
        setIsLoading(true)
        setError('')

        try {
            const { data, error: functionError } = await supabase.functions.invoke('create-checkout', {
                body: {
                    priceId: plan.stripePriceId,
                    couponCode: appliedCoupon?.code,
                    successUrl: window.location.origin + '/dashboard?session_id={CHECKOUT_SESSION_ID}',
                    cancelUrl: window.location.href,
                }
            })

            if (functionError) throw functionError
            if (data?.url) window.location.href = data.url
        } catch (err) {
            console.error('Error starting checkout:', err)
            setError(err.message || 'Erro ao iniciar checkout. Tente novamente.')
            setIsLoading(false)
        }
    }

    const finalPrice = appliedCoupon ? Math.max(0, plan.price - appliedCoupon.discountValue) : plan.price

    return (
        <div className="min-h-screen bg-[#f8fafc] dark:bg-slate-950 font-sans text-[#13283b] dark:text-slate-200">
            {/* Header */}
            <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <Link to="/pricing" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors">
                        <ArrowLeft size={20} />
                        <span className="text-sm font-bold uppercase tracking-wider">Planos</span>
                    </Link>
                    <img src={logoRisu} alt="Risu Logo" className="h-6 w-auto mix-blend-multiply dark:invert" />
                    <div className="w-20"></div> {/* Spacer */}
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-6 py-12">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-12">
                    {/* Left: Summary */}
                    <div className="md:col-span-3 space-y-8">
                        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-800">
                            <h1 className="text-2xl font-black mb-6 uppercase tracking-tight">Checkout</h1>

                            <div className="space-y-6">
                                <div className="flex items-center justify-between border-b border-slate-50 dark:border-slate-800 pb-4">
                                    <div>
                                        <h2 className="font-black uppercase tracking-wider text-sm">{plan.name}</h2>
                                        <p className="text-xs text-slate-400 font-medium">Cobrado {plan.billing}</p>
                                    </div>
                                    <span className="font-black text-lg">R$ {plan.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                </div>

                                {/* Coupon Section */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-3">
                                        Possui um cupom?
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            < Ticket size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                type="text"
                                                value={couponCode}
                                                onChange={(e) => setCouponCode(e.target.value)}
                                                placeholder="CÓDIGO"
                                                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-12 pr-4 py-3 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all uppercase"
                                                disabled={appliedCoupon}
                                            />
                                        </div>
                                        <button
                                            onClick={appliedCoupon ? () => setAppliedCoupon(null) : handleApplyCoupon}
                                            disabled={isValidatingCoupon || (!couponCode && !appliedCoupon)}
                                            className={`px-6 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${appliedCoupon
                                                    ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                                    : 'bg-[#13283b] text-white hover:opacity-90'
                                                }`}
                                        >
                                            {isValidatingCoupon ? <Loader2 size={16} className="animate-spin mx-auto" /> : (appliedCoupon ? 'Remover' : 'Aplicar')}
                                        </button>
                                    </div>
                                    {couponError && <p className="mt-2 text-[10px] font-bold text-red-500 uppercase flex items-center gap-1"><AlertCircle size={12} /> {couponError}</p>}
                                    {appliedCoupon && <p className="mt-2 text-[10px] font-bold text-green-500 uppercase">Cupom {appliedCoupon.code} aplicado com sucesso!</p>}
                                </div>

                                {/* Total Breakdown */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-6 space-y-3">
                                    <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                                        <span>Subtotal</span>
                                        <span>R$ {plan.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                    {appliedCoupon && (
                                        <div className="flex justify-between text-xs font-bold text-green-500 uppercase tracking-wider">
                                            <span>Desconto ({appliedCoupon.code})</span>
                                            <span>- R$ {appliedCoupon.discountValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center border-t border-slate-200 dark:border-slate-700 pt-3 mt-3">
                                        <span className="font-black uppercase tracking-widest text-sm">Total</span>
                                        <span className="text-2xl font-black text-blue-600">R$ {finalPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Security Notice */}
                        <div className="flex items-center gap-4 text-slate-400">
                            <ShieldCheck size={32} className="text-blue-500 shrink-0" />
                            <p className="text-[10px] font-bold leading-relaxed uppercase tracking-wider">
                                Pagamento processado com segurança via <span className="text-[#13283b] dark:text-white">ASAAS</span>.
                                Seus dados estão protegidos por criptografia de ponta a ponta.
                            </p>
                        </div>
                    </div>

                    {/* Right: Benefits & Payment */}
                    <div className="md:col-span-2 space-y-6">
                        <div className="bg-[#13283b] text-white rounded-3xl p-8 shadow-xl">
                            <h3 className="font-black uppercase tracking-widest text-xs mb-8 flex items-center gap-2">
                                <Zap size={14} className="text-blue-400" /> Vantagens Premium
                            </h3>
                            <ul className="space-y-4 mb-8">
                                {[
                                    'Acesso total e imediato',
                                    'Sem fidelidade ou multa',
                                    'Cancelamento simplificado',
                                    'Suporte prioritário',
                                    'Novas atualizações mensais'
                                ].map((item, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <Check size={16} className="text-blue-400 shrink-0" strokeWidth={3} />
                                        <span className="text-[10px] font-black uppercase tracking-widest leading-tight opacity-90">{item}</span>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={handleSubscribe}
                                disabled={isLoading}
                                className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all hover:scale-[1.02] shadow-lg flex items-center justify-center gap-3"
                            >
                                {isLoading ? <Loader2 size={18} className="animate-spin" /> : 'Assinar Agora'}
                            </button>
                            {error && <p className="mt-4 text-[10px] font-bold text-red-300 text-center uppercase leading-relaxed">{error}</p>}
                        </div>

                        <div className="bg-blue-50 dark:bg-slate-900 border border-blue-100 dark:border-slate-800 rounded-2xl p-6">
                            <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 leading-relaxed uppercase text-center tracking-wider">
                                Liberação automática do seu acesso logo após a confirmação do pagamento.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}

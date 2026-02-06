import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
    Ticket,
    Plus,
    Search,
    Filter,
    MoreVertical,
    Edit2,
    Trash2,
    Power,
    Calendar,
    Layers,
    DollarSign,
    TrendingUp,
    RefreshCw,
    X,
    Check
} from 'lucide-react'

export default function AdminCoupons() {
    const [coupons, setCoupons] = useState([])
    const [stats, setStats] = useState({
        activeCount: 0,
        totalUsages: 0,
        totalDiscounted: 0
    })
    const [loading, setLoading] = useState(true)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingCoupon, setEditingCoupon] = useState(null)
    const [formData, setFormData] = useState({
        code: '',
        type: 'percentage',
        value: '',
        max_uses: '',
        valid_from: '',
        valid_until: '',
        is_active: true
    })

    const fetchCoupons = async () => {
        try {
            setLoading(true)

            // 1. Fetch Coupons
            const { data: couponsData, error: couponsError } = await supabase
                .from('saas_coupons')
                .select('*')
                .order('created_at', { ascending: false })

            if (couponsError) throw couponsError

            // 2. Fetch all usages to calculate stats
            const { data: usagesData, error: usagesError } = await supabase
                .from('saas_coupon_usages')
                .select('coupon_id, discount_amount')

            if (usagesError) throw usagesError

            // 3. Process data in memory
            const processed = couponsData.map(c => {
                const usages = usagesData.filter(u => u.coupon_id === c.id)
                const usageCount = usages.length
                const totalDiscount = usages.reduce((sum, u) => sum + (u.discount_amount || 0), 0)
                return { ...c, usageCount, totalDiscount }
            })

            setCoupons(processed)

            // 4. Stats calc
            setStats({
                activeCount: couponsData.filter(c => c.is_active).length,
                totalUsages: usagesData.length,
                totalDiscounted: usagesData.reduce((sum, u) => sum + (u.discount_amount || 0), 0)
            })
        } catch (err) {
            console.error('Error fetching coupons:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchCoupons()
    }, [])

    const handleOpenModal = (coupon = null) => {
        if (coupon) {
            setEditingCoupon(coupon)
            setFormData({
                code: coupon.code,
                type: coupon.type,
                value: coupon.value,
                max_uses: coupon.max_uses,
                valid_from: coupon.valid_from ? coupon.valid_from.split('T')[0] : '',
                valid_until: coupon.valid_until ? coupon.valid_until.split('T')[0] : '',
                is_active: coupon.is_active
            })
        } else {
            setEditingCoupon(null)
            setFormData({
                code: '',
                type: 'percentage',
                value: '',
                max_uses: '',
                valid_from: new Date().toISOString().split('T')[0],
                valid_until: '',
                is_active: true
            })
        }
        setIsModalOpen(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)

        try {
            const dataToSave = {
                code: formData.code.toUpperCase().trim(),
                type: formData.type,
                value: parseFloat(formData.value),
                max_uses: parseInt(formData.max_uses),
                valid_from: formData.valid_from || null,
                valid_until: formData.valid_until || null,
                is_active: formData.is_active
            }

            if (editingCoupon) {
                const { error } = await supabase
                    .from('saas_coupons')
                    .update(dataToSave)
                    .eq('id', editingCoupon.id)
                if (error) throw error
            } else {
                const { error } = await supabase
                    .from('saas_coupons')
                    .insert([dataToSave])
                if (error) throw error
            }

            setIsModalOpen(false)
            fetchCoupons()
        } catch (err) {
            alert('Erro ao salvar cupom: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const toggleStatus = async (coupon) => {
        try {
            const { error } = await supabase
                .from('saas_coupons')
                .update({ is_active: !coupon.is_active })
                .eq('id', coupon.id)
            if (error) throw error
            fetchCoupons()
        } catch (err) {
            alert('Erro ao atualizar status: ' + err.message)
        }
    }

    return (
        <div className="space-y-12 w-full text-[#13283b]">
            <header className="flex justify-between items-end">
                <div>
                    <h2 className="text-4xl font-black uppercase tracking-tighter mb-2">Gerenciamento de Cupons</h2>
                    <p className="text-slate-400 font-medium tracking-wide">Crie e monitore campanhas de desconto.</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="bg-[#13283b] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-[10px] shadow-xl hover:scale-105 transition-all flex items-center gap-3"
                >
                    <Plus size={16} strokeWidth={3} />
                    Criar Novo Cupom
                </button>
            </header>

            {/* Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[
                    { label: 'Cupons Ativos', value: stats.activeCount, icon: Ticket, color: 'text-blue-600' },
                    { label: 'Usos Totais', value: stats.totalUsages, icon: Layers, color: 'text-purple-600' },
                    { label: 'Total Descontado', value: `R$ ${stats.totalDiscounted.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: TrendingUp, color: 'text-green-600' }
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30">
                        <div className="flex justify-between items-center mb-6">
                            <div className="p-4 bg-slate-50 rounded-2xl">
                                <stat.icon size={20} className={stat.color} />
                            </div>
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">{stat.label}</p>
                        <h3 className="text-3xl font-black tracking-tighter">{stat.value}</h3>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30 overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Cupons Cadastrados</h3>
                    <div className="flex gap-4">
                        <button onClick={fetchCoupons} className="p-2 hover:bg-white rounded-xl transition-colors">
                            <RefreshCw size={18} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-50">
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Cupom</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Desconto</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Validade</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Uso</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {coupons.map((coupon) => (
                                <tr key={coupon.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-8 py-6">
                                        <span className="font-black uppercase tracking-widest text-[#13283b] bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">{coupon.code}</span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-black">{coupon.type === 'percentage' ? `${coupon.value}%` : `R$ ${coupon.value.toLocaleString('pt-BR')}`}</span>
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{coupon.type === 'percentage' ? 'Percentual' : 'Valor Fixo'}</span>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 font-bold text-[11px] text-slate-500">
                                        {coupon.valid_until ? (
                                            <div className="flex items-center gap-1.5">
                                                <Calendar size={12} />
                                                {new Date(coupon.valid_until).toLocaleDateString()}
                                            </div>
                                        ) : 'Vitalício'}
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex flex-col gap-1.5 w-32">
                                            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-tighter">
                                                <span>{coupon.current_uses} / {coupon.max_uses}</span>
                                                <span className="text-slate-300">{Math.round((coupon.current_uses / coupon.max_uses) * 100)}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-blue-500 rounded-full"
                                                    style={{ width: `${Math.min(100, (coupon.current_uses / coupon.max_uses) * 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6">
                                        <button
                                            onClick={() => toggleStatus(coupon)}
                                            className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all ${coupon.is_active
                                                ? 'bg-green-50 text-green-600 border-green-100 hover:bg-green-100'
                                                : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'
                                                }`}
                                        >
                                            {coupon.is_active ? 'Ativo' : 'Inativo'}
                                        </button>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <button
                                            onClick={() => handleOpenModal(coupon)}
                                            className="p-2 hover:bg-[#13283b] hover:text-white rounded-xl transition-all"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 sm:p-12">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                    <div className="relative bg-white w-full max-w-xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                            <h3 className="text-lg font-black uppercase tracking-tight">{editingCoupon ? 'Editar Cupom' : 'Novo Cupom'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="col-span-2">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Código do Cupom</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        placeholder="EX: RISU50"
                                        className="w-full bg-slate-50 border-none rounded-xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[#13283b] transition-all uppercase"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Tipo</label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        className="w-full bg-slate-50 border-none rounded-xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[#13283b] transition-all uppercase"
                                    >
                                        <option value="percentage">Porcentagem (%)</option>
                                        <option value="fixed">Valor Fixo (R$)</option>
                                    </select>
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Valor</label>
                                    <input
                                        type="number"
                                        required
                                        value={formData.value}
                                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                        placeholder="0.00"
                                        className="w-full bg-slate-50 border-none rounded-xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[#13283b] transition-all"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Limite de Usos</label>
                                    <input
                                        type="number"
                                        required
                                        value={formData.max_uses}
                                        onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                                        placeholder="100"
                                        className="w-full bg-slate-50 border-none rounded-xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[#13283b] transition-all"
                                    />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Data Limite (Opcional)</label>
                                    <input
                                        type="date"
                                        value={formData.valid_until}
                                        onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                                        className="w-full bg-slate-50 border-none rounded-xl px-5 py-4 text-sm font-bold focus:ring-2 focus:ring-[#13283b] transition-all uppercase"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-6 border-t border-slate-50">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-8 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:bg-slate-50 transition-all border border-transparent"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="bg-[#13283b] text-white px-10 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-105 transition-all flex items-center gap-2"
                                >
                                    {loading ? <RefreshCw size={14} className="animate-spin" /> : (editingCoupon ? 'Salvar Alterações' : 'Criar Cupom')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

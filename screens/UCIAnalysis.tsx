import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer, 
    Cell
} from 'recharts';

const UCIAnalysis: React.FC = () => {
    const navigate = useNavigate();
    const [patients, setPatients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());

    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

    const calculateMortalityRisk = (score: number | null) => {
        if (score === null || score === undefined) return 0;
        // APACHE II basic logit formula: logit = -3.517 + (score * 0.146)
        // Simplified without diagnostic weights
        const logit = -3.517 + (score * 0.146);
        return Math.exp(logit) / (1 + Math.exp(logit));
    };

    useEffect(() => {
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('patients')
            .select('*')
            .order('discharge_date', { ascending: false });

        if (error) console.error('Error fetching patients:', error);
        else setPatients(data || []);
        setLoading(false);
    };

    const filteredPatients = useMemo(() => {
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        return patients.filter(p => {
            // 1. Current hospitalized patients (active)
            if (p.status === 'active' && selectedMonth === currentMonth) {
                return true;
            }

            // 2. Patients discharged/deceased/transferred
            if (p.status !== 'active') {
                // We prioritize discharge_date, but fallback to created_at if missing
                const date = p.discharge_date ? new Date(p.discharge_date) : new Date(p.created_at);
                return date.getMonth() === selectedMonth && date.getFullYear() === currentYear;
            }

            return false;
        });
    }, [patients, selectedMonth]);

    const stats = useMemo(() => {
        if (filteredPatients.length === 0) return { avgLOS: 0, total: 0, acuityDist: [] };

        let totalDays = 0;
        let deceasedCount = 0;
        let totalPredictedMortality = 0;
        let patientsWithApache = 0;
        const acuityCounts: { [key: string]: number } = {};

        filteredPatients.forEach(p => {
            const start = new Date(p.ucin_transfer_date || p.created_at);
            const end = p.status === 'active' ? new Date() : new Date(p.discharge_date || p.created_at);
            const diff = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
            totalDays += diff;

            if (p.acuity) {
                acuityCounts[p.acuity] = (acuityCounts[p.acuity] || 0) + 1;
            }

            if (p.status === 'deceased') {
                deceasedCount++;
            }

            if (p.apache_score !== null && p.apache_score !== undefined) {
                totalPredictedMortality += calculateMortalityRisk(p.apache_score);
                patientsWithApache++;
            }
        });

        const acuityDist = Object.entries(acuityCounts).map(([name, value]) => ({ name, value }));
        const observedMortality = (deceasedCount / filteredPatients.length) * 100;
        const predictedMortality = patientsWithApache > 0 ? (totalPredictedMortality / patientsWithApache) * 100 : 0;
        const smr = predictedMortality > 0 ? observedMortality / predictedMortality : 0;

        return {
            avgLOS: Number((totalDays / filteredPatients.length).toFixed(1)),
            total: filteredPatients.length,
            mortalityRate: Number(observedMortality.toFixed(1)),
            smr: Number(smr.toFixed(2)),
            acuityDist
        };
    }, [filteredPatients]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 text-indigo-600 font-bold">
                Cargando Análisis...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8f9fc] flex flex-col font-sans text-slate-900">
            <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-40 shadow-sm">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/')}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
                    >
                        <span className="material-symbols-outlined">arrow_back</span>
                    </button>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">Análisis de Estancia UCI</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Indicadores de Gestión de Camas</p>
                    </div>
                </div>

                <select 
                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                >
                    {months.map((m, i) => (
                        <option key={m} value={i}>{m}</option>
                    ))}
                </select>
            </header>

            <main className="flex-1 p-8 max-w-[1400px] mx-auto w-full space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 p-8 rounded-[32px] text-white shadow-xl shadow-indigo-100 flex flex-col justify-center">
                        <p className="text-xs font-black text-indigo-100 uppercase tracking-widest mb-2">Promedio de Estancia</p>
                        <h3 className="text-5xl font-black tracking-tighter">{stats.avgLOS} días</h3>
                        <p className="text-sm text-indigo-200 mt-2 font-medium">Gestión de Camas</p>
                    </div>

                    <div className="bg-gradient-to-br from-rose-600 to-rose-700 p-8 rounded-[32px] text-white shadow-xl shadow-rose-100 flex flex-col justify-center">
                        <p className="text-xs font-black text-rose-100 uppercase tracking-widest mb-2">Tasa de Mortalidad</p>
                        <h3 className="text-5xl font-black tracking-tighter">{stats.mortalityRate}%</h3>
                        <p className="text-sm text-rose-200 mt-2 font-medium">Mortalidad Observada</p>
                    </div>

                    <div className="bg-gradient-to-br from-amber-500 to-amber-600 p-8 rounded-[32px] text-white shadow-xl shadow-amber-100 flex flex-col justify-center">
                        <p className="text-xs font-black text-amber-50 uppercase tracking-widest mb-2">Mortalidad Estandarizada</p>
                        <h3 className="text-5xl font-black tracking-tighter">{stats.smr}</h3>
                        <p className="text-sm text-amber-100 mt-2 font-medium italic">SMR (Obs / Esp)</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm col-span-3">
                        <h2 className="text-lg font-black text-slate-800 mb-6">Distribución por Prioridad</h2>
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.acuityDist}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 700}} />
                                    <YAxis hide />
                                    <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '16px', border: 'none', fontWeight: 'bold'}} />
                                    <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={40}>
                                        {stats.acuityDist.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
                        <h2 className="text-lg font-black text-slate-800">Detalle de Pacientes - {months[selectedMonth]}</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/80">
                                <tr>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Paciente</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Cama</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Prioridad</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Ingreso</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Egreso</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center text-indigo-600">Días</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredPatients.map(p => {
                                    const start = new Date(p.ucin_transfer_date || p.created_at);
                                    const isActive = p.status === 'active';
                                    const end = isActive ? new Date() : new Date(p.discharge_date || p.created_at);
                                    const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
                                    return (
                                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-8 py-4">
                                                <p className="font-bold text-slate-800">{p.name}</p>
                                                <p className="text-[10px] text-slate-400 uppercase font-bold">HC: {p.hc}</p>
                                            </td>
                                            <td className="px-8 py-4 text-center font-black text-slate-600">{p.bed}</td>
                                            <td className="px-8 py-4 text-center">
                                                <span className="px-2 py-1 bg-slate-100 rounded text-[10px] font-black text-slate-500">{p.acuity}</span>
                                            </td>
                                            <td className="px-8 py-4 text-center text-xs text-slate-500 font-medium">
                                                {new Date(start).toLocaleDateString()}
                                            </td>
                                            <td className="px-8 py-4 text-center text-xs text-slate-500 font-medium">
                                                {isActive ? (
                                                    <span className="text-emerald-600 font-black uppercase tracking-tighter">Hospitalizado</span>
                                                ) : (
                                                    new Date(end).toLocaleDateString()
                                                )}
                                            </td>
                                            <td className="px-8 py-4 text-center font-black text-indigo-600">{days}</td>
                                        </tr>
                                    );
                                })}
                                {filteredPatients.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-12 text-center text-slate-400 font-bold italic">
                                            No se registraron egresos en este periodo.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default UCIAnalysis;

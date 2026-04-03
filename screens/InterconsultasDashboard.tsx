import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { Interconsultation } from '../types';
import { DOCTORS } from '../constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

const InterconsultasDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [interconsultations, setInterconsultations] = useState<Interconsultation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getUTCMonth());

    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const COLORS = ['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#c7d2fe', '#e0e7ff'];

    useEffect(() => {
        fetchInterconsultations();
    }, []);

    const fetchInterconsultations = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('interconsultations')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) console.error('Error fetching ICs:', error);
        else setInterconsultations(data || []);
        setLoading(false);
    };

    const filteredDataByMonth = useMemo(() => {
        return interconsultations.filter(ic => {
            const date = new Date(ic.created_at);
            return date.getUTCMonth() === selectedMonth;
        });
    }, [interconsultations, selectedMonth]);

    const servicesDistribution = useMemo(() => {
        const counts: { [key: string]: number } = {};
        filteredDataByMonth.forEach(ic => {
            const origin = ic.service_origin || 'Otro/No especificado';
            counts[origin] = (counts[origin] || 0) + 1;
        });

        const total = filteredDataByMonth.length;
        return Object.entries(counts)
            .map(([name, value]) => ({
                name,
                value,
                percentage: total > 0 ? Number(((value / total) * 100).toFixed(1)) : 0
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8); // Top 8 services
    }, [filteredDataByMonth]);

    const unsatisfiedDemand = useMemo(() => {
        const criticalPatients = filteredDataByMonth.filter(ic => 
            ['1', '2', '3'].includes(ic.priority || '')
        );
        
        const totalCritical = criticalPatients.filter(ic => 
            ['pending', 'admitted'].includes(ic.status || '')
        ).length;
        
        const pendingCritical = criticalPatients.filter(ic => 
            ic.status === 'pending'
        ).length;

        if (totalCritical === 0) return 0;
        return Number(((pendingCritical / totalCritical) * 100).toFixed(1));
    }, [filteredDataByMonth]);

    const statsByDoctor = useMemo(() => {
        const stats: { [key: string]: { total: number, eval_pase: number, eval_sug: number, pcr: number, utsna: number } } = {};
        
        DOCTORS.forEach(doc => {
            stats[doc] = { total: 0, eval_pase: 0, eval_sug: 0, pcr: 0, utsna: 0 };
        });

        filteredDataByMonth.forEach(ic => {
            if (ic.responders && stats[ic.responders]) {
                stats[ic.responders].total++;
                if (ic.reason === 'evaluacion_pase') stats[ic.responders].eval_pase++;
                if (ic.reason === 'evaluacion_sugerencias') stats[ic.responders].eval_sug++;
                if (ic.reason === 'pcr') stats[ic.responders].pcr++;
                if (ic.reason === 'ustna') stats[ic.responders].utsna++;
            }
        });

        return stats;
    }, [filteredDataByMonth]);

    const generateMonthlyReport = (doctorName: string) => {
        const doc = new jsPDF({ orientation: 'landscape' });
        const reportMonth = months[selectedMonth];
        const data = filteredDataByMonth.filter(ic => doctorName === 'all' ? true : ic.responders === doctorName);

        // Calculate Demanda Insatisfecha for this specific context (all month or doctor-specific)
        const critical = data.filter(ic => ['1', '2', '3'].includes(ic.priority || ''));
        const totalCrit = critical.filter(ic => ['pending', 'admitted'].includes(ic.status || '')).length;
        const pendCrit = critical.filter(ic => ic.status === 'pending').length;
        const unsatDemand = totalCrit > 0 ? ((pendCrit / totalCrit) * 100).toFixed(1) : '0';

        // Header
        doc.setFontSize(20);
        doc.setTextColor(63, 81, 181);
        doc.text('Reporte Mensual de Interconsultas', 14, 22);
        
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Médico: ${doctorName === 'all' ? 'Todos los Médicos' : doctorName}`, 14, 32);
        doc.text(`Periodo: ${reportMonth} ${new Date().getFullYear()}`, 14, 38);
        doc.text(`Total Interconsultas: ${data.length}`, 14, 44);
        doc.text(`Demanda Insatisfecha (P1-P3): ${unsatDemand}%`, 14, 50);

        const tableBody = data.map(ic => [
            new Date(ic.created_at).toLocaleDateString('es-PE'),
            ic.patient_name,
            ic.hc,
            ic.service_origin,
            ic.health_problem_1?.replace('(SUG) ', '') || ic.reason,
            ic.priority || '---',
            ic.status === 'pending' ? 'Pendiente' : ic.status === 'admitted' ? 'Admitido' : 'Completado'
        ]);

        autoTable(doc, {
            startY: 58,
            head: [['Fecha', 'Paciente', 'HC', 'Origen', 'Problema/Motivo', 'Prioridad', 'Estado']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [63, 81, 181], textColor: [255, 255, 255], fontStyle: 'bold' },
            styles: { fontSize: 9, cellPadding: 3 },
            columnStyles: {
                0: { cellWidth: 25 },
                1: { cellWidth: 50 },
                4: { cellWidth: 70 }
            }
        });

        doc.save(`Reporte_IC_${doctorName.replace(' ', '_')}_${reportMonth}.pdf`);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 text-indigo-600 font-bold">
                Cargando Dashboard...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8f9fc] flex flex-col font-sans text-slate-900 overflow-x-hidden">
            {/* Header */}
            <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-40 shadow-sm">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => navigate('/interconsultas')}
                        className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-500"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-6">
                            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
                        </svg>
                    </button>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900">Dashboard de Interconsultas</h1>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Análisis de Desempeño y Reportes</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <select 
                        className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    >
                        {months.map((m, i) => (
                            <option key={m} value={i}>{m}</option>
                        ))}
                    </select>
                </div>
            </header>

            <main className="flex-1 p-8 max-w-[1600px] mx-auto w-full space-y-8">
                {/* Metric Cards Row */}
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Metrics Left */}
                    <div className="w-full lg:w-1/3 grid grid-cols-2 gap-4">
                        <div className="col-span-2 bg-gradient-to-br from-indigo-600 to-indigo-700 p-7 rounded-[32px] border border-indigo-500 shadow-xl shadow-indigo-100/50 text-white relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-20">
                                    <path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                </svg>
                            </div>
                            <p className="text-[11px] font-black text-indigo-100 uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="size-2 rounded-full bg-indigo-300 animate-pulse"></span>
                                Demanda Insatisfecha
                            </p>
                            <div className="flex items-baseline gap-2">
                                <h3 className="text-5xl font-black tracking-tighter">{unsatisfiedDemand}%</h3>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-indigo-200 uppercase tracking-tighter leading-none mb-1">Pacientes P1-P3</span>
                                    <span className="text-[9px] font-medium text-indigo-200/60 leading-tight">Pendientes vs Total Admisión</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Total de ICs</p>
                            <h3 className="text-3xl font-black text-slate-900">{filteredDataByMonth.length}</h3>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mb-1 leading-tight">Eval. y Pase</p>
                            <h3 className="text-3xl font-black text-slate-900">{filteredDataByMonth.filter(i => i.reason === 'evaluacion_pase').length}</h3>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-wider mb-1 leading-tight">Eval. y Sugerencias</p>
                            <h3 className="text-3xl font-black text-slate-900">{filteredDataByMonth.filter(i => i.reason === 'evaluacion_sugerencias').length}</h3>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                            <p className="text-[10px] font-black text-red-500 uppercase tracking-wider mb-1 leading-tight">PCR</p>
                            <h3 className="text-3xl font-black text-slate-900">{filteredDataByMonth.filter(i => i.reason === 'pcr').length}</h3>
                        </div>
                        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                            <p className="text-[10px] font-black text-orange-500 uppercase tracking-wider mb-1 leading-tight">UTSNA</p>
                            <h3 className="text-3xl font-black text-slate-900">{filteredDataByMonth.filter(i => i.reason === 'ustna').length}</h3>
                        </div>
                    </div>

                    {/* Bar Chart Right */}
                    <div className="w-full lg:flex-1 bg-white p-8 rounded-[32px] border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-lg font-black text-slate-800">Origen por Servicio</h2>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Top 8 servicios demandantes</p>
                            </div>
                        </div>
                        
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    layout="vertical"
                                    data={servicesDistribution}
                                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" hide />
                                    <YAxis 
                                        dataKey="name" 
                                        type="category" 
                                        axisLine={false} 
                                        tickLine={false} 
                                        width={100}
                                        tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                                    />
                                    <Tooltip 
                                        cursor={{ fill: '#f8fafc' }}
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                                        formatter={(value: any, name: any, props: any) => [`${value} ICs (${props.payload.percentage}%)`, 'Cantidad']}
                                    />
                                    <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={20}>
                                        {servicesDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Table Area */}
                <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h2 className="text-lg font-black text-slate-800">Estadísticas por Médico Evaluador</h2>
                        <button 
                            onClick={() => generateMonthlyReport('all')}
                            className="bg-indigo-600 text-white px-5 py-2.5 rounded-2xl font-bold text-sm hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg shadow-indigo-200"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-4">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            Reporte General PDF
                        </button>
                    </div>
                    
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50/80">
                                <tr>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Médico Evaluador</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Total ICs</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center text-indigo-500">Eval. y Pase</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center text-teal-500">Eval. y Sug.</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center text-rose-500">PCR</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center text-amber-500">UTSNA</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {DOCTORS.map(doc => (
                                    <tr key={doc} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="size-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500 transition-all">
                                                    {doc.split(' ')[1]?.[0] || doc[0]}
                                                </div>
                                                <span className="font-bold text-slate-700">{doc}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-center font-black text-slate-900">{statsByDoctor[doc]?.total || 0}</td>
                                        <td className="px-8 py-5 text-center">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${statsByDoctor[doc]?.eval_pase > 0 ? 'bg-indigo-100 text-indigo-700' : 'text-slate-300'}`}>
                                                {statsByDoctor[doc]?.eval_pase || 0}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${statsByDoctor[doc]?.eval_sug > 0 ? 'bg-teal-100 text-teal-700' : 'text-slate-300'}`}>
                                                {statsByDoctor[doc]?.eval_sug || 0}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${statsByDoctor[doc]?.pcr > 0 ? 'bg-rose-100 text-rose-700' : 'text-slate-300'}`}>
                                                {statsByDoctor[doc]?.pcr || 0}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${statsByDoctor[doc]?.utsna > 0 ? 'bg-amber-100 text-amber-700' : 'text-slate-300'}`}>
                                                {statsByDoctor[doc]?.utsna || 0}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <button 
                                                onClick={() => generateMonthlyReport(doc)}
                                                className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-2xl transition-all"
                                                title="Descargar Reporte Mensual"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-5">
                                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default InterconsultasDashboard;


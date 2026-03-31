import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { Interconsultation } from '../types';
import { DOCTORS } from '../constants';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const InterconsultasDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [interconsultations, setInterconsultations] = useState<Interconsultation[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getUTCMonth());
    const [selectedDoctor, setSelectedDoctor] = useState<string>('all');

    const months = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

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

    const statsByDoctor = useMemo(() => {
        const stats: { [key: string]: { total: number, pending: number, completed: number, admitted: number } } = {};
        
        DOCTORS.forEach(doc => {
            stats[doc] = { total: 0, pending: 0, completed: 0, admitted: 0 };
        });

        filteredDataByMonth.forEach(ic => {
            if (ic.responders && stats[ic.responders]) {
                stats[ic.responders].total++;
                if (ic.status === 'pending') stats[ic.responders].pending++;
                if (ic.status === 'completed') stats[ic.responders].completed++;
                if (ic.status === 'admitted') stats[ic.responders].admitted++;
            }
        });

        return stats;
    }, [filteredDataByMonth]);

    const generateMonthlyReport = (doctorName: string) => {
        const doc = new jsPDF({ orientation: 'landscape' });
        const reportMonth = months[selectedMonth];
        const data = filteredDataByMonth.filter(ic => doctorName === 'all' ? true : ic.responders === doctorName);

        // Header
        doc.setFontSize(20);
        doc.setTextColor(63, 81, 181);
        doc.text('Reporte Mensual de Interconsultas', 14, 22);
        
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(`Médico: ${doctorName === 'all' ? 'Todos los Médicos' : doctorName}`, 14, 32);
        doc.text(`Periodo: ${reportMonth} ${new Date().getFullYear()}`, 14, 38);
        doc.text(`Total Interconsultas: ${data.length}`, 14, 44);

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
            startY: 52,
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
        <div className="min-h-screen bg-[#f8f9fc] flex flex-col font-sans text-slate-900">
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
                {/* Metric Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Total de ICs ({months[selectedMonth]})</p>
                        <h3 className="text-3xl font-black text-slate-900">{filteredDataByMonth.length}</h3>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-wider mb-1">Pendientes de Ingreso</p>
                        <h3 className="text-3xl font-black text-slate-900">{filteredDataByMonth.filter(i => i.status === 'pending').length}</h3>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] font-black text-green-500 uppercase tracking-wider mb-1">Admitidos</p>
                        <h3 className="text-3xl font-black text-slate-900">{filteredDataByMonth.filter(i => i.status === 'admitted').length}</h3>
                    </div>
                    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-wider mb-1">Completados</p>
                        <h3 className="text-3xl font-black text-slate-900">{filteredDataByMonth.filter(i => i.status === 'completed').length}</h3>
                    </div>
                </div>

                {/* Main Content Area */}
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
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center text-amber-500">Pendientes</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center text-green-500">Admitidos</th>
                                    <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center text-indigo-500">Completados</th>
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
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${statsByDoctor[doc]?.pending > 0 ? 'bg-amber-100 text-amber-700' : 'text-slate-300'}`}>
                                                {statsByDoctor[doc]?.pending || 0}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${statsByDoctor[doc]?.admitted > 0 ? 'bg-green-100 text-green-700' : 'text-slate-300'}`}>
                                                {statsByDoctor[doc]?.admitted || 0}
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className={`px-2 py-1 rounded-lg text-[10px] font-black ${statsByDoctor[doc]?.completed > 0 ? 'bg-indigo-100 text-indigo-700' : 'text-slate-300'}`}>
                                                {statsByDoctor[doc]?.completed || 0}
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

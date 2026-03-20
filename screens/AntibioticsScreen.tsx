
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { Patient } from '../types';

const AntibioticsScreen: React.FC = () => {
    const navigate = useNavigate();
    const [patients, setPatients] = useState<Patient[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAntibioticPatients();
    }, []);

    const fetchAntibioticPatients = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('patients')
                .select('*')
                .order('bed', { ascending: true });

            if (error) throw error;

            if (data) {
                const mappedPatients: Patient[] = data.map((p: any) => ({
                    ...p,
                    dni: p.dni,
                    hc: p.hc,
                    id: p.id,
                    bed: p.bed,
                    name: p.name,
                    acuity: p.acuity,
                    dob: p.dob,
                    allergies: p.allergies || [],
                    admitDate: p.admit_date,
                    isbarStatus: p.isbar_status,
                    lastValidated: p.last_validated,
                    nurse: p.nurse,
                    nurseAvatar: p.nurse_avatar || `https://i.pravatar.cc/150?u=${p.id}`,
                    generalStatus: p.general_status,
                    lastClinicalUpdate: p.last_clinical_update,
                    physicalExam: p.physical_exam
                }));

                // Filter patients receiving antibiotics
                const antibioticPatients = mappedPatients.filter(p => p.physicalExam?.infectious?.antibiotic);
                setPatients(antibioticPatients);
            }
        } catch (error) {
            console.error('Error fetching patients:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 relative font-sans">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3 shadow-sm">
                <div className="max-w-[1600px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/')}>
                        <div className="flex items-center justify-center size-10 rounded-xl bg-blue-600 shadow-sm text-white">
                            <span className="material-symbols-outlined text-2xl filled">medication</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-extrabold leading-tight tracking-tight text-slate-900">Antibioticoterapia</h1>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                Seguimiento de pacientes con cobertura antibiótica
                            </p>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Cama</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Paciente</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Historia Clínica</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Medicamento</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Días</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-center">Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-slate-500 animate-pulse">Cargando datos...</td>
                                    </tr>
                                ) : patients.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <span className="material-symbols-outlined text-4xl mb-2">check_circle</span>
                                                <p className="font-medium">No hay pacientes con antibioticoterapia registrada</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    patients.map((p) => (
                                        <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <span className="text-2xl font-black text-slate-900">#{p.bed}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-900">{p.name}</div>
                                                <div className="text-xs text-slate-400 font-bold uppercase tracking-tight">UCI Unidad 4</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-semibold text-slate-600">
                                                {p.hc || '---'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wide bg-blue-50 text-blue-700 border border-blue-100">
                                                    <span className="material-symbols-outlined text-sm">medication</span>
                                                    {p.physicalExam?.infectious?.antibiotic}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col items-center w-fit">
                                                    <span className="text-xl font-black text-blue-600">{p.physicalExam?.infectious?.antibiotic_days || '?'}/14</span>
                                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Días cumplidos</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <button
                                                    onClick={() => navigate(`/safety/${p.id}`)}
                                                    className="p-2 bg-slate-50 hover:bg-blue-600 hover:text-white text-slate-400 rounded-xl transition-all shadow-sm group"
                                                >
                                                    <span className="material-symbols-outlined text-xl">visibility</span>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AntibioticsScreen;

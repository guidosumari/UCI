
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { Interconsultation } from '../types';

const InterconsultasScreen: React.FC = () => {
    const navigate = useNavigate();
    const [interconsultations, setInterconsultations] = useState<Interconsultation[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Form State
    const [formData, setFormData] = useState<Partial<Interconsultation>>({
        reason: 'evaluacion_pase',
        priority: '3',
        status: 'pending'
    });

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Remove helper fields if present or ensure they match DB types
            const { error } = await supabase.from('interconsultations').insert([{
                ...formData,
                // Ensure numeric fields are numbers
                age: Number(formData.age),
                cvc_attempts: formData.cvc_attempts ? Number(formData.cvc_attempts) : undefined
            }]);

            if (error) throw error;
            setShowModal(false);
            fetchInterconsultations();
            alert('Interconsulta registrada correctamente');
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    const handleChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="min-h-screen bg-slate-50 relative font-sans">
            {/* Header similar to Dashboard */}
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3 shadow-sm">
                <div className="max-w-[1600px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4 cursor-pointer" onClick={() => navigate('/')}>
                        <div className="flex items-center justify-center size-10 rounded-xl bg-indigo-600 shadow-sm text-white">
                            <span className="material-symbols-outlined text-2xl filled">assignment</span>
                        </div>
                        <div>
                            <h1 className="text-xl font-extrabold leading-tight tracking-tight text-slate-900">Interconsultas</h1>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                Gestión de ingresos y procedimientos
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    >
                        <span className="material-symbols-outlined">add</span>
                        Nueva Interconsulta
                    </button>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-6">
                {/* Waiting List Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Paciente</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Edad/Sexo</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Prioridad</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Origen</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Problemas</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Motivo</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500 animate-pulse">Cargando lista de espera...</td>
                                    </tr>
                                ) : interconsultations.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <span className="material-symbols-outlined text-4xl mb-2">assignment_add</span>
                                                <p className="font-medium">No hay pacientes en lista de espera</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    interconsultations.map((ic) => (
                                        <tr key={ic.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer">
                                            <td className="px-6 py-4">
                                                <div className="font-bold text-slate-900">{ic.patient_name}</div>
                                                <div className="text-xs text-slate-400 font-bold uppercase tracking-tight">HC: {ic.hc || '---'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-semibold text-slate-700">{ic.age} años</div>
                                                <div className="text-xs text-slate-400">{ic.sex === 'M' ? 'Masculino' : 'Femenino'}</div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {ic.priority ? (
                                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wide
                                                        ${ic.priority === '1' ? 'bg-red-50 text-red-600 border border-red-100' :
                                                            ic.priority === '2' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                                                'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                                                        {ic.priority === '1' && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span></span>}
                                                        Prioridad {ic.priority}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400 font-bold">Sin prioridad</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-slate-700">{ic.service_origin}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase">Cama {ic.bed_number}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    {ic.health_problem_1 && (
                                                        <div className="text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                                                            <span className="size-1 rounded-full bg-indigo-400"></span>
                                                            {ic.health_problem_1}
                                                        </div>
                                                    )}
                                                    {ic.health_problem_2 && (
                                                        <div className="text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded flex items-center gap-1">
                                                            <span className="size-1 rounded-full bg-slate-300"></span>
                                                            {ic.health_problem_2}
                                                        </div>
                                                    )}
                                                    {!ic.health_problem_1 && !ic.health_problem_2 && (
                                                        <span className="text-[10px] italic text-slate-400">---</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="inline-block px-2 py-1 rounded border border-slate-200 bg-white text-xs font-bold text-slate-600 uppercase tracking-tight">
                                                    {ic.reason?.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${ic.status === 'pending' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-green-50 text-green-600 border-green-100'}`}>
                                                    {ic.status === 'pending' ? 'Pendiente' : 'Admitido'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>

            {/* Modal Form */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10 shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-slate-800">Registrar Interconsulta</h2>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Solicitud de evaluación UCIN</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-red-500 rounded-full p-2 transition">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">

                            {/* Sección Datos Paciente */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className="md:col-span-2">
                                    <label className="label-std">Nombre del Paciente</label>
                                    <input required type="text" className="input-std" onChange={e => handleChange('patient_name', e.target.value)} />
                                </div>
                                <div>
                                    <label className="label-std">Edad</label>
                                    <input type="number" className="input-std" onChange={e => handleChange('age', e.target.value)} />
                                </div>
                                <div>
                                    <label className="label-std">Sexo</label>
                                    <select className="input-std" onChange={e => handleChange('sex', e.target.value)}>
                                        <option value="">...</option>
                                        <option value="M">Masculino</option>
                                        <option value="F">Femenino</option>
                                    </select>
                                </div>
                                <div className="md:col-span-1">
                                    <label className="label-std">HC</label>
                                    <input type="text" className="input-std" onChange={e => handleChange('hc', e.target.value)} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="label-std">Servicio Procedencia</label>
                                    <input type="text" className="input-std" onChange={e => handleChange('service_origin', e.target.value)} />
                                </div>
                                <div className="md:col-span-1">
                                    <label className="label-std">Nro Cama</label>
                                    <input type="text" className="input-std" onChange={e => handleChange('bed_number', e.target.value)} />
                                </div>
                            </div>

                            <div className="h-px bg-slate-100 my-4"></div>

                            {/* Sección Motivo */}
                            <div>
                                <label className="label-std text-indigo-600 mb-2 block">Motivo de Interconsulta</label>
                                <select
                                    className="w-full border-2 border-indigo-100 rounded-xl p-3 text-sm font-bold text-indigo-900 bg-indigo-50/50 focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition-all"
                                    value={formData.reason}
                                    onChange={e => handleChange('reason', e.target.value)}
                                >
                                    <option value="evaluacion_pase">Evaluación y Pase</option>
                                    <option value="procedimiento">Procedimiento</option>
                                    <option value="pcr">PCR</option>
                                    <option value="ustna">USTNA</option>
                                </select>
                            </div>

                            {/* Lógica Condicional: Procedimiento */}
                            {formData.reason === 'procedimiento' && (
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div>
                                        <label className="label-std">Tipo de Procedimiento</label>
                                        <select className="input-std" onChange={e => handleChange('procedure_type', e.target.value)}>
                                            <option value="">Seleccionar...</option>
                                            <option value="cvc">Colocación de CVC</option>
                                            <option value="intubacion">Intubación Orotráqueal</option>
                                        </select>
                                    </div>

                                    {formData.procedure_type === 'cvc' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                            <div className="md:col-span-2">
                                                <label className="label-std">Lugar de Realización</label>
                                                <input type="text" className="input-std" placeholder="Ej: UCI, Emergencia..." onChange={e => handleChange('cvc_location', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="label-std">Nro Intentos</label>
                                                <input type="number" className="input-std" onChange={e => handleChange('cvc_attempts', e.target.value)} />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="label-std">Operadores (Asistente/Residente)</label>
                                                <input type="text" className="input-std" placeholder="Dr. X / Res. Y" onChange={e => handleChange('cvc_operators', e.target.value)} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Lógica Condicional: Evaluación y Pase */}
                            {formData.reason === 'evaluacion_pase' && (
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="label-std">Problema de Salud #1</label>
                                            <input type="text" className="input-std" placeholder="Principal problema activo" onChange={e => handleChange('health_problem_1', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="label-std">Problema de Salud #2</label>
                                            <input type="text" className="input-std" placeholder="Secundario o comorbilidad" onChange={e => handleChange('health_problem_2', e.target.value)} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="label-std">Prioridad de Admisión</label>
                                        <select className="input-std border-indigo-200 bg-white font-bold text-slate-700" onChange={e => handleChange('priority', e.target.value)}>
                                            <option value="3">Seleccionar Prioridad...</option>
                                            <option value="1">Prioridad 1 (Crítico Inestable)</option>
                                            <option value="2">Prioridad 2 (Crítico Estable)</option>
                                            <option value="3">Prioridad 3 (Estable / Recuperable)</option>
                                            <option value="4A">Prioridad 4A</option>
                                            <option value="4B">Prioridad 4B</option>
                                        </select>
                                        <p className="text-[10px] text-slate-400 mt-1 pl-1">Establece el orden en la lista de espera.</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200 mt-2">
                                        <div>
                                            <label className="label-std">Fecha Respuesta IC</label>
                                            <input type="datetime-local" className="input-std" onChange={e => handleChange('response_date', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="label-std">Médico Responde</label>
                                            <input type="text" className="input-std" placeholder="Médico / Residente" onChange={e => handleChange('responders', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 sticky bottom-0 bg-white pb-2">
                                <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-sm py-4 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-1">
                                    Registrar Interconsulta
                                </button>
                            </div>

                        </form>
                    </div>
                </div>
            )}

            <style>{`
                .label-std {
                    display: block;
                    font-size: 0.65rem;
                    font-weight: 800;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 0.25rem;
                }
                .input-std {
                    width: 100%;
                    border: 1px solid #e2e8f0;
                    border-radius: 0.75rem;
                    padding: 0.6rem 0.75rem;
                    font-size: 0.875rem;
                    font-weight: 600;
                    color: #334155;
                    background-color: #fff;
                    transition: all 0.2s;
                    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
                }
                .input-std:focus {
                    border-color: #4f46e5;
                    ring: 2px solid #4f46e5;
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
                }
            `}</style>
        </div>
    );
};

export default InterconsultasScreen;

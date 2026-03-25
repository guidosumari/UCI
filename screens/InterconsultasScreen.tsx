import React, { useState, useEffect, useRef } from 'react';
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

    // Autocomplete State
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeSearchField, setActiveSearchField] = useState<'name' | 'hc' | null>(null);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeout = useRef<NodeJS.Timeout | null>(null);

    const [viewMode, setViewMode] = useState<'waiting' | 'pcr' | 'all'>('waiting');

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

    const handleNew = () => {
        setFormData({
            reason: viewMode === 'pcr' ? 'pcr' : 'evaluacion_pase',
            priority: viewMode === 'pcr' ? '1' : '3',
            status: 'pending',
            dni: ''
        });
        setShowModal(true);
    };

    const handleEdit = (ic: Interconsultation) => {
        let editedIc = { ...ic };
        // Reverse soft-mapping for display in the form
        if (ic.reason === 'evaluacion_pase' && ic.health_problem_1?.startsWith('(SUG) ')) {
            editedIc.reason = 'evaluacion_sugerencias';
            editedIc.health_problem_1 = ic.health_problem_1.substring(6);
        }
        setFormData(editedIc);
        setShowModal(true);
    };

    const handleLookup = async (field: 'hc' | 'dni', value: string) => {
        if (!value) return;
        
        try {
            const { data, error } = await supabase
                .from('patients')
                .select('name, dob, sex, hc, dni')
                .eq(field, value)
                .maybeSingle();

            if (error) throw error;
            
            if (data) {
                let age = undefined;
                if (data.dob) {
                    const birthYear = new Date(data.dob).getFullYear();
                    const currentYear = new Date().getFullYear();
                    age = currentYear - birthYear;
                }

                setFormData(prev => ({
                    ...prev,
                    patient_name: data.name,
                    hc: data.hc,
                    dni: data.dni,
                    sex: data.sex,
                    age: age
                }));
            }
        } catch (err) {
            console.error('Error lookup patient:', err);
        }
    };

    const searchPatients = async (queryStr: string, type: 'name' | 'hc') => {
        const query = queryStr.trim();
        if (!query || query.length < 3) {
            setSuggestions([]);
            setShowSuggestions(false);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        setShowSuggestions(true);
        setActiveSearchField(type);

        const searchTimeout = setTimeout(() => {
            setIsSearching(false);
        }, 8000);

        try {
            const allResults: any[] = [];
            
            // 1. FIRST: Search in local state (Interconsultations already loaded)
            const localMatches = interconsultations.filter(ic => 
                (ic.patient_name?.toLowerCase().includes(query.toLowerCase())) ||
                (ic.hc?.toLowerCase().includes(query.toLowerCase())) ||
                (ic.dni?.toLowerCase().includes(query.toLowerCase()))
            );
            
            localMatches.forEach(ic => {
                allResults.push({ 
                    name: ic.patient_name, 
                    hc: ic.hc, 
                    dni: ic.dni, 
                    sex: ic.sex, 
                    age: ic.age,
                    source: 'local'
                });
            });

            const term = `%${query}%`;

            // 2. REMOTE: Try Patients Table
            try {
                const { data, error } = await supabase
                    .from('patients')
                    .select('name, dob, sex, hc, dni')
                    .or(`name.ilike.${term},hc.ilike.${term},dni.ilike.${term}`)
                    .limit(10);
                
                if (!error && data) {
                    data.forEach(p => {
                        let age = undefined;
                        if (p.dob) {
                            const birthYear = new Date(p.dob).getFullYear();
                            const currentYear = new Date().getFullYear();
                            age = currentYear - birthYear;
                        }
                        allResults.push({ name: p.name, hc: p.hc, dni: p.dni, sex: p.sex, age, source: 'patients' });
                    });
                }
            } catch (err) {}

            // 3. REMOTE: Try Interconsultations Table (Extended Search)
            try {
                const { data, error } = await supabase
                    .from('interconsultations')
                    .select('patient_name, age, sex, hc, dni')
                    .or(`patient_name.ilike.${term},hc.ilike.${term},dni.ilike.${term}`)
                    .order('created_at', { ascending: false })
                    .limit(10);
                
                if (!error && data) {
                    data.forEach(ic => {
                        allResults.push({ name: ic.patient_name, hc: ic.hc, dni: ic.dni, sex: ic.sex, age: ic.age, source: 'remote_ic' });
                    });
                }
            } catch (err) {}

            // Fallback: Exact match for numbers
            if (allResults.length === 0 && /^\d+$/.test(query)) {
                try {
                    const { data } = await supabase.from('interconsultations').select('patient_name, age, sex, hc, dni').eq('hc', query).limit(1);
                    if (data) data.forEach(ic => allResults.push({ name: ic.patient_name, hc: ic.hc, dni: ic.dni, sex: ic.sex, age: ic.age, source: 'exact' }));
                } catch (e) {}
            }

            // Deduplicate
            const patientMap = new Map();
            allResults.forEach(item => {
                const key = (item.hc || item.dni || item.name || '').toString().toLowerCase().trim();
                if (!key) return;
                if (!patientMap.has(key) || (!patientMap.get(key).hc && item.hc)) {
                    patientMap.set(key, item);
                }
            });

            const uniqueResults = Array.from(patientMap.values()).slice(0, 5);
            setSuggestions(uniqueResults);
            setIsSearching(false);
            clearTimeout(searchTimeout);
        } catch (err: any) {
            console.error('Search error:', err);
            setIsSearching(false);
            clearTimeout(searchTimeout);
        }
    };

    const handleSearchChange = (field: 'patient_name' | 'hc', value: string) => {
        handleChange(field, value);
        
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        
        searchTimeout.current = setTimeout(() => {
            searchPatients(value, field === 'patient_name' ? 'name' : 'hc');
        }, 300);
    };

    const selectSuggestion = (patient: any) => {
        setFormData(prev => ({
            ...prev,
            patient_name: patient.name,
            hc: patient.hc,
            dni: patient.dni,
            sex: patient.sex,
            age: patient.age
        }));
        setShowSuggestions(false);
        setActiveSearchField(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const { dni, ...cleanFormData } = formData;
            const payload = {
                ...cleanFormData,
                // Soft-mapping: evaluacion_sugerencias -> evaluacion_pase + prefix
                reason: formData.reason === 'evaluacion_sugerencias' ? 'evaluacion_pase' : formData.reason,
                health_problem_1: formData.reason === 'evaluacion_sugerencias' 
                    ? `(SUG) ${formData.health_problem_1 || ''}`
                    : formData.health_problem_1,
                // Ensure numeric fields are numbers
                age: formData.age ? Number(formData.age) : undefined,
                cvc_attempts: formData.cvc_attempts ? Number(formData.cvc_attempts) : undefined
            };

            let error;
            if (formData.id) {
                const { error: updateError } = await supabase
                    .from('interconsultations')
                    .update(payload)
                    .eq('id', formData.id);
                error = updateError;
            } else {
                const { error: insertError } = await supabase
                    .from('interconsultations')
                    .insert([payload]);
                error = insertError;
            }

            if (error) throw error;
            setShowModal(false);
            fetchInterconsultations();
            alert(formData.id ? 'Interconsulta actualizada correctamente' : 'Interconsulta registrada correctamente');
        } catch (err: any) {
            alert('Error: ' + err.message);
        }
    };

    const renderStatusBadge = (status?: string, priority?: string) => {
        if (status === 'pending') {
            if (priority === 'PCR') return <span className="text-[10px] font-black uppercase px-2 py-1 rounded border bg-amber-50 text-amber-600 border-amber-100">Pendiente Ingreso</span>;
            return (
                <span className="text-[10px] font-black uppercase px-2 py-1 rounded border bg-amber-50 text-amber-600 border-amber-100">
                    Pendiente Ingreso
                </span>
            );
        }
        if (status === 'admitted') {
            return (
                <span className="text-[10px] font-black uppercase px-2 py-1 rounded border bg-green-50 text-green-600 border-green-100">
                    Admitido
                </span>
            );
        }
        if (status === 'completed' || status === 'fallecido') {
            const isFallecido = priority === 'PCR' || status === 'fallecido';
            if (!isFallecido && (priority === '4A' || priority === '4B')) {
                return (
                    <span className="text-[10px] font-black uppercase px-2 py-1 rounded border bg-indigo-50 text-indigo-600 border-indigo-100 italic">
                        No Tributario
                    </span>
                );
            }
            return (
                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${isFallecido ? 'bg-red-50 text-red-600 border-red-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                    {isFallecido ? 'Fallecido' : 'Completado'}
                </span>
            );
        }
        if (status === 'vivo') return <span className="text-[10px] font-black uppercase px-2 py-1 rounded border bg-amber-50 text-amber-600 border-amber-100">Pendiente Ingreso</span>;
        
        return <span className="text-[10px] font-black uppercase px-2 py-1 rounded border bg-slate-50 text-slate-400 border-slate-100">---</span>;
    };

    const handleChange = (field: string, value: any) => {
        setFormData(prev => {
            const newState = { ...prev, [field]: value };
            if (field === 'priority') {
                if (value === '4A' || value === '4B') {
                    newState.status = 'completed';
                } else if (prev.status === 'completed') {
                    newState.status = 'pending';
                }
            }
            return newState;
        });
    };

    return (
        <div className="min-h-screen bg-slate-50 relative font-sans">
            {/* Header similar to Dashboard */}
            <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm transition-all duration-300">
                <div className="max-w-[1600px] mx-auto px-4 md:px-6">
                    {/* Top Row: Navigation and Action */}
                    <div className="flex items-center justify-between py-3 gap-3">
                        <div className="flex items-center gap-2 md:gap-3 cursor-pointer min-w-0" onClick={() => navigate('/')}>
                            <div className="flex items-center justify-center size-9 md:size-10 rounded-xl bg-indigo-600 shadow-sm text-white shrink-0">
                                <span className="material-symbols-outlined text-xl md:text-2xl filled hidden sm:inline-block">arrow_back</span>
                                <span className="sm:hidden font-black text-lg">{'<'}</span>
                            </div>
                            <div className="truncate">
                                <h1 className="text-base md:text-xl font-extrabold leading-tight tracking-tight text-slate-900 truncate">
                                    {viewMode === 'waiting' ? 'Lista de Espera UCI' : viewMode === 'pcr' ? 'Pacientes PCR' : 'Todas las Interconsultas'}
                                </h1>
                                <p className="text-[9px] md:text-[10px] text-slate-500 font-bold uppercase tracking-wider hidden sm:block">
                                    {viewMode === 'waiting' ? 'Pacientes Prioridad 1, 2 y 3' : 
                                     viewMode === 'pcr' ? 'Pacientes con antecedente de Paro' : 
                                     'Historial completo de evaluaciones'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            {/* Desktop View Modes */}
                            <div className="hidden lg:flex bg-slate-100 p-1 rounded-xl border border-slate-200 mr-2">
                                <button onClick={() => setViewMode('waiting')} className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${viewMode === 'waiting' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Espera</button>
                                <button onClick={() => setViewMode('pcr')} className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${viewMode === 'pcr' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>PCR</button>
                                <button onClick={() => setViewMode('all')} className={`px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${viewMode === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Todas</button>
                            </div>

                            <button
                                onClick={handleNew}
                                className="px-3 md:px-5 py-2 md:py-2.5 rounded-xl font-bold transition flex items-center justify-center shadow-lg hover:shadow-xl hover:-translate-y-0.5 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] md:text-sm whitespace-nowrap"
                            >
                                <span className="hidden sm:inline">Registrar Nueva IC</span>
                                <span className="sm:hidden">Nueva IC</span>
                            </button>
                        </div>
                    </div>

                    {/* Bottom Row (Mobile Only): View Switcher */}
                    <div className="lg:hidden flex items-center justify-center pb-3 pt-1 overflow-x-auto no-scrollbar">
                        <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200 w-full max-w-sm">
                            <button 
                                onClick={() => setViewMode('waiting')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'waiting' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                <span>Espera</span>
                            </button>
                            <button 
                                onClick={() => setViewMode('pcr')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'pcr' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                <span>PCR</span>
                            </button>
                            <button 
                                onClick={() => setViewMode('all')}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'all' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                            >
                                <span>Todas</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-4 md:p-6">
                {/* Waiting List Table (Desktop) */}
                <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Paciente</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Edad/Sexo</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Prioridad</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Origen</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider">Problemas</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-center">Motivo</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-center">Médico</th>
                                    <th className="px-6 py-4 text-xs font-black text-slate-500 uppercase tracking-wider text-center">Estado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-slate-500 animate-pulse">Cargando lista de espera...</td>
                                    </tr>
                                ) : interconsultations.filter(ic => {
                                        if (viewMode === 'waiting') return ic.status === 'pending';
                                        if (viewMode === 'pcr') return ic.reason === 'pcr';
                                        return true;
                                    }).length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center justify-center text-slate-400">
                                                <span className="material-symbols-outlined text-4xl mb-2">
                                                    {viewMode === 'waiting' ? 'assignment_add' : 'emergency'}
                                                </span>
                                                <p className="font-medium">
                                                    {viewMode === 'waiting' ? 'No hay pacientes en lista de espera' : 
                                                     viewMode === 'pcr' ? 'No hay pacientes PCR registrados' : 
                                                     'No hay interconsultas registradas'}
                                                </p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    interconsultations
                                        .filter(ic => {
                                            if (viewMode === 'waiting') return ic.status === 'pending';
                                            if (viewMode === 'pcr') return ic.reason === 'pcr';
                                            return true;
                                        })
                                        .map((ic) => (
                                        <tr key={ic.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => handleEdit(ic)}>
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
                                                            {ic.health_problem_1.startsWith('(SUG) ') ? ic.health_problem_1.substring(6) : ic.health_problem_1}
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
                                            <td className="px-6 py-4 text-center">
                                                <span className="inline-block px-2 py-1 rounded border border-slate-200 bg-white text-xs font-bold text-slate-600 uppercase tracking-tight">
                                                    {ic.reason === 'evaluacion_pase' && ic.health_problem_1?.startsWith('(SUG) ') 
                                                        ? 'Evaluación y Sugerencias' 
                                                        : ic.reason?.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="text-xs font-bold text-slate-600 truncate max-w-[120px]">
                                                    {ic.responders || '---'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {renderStatusBadge(ic.status, ic.reason === 'pcr' ? 'PCR' : ic.priority)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden flex flex-col gap-4 mt-2">
                    {loading ? (
                        <div className="text-center p-8 text-slate-500 font-bold animate-pulse">Cargando lista de espera...</div>
                                    ) : interconsultations.filter(ic => {
                        if (viewMode === 'waiting') return ic.status === 'pending';
                        if (viewMode === 'pcr') return ic.reason === 'pcr';
                        return true;
                    }).length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center flex flex-col items-center justify-center text-slate-400">
                            <span className="material-symbols-outlined text-4xl mb-2">
                                {viewMode === 'waiting' ? 'assignment_add' : 'emergency'}
                            </span>
                            <p className="font-medium text-sm">
                                {viewMode === 'waiting' ? 'No hay pacientes en espera' : 
                                 viewMode === 'pcr' ? 'No hay pacientes PCR' :
                                 'No hay interconsultas'}
                            </p>
                        </div>
                    ) : (
                        interconsultations
                                .filter(ic => {
                                    if (viewMode === 'waiting') return ic.status === 'pending';
                                    if (viewMode === 'pcr') return ic.reason === 'pcr';
                                    return true;
                                })
                            .map((ic) => (
                            <div key={ic.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col relative overflow-hidden cursor-pointer hover:border-indigo-300 transition-all border-l-4" style={{ borderLeftColor: ic.priority === '1' ? '#ef4444' : ic.priority === '2' ? '#f59e0b' : '#818cf8' }} onClick={() => handleEdit(ic)}>
                                <div className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div className="min-w-0 flex-1 mr-2">
                                            <div className="font-extrabold text-slate-900 leading-tight text-base truncate uppercase">{ic.patient_name}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                                                HC: <span className="text-slate-600">{ic.hc || '----'}</span> • {ic.age}a • {ic.sex === 'M' ? 'Masc' : 'Fem'}
                                            </div>
                                        </div>
                                        {renderStatusBadge(ic.status, ic.reason === 'pcr' ? 'PCR' : ic.priority)}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        {ic.priority && (
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide
                                                ${ic.priority === '1' ? 'bg-red-50 text-red-600 border border-red-100' :
                                                    ic.priority === '2' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                                                        'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                                                {ic.priority === '1' && <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span></span>}
                                                Prio {ic.priority}
                                            </span>
                                        )}
                                        <div className="text-[10px] font-bold text-slate-600 bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200 flex items-center gap-1 capitalize">
                                            <span className="material-symbols-outlined text-[13px]">meeting_room</span>
                                            {ic.service_origin || '---'} (C-{ic.bed_number})
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1.5 py-2 px-3 bg-slate-50/50 rounded-xl border border-slate-100">
                                        {ic.health_problem_1 && (
                                            <div className="flex items-start gap-2 text-[11px] font-bold text-slate-600">
                                                <span className="size-1.5 rounded-full bg-indigo-500 mt-1 shrink-0"></span>
                                                <span className="italic">{ic.health_problem_1.startsWith('(SUG) ') ? ic.health_problem_1.substring(6) : ic.health_problem_1}</span>
                                            </div>
                                        )}
                                        {ic.health_problem_2 && (
                                            <div className="flex items-start gap-2 text-[11px] font-bold text-slate-500">
                                                <span className="size-1.5 rounded-full bg-slate-300 mt-1 shrink-0"></span>
                                                <span className="italic font-medium">{ic.health_problem_2}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="border-t border-slate-100 bg-slate-50/30 px-4 py-2.5 flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <div className="size-6 rounded-full bg-indigo-100 flex items-center justify-center">
                                            <span className="material-symbols-outlined text-xs text-indigo-600">info</span>
                                        </div>
                                         <div className="text-[10px] font-black text-indigo-700 uppercase tracking-tight">
                                             {ic.reason === 'evaluacion_pase' && ic.health_problem_1?.startsWith('(SUG) ') 
                                                 ? 'Evaluación y Sugerencias' 
                                                 : ic.reason?.replace('_', ' ')}
                                         </div>
                                    </div>
                                    {ic.responders && (
                                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400 uppercase">
                                            <span className="material-symbols-outlined text-[12px]">clinical_notes</span>
                                            {ic.responders}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>

            {/* Modal Form */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur z-10 shrink-0">
                            <div>
                                <h2 className="text-xl font-black text-slate-800">{formData.id ? 'Editar Interconsulta' : 'Registrar Interconsulta'}</h2>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Solicitud de evaluación UCIN</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-red-500 rounded-full p-2 transition">
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">

                            {/* Sección Datos Paciente */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div className={`md:col-span-2 relative ${showSuggestions && activeSearchField === 'name' ? 'z-50' : ''}`}>
                                    <label className="label-std">Apellido y Nombre de paciente</label>
                                    <input required type="text" className="input-std" value={formData.patient_name || ''} 
                                        onChange={e => handleSearchChange('patient_name', e.target.value)} 
                                        onFocus={() => { if ((formData.patient_name?.length || 0) >= 3) { searchPatients(formData.patient_name!, 'name'); } }}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 250)}
                                    />
                                    {showSuggestions && activeSearchField === 'name' && (
                                        <ul className="absolute z-[60] w-full bg-white border border-slate-200 mt-1 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                                            {isSearching ? (
                                                <li className="p-4 text-center text-slate-400 text-xs italic">Buscando...</li>
                                            ) : suggestions.length === 0 ? (
                                                <li className="p-4 text-center text-slate-400 text-[11px] italic">No se encontraron coincidencias exactas</li>
                                            ) : (
                                                suggestions.map((s, i) => (
                                                    <li key={i} onMouseDown={() => selectSuggestion(s)} className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors">
                                                        <div className="flex justify-between items-start">
                                                            <div className="font-bold text-slate-800 text-[13px]">{s.name}</div>
                                                            {interconsultations.some(ic => ic.status === 'pending' && (ic.hc === s.hc || ic.dni === s.dni)) && (
                                                                <span className="text-[9px] bg-amber-100 text-amber-700 font-black px-1.5 py-0.5 rounded uppercase">Pendiente</span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 flex gap-3 mt-1 uppercase tracking-wider">
                                                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">HC: {s.hc || '---'}</span>
                                                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">DNI: {s.dni || '---'}</span>
                                                        </div>
                                                    </li>
                                                ))
                                            )}
                                        </ul>
                                    )}
                                </div>
                                <div>
                                    <label className="label-std">Edad</label>
                                    <input type="number" className="input-std" value={formData.age || ''} onChange={e => handleChange('age', e.target.value)} />
                                </div>
                                <div>
                                    <label className="label-std">Sexo</label>
                                    <select className="input-std" value={formData.sex || ''} onChange={e => handleChange('sex', e.target.value)}>
                                        <option value="">...</option>
                                        <option value="M">Masculino</option>
                                        <option value="F">Femenino</option>
                                    </select>
                                </div>
                                <div className={`relative ${showSuggestions && activeSearchField === 'hc' ? 'z-50' : ''}`}>
                                    <label className="label-std">HC</label>
                                    <input 
                                        type="text" 
                                        className="input-std" 
                                        value={formData.hc || ''} 
                                        onChange={e => handleSearchChange('hc', e.target.value)}
                                        onFocus={() => { if ((formData.hc?.length || 0) >= 3) { searchPatients(formData.hc!, 'hc'); } }}
                                        onBlur={e => {
                                            handleLookup('hc', e.target.value);
                                            setTimeout(() => setShowSuggestions(false), 250);
                                        }}
                                    />
                                    {showSuggestions && activeSearchField === 'hc' && (
                                        <ul className="absolute z-[60] w-full bg-white border border-slate-200 mt-1 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                                            {isSearching ? (
                                                <li className="p-4 text-center text-slate-400 text-xs italic">Buscando...</li>
                                            ) : suggestions.length === 0 ? (
                                                <li className="p-4 text-center text-slate-400 text-[11px] italic">No se encontraron coincidencias exactas</li>
                                            ) : (
                                                suggestions.map((s, i) => (
                                                    <li key={i} onMouseDown={() => selectSuggestion(s)} className="p-3 hover:bg-indigo-50 cursor-pointer border-b border-slate-100 last:border-0 transition-colors">
                                                        <div className="flex justify-between items-start">
                                                            <div className="font-bold text-slate-800 text-[13px]">{s.name}</div>
                                                            {interconsultations.some(ic => ic.status === 'pending' && (ic.hc === s.hc || ic.dni === s.dni)) && (
                                                                <span className="text-[9px] bg-amber-100 text-amber-700 font-black px-1.5 py-0.5 rounded uppercase">Pendiente</span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 flex gap-3 mt-1 uppercase tracking-wider">
                                                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">HC: {s.hc || '---'}</span>
                                                        </div>
                                                    </li>
                                                ))
                                            )}
                                        </ul>
                                    )}
                                </div>
                                <div className="md:col-span-1">
                                    <label className="label-std">DNI</label>
                                    <input 
                                        type="text" 
                                        className="input-std" 
                                        value={formData.dni || ''} 
                                        onChange={e => handleChange('dni', e.target.value)}
                                        onBlur={e => handleLookup('dni', e.target.value)}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="label-std">Servicio Procedencia</label>
                                    <select className="input-std" value={formData.service_origin || ''} onChange={e => handleChange('service_origin', e.target.value)}>
                                        <option value="">Seleccionar...</option>
                                        <option value="Medicina Interna">Medicina Interna</option>
                                        <option value="Cardiologia">Cardiología</option>
                                        <option value="Neumologia">Neumología</option>
                                        <option value="Neurologia">Neurología</option>
                                        <option value="Nefrologia">Nefrología</option>
                                        <option value="Oncologia">Oncología</option>
                                        <option value="Emergencia">Emergencia</option>
                                        <option value="Reumatologia">Reumatología</option>
                                        <option value="Infectologia">Infectología</option>
                                        <option value="Cirugia General">Cirugía General</option>
                                        <option value="Cirugia Torax Cardiovascular">Cirugía Tórax Cardiovascular</option>
                                        <option value="Cirugia Oncologica">Cirugía Oncológica</option>
                                        <option value="Neurocirugia">Neurocirugía</option>
                                        <option value="Ginecologia">Ginecología</option>
                                        <option value="UCI">UCI</option>
                                        <option value="Cirugia de Cabeza y Cuello">Cirugía de Cabeza y Cuello</option>
                                    </select>
                                </div>
                                <div className="md:col-span-1">
                                    <label className="label-std">Nro Cama</label>
                                    <input type="text" className="input-std" value={formData.bed_number || ''} onChange={e => handleChange('bed_number', e.target.value)} />
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
                                    <option value="evaluacion_sugerencias">Evaluación y Sugerencias</option>
                                </select>
                            </div>

                            {/* Lógica Condicional: Procedimiento */}
                            {formData.reason === 'procedimiento' && (
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div>
                                        <label className="label-std">Tipo de Procedimiento</label>
                                        <select className="input-std" value={formData.procedure_type || ''} onChange={e => handleChange('procedure_type', e.target.value)}>
                                            <option value="">Seleccionar...</option>
                                            <option value="cvc">Colocación de CVC</option>
                                            <option value="intubacion">Intubación Orotráqueal</option>
                                        </select>
                                    </div>

                                    {formData.procedure_type === 'cvc' && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                            <div className="md:col-span-2">
                                                <label className="label-std">Lugar de Realización</label>
                                                <input type="text" className="input-std" placeholder="Ej: UCI, Emergencia..." value={formData.cvc_location || ''} onChange={e => handleChange('cvc_location', e.target.value)} />
                                            </div>
                                            <div>
                                                <label className="label-std">Nro Intentos</label>
                                                <input type="number" className="input-std" value={formData.cvc_attempts || ''} onChange={e => handleChange('cvc_attempts', e.target.value)} />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="label-std">Operadores (Asistente/Residente)</label>
                                                <input type="text" className="input-std" placeholder="Dr. X / Res. Y" value={formData.cvc_operators || ''} onChange={e => handleChange('cvc_operators', e.target.value)} />
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
                                            <input type="text" className="input-std" placeholder="Principal problema activo" value={formData.health_problem_1 || ''} onChange={e => handleChange('health_problem_1', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="label-std">Problema de Salud #2</label>
                                            <input type="text" className="input-std" placeholder="Secundario o comorbilidad" value={formData.health_problem_2 || ''} onChange={e => handleChange('health_problem_2', e.target.value)} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="label-std">Prioridad de Admisión</label>
                                        <select className="input-std border-indigo-200 bg-white font-bold text-slate-700" value={formData.priority || ''} onChange={e => handleChange('priority', e.target.value)}>
                                            <option value="">Seleccionar Prioridad...</option>
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
                                            <input type="datetime-local" className="input-std" value={formData.response_date ? formData.response_date.slice(0, 16) : ''} onChange={e => handleChange('response_date', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="label-std">Médico Asistente</label>
                                            <select className="input-std" value={formData.responders || ''} onChange={e => handleChange('responders', e.target.value)}>
                                                <option value="">Seleccionar...</option>
                                                <option value="Dr Geng">Dr Geng</option>
                                                <option value="Dr Solorzano">Dr Solorzano</option>
                                                <option value="Dr Ramirez">Dr Ramirez</option>
                                                <option value="Dr Cruz">Dr Cruz</option>
                                                <option value="Dr Diaz">Dr Diaz</option>
                                                <option value="Dr Linares">Dr Linares</option>
                                                <option value="Dr Sumari">Dr Sumari</option>
                                                <option value="Dr Palacios">Dr Palacios</option>
                                                <option value="Dra Quiñones">Dra Quiñones</option>
                                                <option value="Dr Palma">Dr Palma</option>
                                                <option value="Dr Becerra">Dr Becerra</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="label-std">Estado</label>
                                            <select className="input-std" value={formData.status || ''} onChange={e => handleChange('status', e.target.value)}>
                                                {(formData.priority === '1' || formData.priority === '2' || formData.priority === '3' || !formData.priority) ? (
                                                    <>
                                                        <option value="pending">Pendiente Ingreso</option>
                                                        <option value="admitted">Admitido</option>
                                                    </>
                                                ) : (
                                                    <option value="completed">No tributario de área crítica</option>
                                                )}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Lógica Condicional: Evaluación y Sugerencias */}
                            {formData.reason === 'evaluacion_sugerencias' && (
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="label-std">Problema de Salud #1</label>
                                            <input type="text" className="input-std" placeholder="Principal problema activo" value={formData.health_problem_1 || ''} onChange={e => handleChange('health_problem_1', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="label-std">Problema de Salud #2</label>
                                            <input type="text" className="input-std" placeholder="Secundario o comorbilidad" value={formData.health_problem_2 || ''} onChange={e => handleChange('health_problem_2', e.target.value)} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200 mt-2">
                                        <div>
                                            <label className="label-std">Fecha Respuesta IC</label>
                                            <input type="datetime-local" className="input-std" value={formData.response_date ? formData.response_date.slice(0, 16) : ''} onChange={e => handleChange('response_date', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="label-std">Médico Asistente</label>
                                            <select className="input-std" value={formData.responders || ''} onChange={e => handleChange('responders', e.target.value)}>
                                                <option value="">Seleccionar...</option>
                                                <option value="Dr Geng">Dr Geng</option>
                                                <option value="Dr Solorzano">Dr Solorzano</option>
                                                <option value="Dr Ramirez">Dr Ramirez</option>
                                                <option value="Dr Cruz">Dr Cruz</option>
                                                <option value="Dr Diaz">Dr Diaz</option>
                                                <option value="Dr Linares">Dr Linares</option>
                                                <option value="Dr Sumari">Dr Sumari</option>
                                                <option value="Dr Palacios">Dr Palacios</option>
                                                <option value="Dra Quiñones">Dra Quiñones</option>
                                                <option value="Dr Palma">Dr Palma</option>
                                                <option value="Dr Becerra">Dr Becerra</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Lógica Condicional: PCR */}
                            {formData.reason === 'pcr' && (
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4 animate-in fade-in slide-in-from-top-2">
                                    <div className="grid grid-cols-1 gap-4">
                                        <div>
                                            <label className="label-std">Problema de Salud #1</label>
                                            <input type="text" className="input-std" placeholder="Principal problema activo" value={formData.health_problem_1 || ''} onChange={e => handleChange('health_problem_1', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="label-std">Problema de Salud #2</label>
                                            <input type="text" className="input-std" placeholder="Secundario o comorbilidad" value={formData.health_problem_2 || ''} onChange={e => handleChange('health_problem_2', e.target.value)} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="label-std">Prioridad de Admisión</label>
                                        <select className="input-std border-indigo-200 bg-white font-bold text-slate-700" value={formData.priority || ''} onChange={e => handleChange('priority', e.target.value)}>
                                            <option value="">Seleccionar Prioridad...</option>
                                            <option value="1">Prioridad 1 (Crítico Inestable)</option>
                                            <option value="2">Prioridad 2 (Crítico Estable)</option>
                                            <option value="3">Prioridad 3 (Estable / Recuperable)</option>
                                            <option value="4A">Prioridad 4A</option>
                                            <option value="4B">Prioridad 4B</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200 mt-2">
                                        <div>
                                            <label className="label-std">Fecha Respuesta IC</label>
                                            <input type="datetime-local" className="input-std" value={formData.response_date ? formData.response_date.slice(0, 16) : ''} onChange={e => handleChange('response_date', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="label-std">Médico Asistente</label>
                                            <select className="input-std" value={formData.responders || ''} onChange={e => handleChange('responders', e.target.value)}>
                                                <option value="">Seleccionar...</option>
                                                <option value="Dr Geng">Dr Geng</option>
                                                <option value="Dr Solorzano">Dr Solorzano</option>
                                                <option value="Dr Ramirez">Dr Ramirez</option>
                                                <option value="Dr Cruz">Dr Cruz</option>
                                                <option value="Dr Diaz">Dr Diaz</option>
                                                <option value="Dr Linares">Dr Linares</option>
                                                <option value="Dr Sumari">Dr Sumari</option>
                                                <option value="Dr Palacios">Dr Palacios</option>
                                                <option value="Dra Quiñones">Dra Quiñones</option>
                                                <option value="Dr Palma">Dr Palma</option>
                                                <option value="Dr Becerra">Dr Becerra</option>
                                            </select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="label-std">Estado</label>
                                            <select className="input-std" value={formData.status || ''} onChange={e => handleChange('status', e.target.value)}>
                                                <option value="pending">PENDIENTE INGRESO</option>
                                                <option value="completed">FALLECIDO</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="pt-4 sticky bottom-0 bg-white pb-2 flex gap-3">
                                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-sm py-4 rounded-xl transition-all shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-1">
                                    {formData.id ? 'Actualizar Interconsulta' : 'Registrar Interconsulta'}
                                </button>
                                {formData.id && (
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (window.confirm('¿Está seguro de eliminar esta interconsulta?')) {
                                                try {
                                                    const { error } = await supabase.from('interconsultations').delete().eq('id', formData.id);
                                                    if (error) throw error;
                                                    setShowModal(false);
                                                    fetchInterconsultations();
                                                } catch (e: any) {
                                                    alert('Error: ' + e.message);
                                                }
                                            }
                                        }}
                                        className="bg-red-50 hover:bg-red-100 text-red-600 font-black uppercase tracking-widest text-sm px-6 rounded-xl transition-all border border-red-200"
                                    >
                                        Eliminar
                                    </button>
                                )}
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

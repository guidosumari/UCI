import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

interface ClinicalRecord {
    id: string;
    created_at: string;
    note_type: string;
    content: {
        subjective: string;
        objective: string;
        analysis: string;
        plan: string;
    };
    vitals: any;
    user_id: string;
}

interface Props {
    patientId: string;
    patientName: string;
}

const ClinicalHistory: React.FC<Props> = ({ patientId, patientName }) => {
    const { user } = useAuth();
    const [records, setRecords] = useState<ClinicalRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form State
    const [soap, setSoap] = useState({
        subjective: '',
        objective: '',
        analysis: '',
        plan: ''
    });

    useEffect(() => {
        fetchRecords();
    }, [patientId]);

    const fetchRecords = async () => {
        try {
            const { data, error } = await supabase
                .from('clinical_records')
                .select('*')
                .eq('patient_id', patientId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setRecords(data || []);
            if (!data || data.length === 0) {
                setIsAdding(true);
            }
        } catch (err) {
            console.error('Error loading history:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        try {
            // 1. Insert Record
            const { error: insertError } = await supabase.from('clinical_records').insert({
                patient_id: patientId,
                user_id: user.id,
                note_type: 'SOAP', // Default for now
                content: soap,
                vitals: {} // Capture vitals if needed later
            });

            if (insertError) throw insertError;

            // 2. Extract Antibiotic Info if present in any SOAP field
            const fullText = `${soap.subjective} ${soap.objective} ${soap.analysis} ${soap.plan}`;
            // Regex para buscar patrones como "Meropenem día 5" o "Vancomicina dia 3"
            const atbRegex = /(\b[A-Za-z/]{3,}\b)\s+d[íi]a\s+(\d+)/i;
            const match = fullText.match(atbRegex);

            // 3. Update Patient Sync Timestamp and optionally ATB info
            const updatePayload: any = {
                last_clinical_update: new Date().toISOString()
            };

            if (match) {
                // Fetch current physical_exam to merge
                const { data: pData } = await supabase.from('patients').select('physical_exam').eq('id', patientId).single();
                if (pData) {
                    const currentExam = pData.physical_exam || {};
                    const infectious = currentExam.infectious || {};

                    updatePayload.physical_exam = {
                        ...currentExam,
                        infectious: {
                            ...infectious,
                            antibiotic: match[1],
                            antibiotic_days: match[2]
                        }
                    };
                }
            }

            await supabase.from('patients').update(updatePayload).eq('id', patientId);

            // Reset and reload
            setSoap({ subjective: '', objective: '', analysis: '', plan: '' });
            setIsAdding(false);
            fetchRecords();
        } catch (err) {
            console.error('Error saving note:', err);
            alert('Error al guardar la nota de evolución.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-50 border-l border-slate-200">
            <header className="px-6 py-4 border-b border-slate-200 bg-white sticky top-0 z-10 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Historia Clínica</h2>
                    <p className="text-xs text-slate-500 font-medium">{patientName}</p>
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-800 transition-all flex items-center gap-2"
                >
                    <span className="material-symbols-outlined text-sm">{isAdding ? 'close' : 'add'}</span>
                    {isAdding ? 'Cancelar' : 'Nueva Evolución'}
                </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {isAdding && (
                    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6 animate-in slide-in-from-top-4 duration-300">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">edit_note</span>
                            Nueva Nota de Evolución (SOAP)
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Subjetivo</label>
                                <textarea
                                    value={soap.subjective}
                                    onChange={e => setSoap(prev => ({ ...prev, subjective: e.target.value }))}
                                    className="w-full rounded-lg border-slate-200 text-sm focus:border-primary focus:ring-primary/20 min-h-[60px]"
                                    placeholder="Síntomas referidos por el paciente..."
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Objetivo</label>
                                <textarea
                                    value={soap.objective}
                                    onChange={e => setSoap(prev => ({ ...prev, objective: e.target.value }))}
                                    className="w-full rounded-lg border-slate-200 text-sm focus:border-primary focus:ring-primary/20 min-h-[60px]"
                                    placeholder="Signos vitales, examen físico, laboratorios..."
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Análisis</label>
                                <textarea
                                    value={soap.analysis}
                                    onChange={e => setSoap(prev => ({ ...prev, analysis: e.target.value }))}
                                    className="w-full rounded-lg border-slate-200 text-sm focus:border-primary focus:ring-primary/20 min-h-[60px]"
                                    placeholder="Interpretación del cuadro clínico..."
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Plan</label>
                                <textarea
                                    value={soap.plan}
                                    onChange={e => setSoap(prev => ({ ...prev, plan: e.target.value }))}
                                    className="w-full rounded-lg border-slate-200 text-sm focus:border-primary focus:ring-primary/20 min-h-[60px]"
                                    placeholder="Indicaciones, nuevos estudios, terapia..."
                                />
                            </div>
                            <div className="pt-2 flex justify-end">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="bg-primary text-white px-6 py-2 rounded-lg font-bold text-sm hover:bg-blue-600 transition-all shadow-md disabled:opacity-70"
                                >
                                    {saving ? 'Guardando...' : 'Guardar en Historia Clínica'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-10 text-slate-400 text-sm">Cargando historial...</div>
                ) : records.length === 0 ? (
                    <div className="text-center py-10 text-slate-400">
                        <span className="material-symbols-outlined text-4xl mb-2 opacity-50">history_edu</span>
                        <p className="text-sm">No hay registros clínicos aún.</p>
                    </div>
                ) : (
                    <div className="relative border-l-2 border-slate-200 ml-3 space-y-8 pb-10">
                        {records.map((rec) => (
                            <div key={rec.id} className="relative pl-6">
                                <div className="absolute -left-[9px] top-0 size-4 rounded-full bg-white border-2 border-primary"></div>
                                <div className="mb-1 flex items-center gap-2">
                                    <span className="text-xs font-black text-slate-500 uppercase tracking-wider">
                                        {new Date(rec.created_at).toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">
                                        {rec.note_type}
                                    </span>
                                </div>
                                <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition-all">
                                    <div className="grid gap-3">
                                        {rec.content.subjective && (
                                            <div><span className="text-xs font-black text-primary uppercase mr-2">S:</span><span className="text-sm text-slate-700">{rec.content.subjective}</span></div>
                                        )}
                                        {rec.content.objective && (
                                            <div><span className="text-xs font-black text-primary uppercase mr-2">O:</span><span className="text-sm text-slate-700">{rec.content.objective}</span></div>
                                        )}
                                        {rec.content.analysis && (
                                            <div><span className="text-xs font-black text-primary uppercase mr-2">A:</span><span className="text-sm text-slate-700">{rec.content.analysis}</span></div>
                                        )}
                                        {rec.content.plan && (
                                            <div><span className="text-xs font-black text-primary uppercase mr-2">P:</span><span className="text-sm text-slate-700">{rec.content.plan}</span></div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClinicalHistory;

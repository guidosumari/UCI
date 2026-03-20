
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MOCK_PATIENTS, MOCK_DEVICES } from '../constants';
import { generateClinicalSummary } from '../services/geminiService';

import { supabase } from '../services/supabase';
import ClinicalHistory from '../components/ClinicalHistory';
import EvolutionNotes from '../components/EvolutionNotes';

const SafetyPanel: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  // Get query params manually since we are using react-router-dom v6
  const searchParams = new URLSearchParams(window.location.search);
  const initialTab = searchParams.get('tab') as 'monitoring' | 'history' | 'evolution' | null;

  const [patient, setPatient] = useState<any>(null);

  const [aiSummary, setAiSummary] = useState<string>("");
  const [loadingAi, setLoadingAi] = useState(false);
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [dischargeReason, setDischargeReason] = useState<'discharged' | 'deceased' | 'transferred'>('discharged');
  const [outcomeDetails, setOutcomeDetails] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState<'monitoring' | 'history' | 'evolution'>(initialTab || 'monitoring');

  useEffect(() => {
    const fetchPatient = async () => {
      if (!id) return;
      const { data } = await supabase.from('patients').select('*').eq('id', id).single();
      if (data) setPatient({ ...data, allergies: data.allergies || [] });
    };
    fetchPatient();
  }, [id]);

  if (!patient) return <div className="h-screen flex items-center justify-center bg-slate-50 text-slate-400 font-bold">Cargando paciente...</div>;


  const handleDischarge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('patients')
        .update({
          status: dischargeReason,
          outcome: outcomeDetails
        })
        .eq('id', id);

      if (error) throw error;
      alert('Paciente egresado correctamente.');
      navigate('/');
    } catch (err: any) {
      console.error("Error processing discharge:", err);
      alert('Error al procesar el egreso.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateSummary = async () => {
    setLoadingAi(true);
    const summary = await generateClinicalSummary(
      patient.name,
      `El paciente tiene ${MOCK_DEVICES.map(d => d.type).join(', ')}. La gravedad es ${patient.acuity}. Alergias: ${patient.allergies.join(', ') || 'Ninguna'}.`
    );
    setAiSummary(summary);
    setLoadingAi(false);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'history':
        return <ClinicalHistory patientId={id!} />;
      case 'evolution':
        return <EvolutionNotes patientId={id!} patientName={patient.name} />;
      default:
        return (
          <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 bg-[#f8f9fc]">
            <section>
              <div className="flex justify-between items-end mb-4 px-1">
                <h3 className="text-xl font-bold text-slate-800">Monitoreo de Dispositivos Invasivos</h3>
                <button className="text-sm font-semibold text-primary flex items-center gap-1 bg-white border border-[#cfd7e7] px-3 py-1.5 rounded-md shadow-sm">
                  <span className="material-symbols-outlined text-[18px]">add_circle</span> Añadir Dispositivo
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {MOCK_DEVICES.map((d) => (
                  <div key={d.id} className={`bg-white rounded-lg border p-5 flex flex-col shadow-sm ${d.status === 'vencido' ? 'border-red-200 bg-red-50/20' : 'border-slate-200'}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div className={`p-2.5 rounded-lg ${d.status === 'vencido' ? 'text-red-600 bg-red-100' : 'text-primary bg-blue-50'}`}>
                        <span className="material-symbols-outlined">{d.status === 'vencido' ? 'warning' : 'vaccines'}</span>
                      </div>
                      <span className={`text-[10px] uppercase px-2 py-1 rounded font-bold ${d.status === 'vencido' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {d.status === 'vencido' ? 'Vencido' : d.status === 'activo' ? 'Activo' : 'Pendiente'}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-lg leading-tight">{d.type}</h4>
                    <p className="text-sm text-[#4c669a] mb-5">{d.location}</p>
                    <div className="mt-auto pt-4 border-t border-slate-100">
                      <div className="flex justify-between text-sm">
                        <span className="text-[#4c669a]">Estado del Vendaje</span>
                        <span className={`font-bold ${d.status === 'vencido' ? 'text-red-600' : 'text-orange-600'}`}>{d.nextCheck}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-lg border border-[#cfd7e7] shadow-sm overflow-hidden p-6 max-w-2xl">
              <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-orange-500">lock_clock</span> Contenciones y Órdenes
              </h3>
              <div className="flex gap-6 items-center">
                <div className="text-4xl font-mono text-orange-600 bg-orange-50 px-4 py-2 rounded border border-orange-100">02:15</div>
                <div className="flex-1">
                  <h4 className="font-bold">Contenciones de 4 Puntos</h4>
                  <p className="text-sm text-slate-500">Renovación médica requerida antes de las 16:30.</p>
                  <button className="mt-3 bg-primary text-white text-xs px-4 py-2 rounded font-bold shadow-sm">Renovar Orden</button>
                </div>
              </div>
            </section>
          </div>
        );
    }
  };

  return (
    <div className="bg-background-light text-slate-900 h-screen overflow-hidden flex font-display antialiased">
      <aside className="w-64 bg-white border-r border-[#cfd7e7] flex flex-col h-full shrink-0 z-30">
        <div className="p-4 border-b border-[#cfd7e7]">
          <div className="flex gap-3 items-center">
            <img src="https://picsum.photos/id/177/200/200" className="rounded-full h-10 w-10 shrink-0 border border-gray-200" alt="Admin" />
            <div className="flex flex-col">
              <h1 className="text-base font-bold leading-normal">Gestor de UCI</h1>
              <p className="text-[#4c669a] text-xs font-normal">Turno de Día</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          <p className="px-3 text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 mt-2">Menú Principal</p>

          <button
            onClick={() => setActiveTab('monitoring')}
            className={`flex items-center gap-4 px-4 py-3.5 rounded-xl w-full text-left transition-all duration-200 group ${activeTab === 'monitoring'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            <span className={`material-symbols-outlined text-[22px] ${activeTab === 'monitoring' ? 'filled' : ''}`}>grid_view</span>
            <span className={`text-sm font-bold ${activeTab === 'monitoring' ? '' : 'group-hover:text-slate-900'}`}>Panel Principal</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-4 px-4 py-3.5 rounded-xl w-full text-left transition-all duration-200 group ${activeTab === 'history'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            <span className={`material-symbols-outlined text-[22px] ${activeTab === 'history' ? 'filled' : ''}`}>id_card</span>
            <span className={`text-sm font-bold ${activeTab === 'history' ? '' : 'group-hover:text-slate-900'}`}>Historia Clínica</span>
          </button>

          <button
            onClick={() => setActiveTab('evolution')}
            className={`flex items-center gap-4 px-4 py-3.5 rounded-xl w-full text-left transition-all duration-200 group ${activeTab === 'evolution'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
              : 'text-slate-600 hover:bg-slate-100'
              }`}
          >
            <span className={`material-symbols-outlined text-[22px] ${activeTab === 'evolution' ? 'filled' : ''}`}>history_edu</span>
            <span className={`text-sm font-bold ${activeTab === 'evolution' ? '' : 'group-hover:text-slate-900'}`}>Notas de Evolución</span>
          </button>

          <button
            onClick={() => navigate(`/handoff/${id}`)}
            className="flex items-center gap-4 px-4 py-3.5 rounded-xl w-full text-left transition-all duration-200 group text-slate-600 hover:bg-slate-100"
          >
            <span className="material-symbols-outlined text-[22px] text-amber-500">diversity_3</span>
            <span className="text-sm font-bold group-hover:text-slate-900">Reporte de Guardia</span>
          </button>
        </nav>
        <div className="p-3 border-t border-[#cfd7e7]">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all font-bold"
          >
            <span className="material-symbols-outlined text-[22px]">arrow_back</span>
            <span className="text-sm">Volver al Dashboard</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="bg-white border-b border-[#cfd7e7] p-4 md:px-8 md:py-5 shadow-sm z-10">
          <div className="flex justify-between items-center">
            <div className="flex gap-4 items-center">
              <div className="bg-blue-600 rounded-full h-16 w-16 flex items-center justify-center text-white font-bold text-xl shadow-inner border-2 border-white">
                {patient.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-3">
                  {patient.name}
                  <span className="text-xs font-semibold text-[#4c669a] bg-[#f0f2f5] px-2 py-0.5 rounded border border-[#cfd7e7]">HC: {patient.hc}</span>
                </h2>
                <div className="flex gap-x-3 mt-1 text-sm text-[#4c669a]">
                  <span><strong>Fecha Nac:</strong> {patient.dob}</span>
                  <span><strong>Peso:</strong> {patient.weight}kg</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-[#4c669a] font-bold uppercase">Estado de Gravedad</span>
                <span className={`font-bold text-sm ${patient.acuity === 'ALTA' ? 'text-red-600' : 'text-emerald-600'}`}>
                  {patient.acuity}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowDischargeModal(true)}
              className="ml-4 bg-white border border-slate-200 text-slate-700 hover:bg-red-50 hover:text-red-600 hover:border-red-200 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">logout</span>
              Egreso / Alta
            </button>
          </div>
        </header>

        {renderContent()}
      </main>

      <aside className="w-80 bg-white border-l border-[#cfd7e7] hidden xl:flex flex-col shrink-0 z-20 shadow-lg">
        <div className="p-4 border-b border-[#cfd7e7]">
          <div className="flex items-center gap-2 mb-1">
            <div className="bg-indigo-100 p-1 rounded text-indigo-600">
              <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">Asistente de Seguridad IA</h3>
          </div>
          <button
            onClick={handleGenerateSummary}
            disabled={loadingAi}
            className="w-full mt-2 text-xs bg-indigo-600 text-white py-2 rounded font-bold hover:bg-indigo-700 disabled:opacity-50"
          >
            {loadingAi ? 'Pensando...' : 'Generar Perspectiva Clínica'}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
          {aiSummary ? (
            <div className="bg-white rounded-lg p-4 border border-indigo-200 shadow-sm">
              <h4 className="text-[10px] font-bold text-indigo-800 uppercase mb-2">Resumen ISBAR (IA)</h4>
              <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                {aiSummary}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">analytics</span>
              <p className="text-xs text-slate-400">Haz clic en el botón superior para analizar las métricas actuales de seguridad del paciente.</p>
            </div>
          )}
        </div>
      </aside>

      {/* MODAL DE EGRESO */}
      {
        showDischargeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowDischargeModal(false)}></div>
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
              <header className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">Registrar Egreso del Paciente</h3>
                <button onClick={() => setShowDischargeModal(false)} className="size-8 rounded-full hover:bg-slate-200 flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-lg">close</span>
                </button>
              </header>
              <form onSubmit={handleDischarge} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Motivo de Salida</label>
                  <div className="space-y-2">
                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${dischargeReason === 'discharged' ? 'bg-emerald-50 border-emerald-200 ring-1 ring-emerald-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                      <input type="radio" name="reason" className="hidden" checked={dischargeReason === 'discharged'} onChange={() => setDischargeReason('discharged')} />
                      <div className={`size-4 rounded-full border-2 flex items-center justify-center ${dischargeReason === 'discharged' ? 'border-emerald-500' : 'border-slate-300'}`}>
                        {dischargeReason === 'discharged' && <div className="size-2 rounded-full bg-emerald-500"></div>}
                      </div>
                      <span className="text-sm font-bold text-slate-700">Alta Médica</span>
                    </label>

                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${dischargeReason === 'transferred' ? 'bg-blue-50 border-blue-200 ring-1 ring-blue-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                      <input type="radio" name="reason" className="hidden" checked={dischargeReason === 'transferred'} onChange={() => setDischargeReason('transferred')} />
                      <div className={`size-4 rounded-full border-2 flex items-center justify-center ${dischargeReason === 'transferred' ? 'border-blue-500' : 'border-slate-300'}`}>
                        {dischargeReason === 'transferred' && <div className="size-2 rounded-full bg-blue-500"></div>}
                      </div>
                      <span className="text-sm font-bold text-slate-700">Traslado a Otra Unidad</span>
                    </label>

                    <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${dischargeReason === 'deceased' ? 'bg-slate-100 border-slate-300 ring-1 ring-slate-300 grayscale' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                      <input type="radio" name="reason" className="hidden" checked={dischargeReason === 'deceased'} onChange={() => setDischargeReason('deceased')} />
                      <div className={`size-4 rounded-full border-2 flex items-center justify-center ${dischargeReason === 'deceased' ? 'border-slate-500' : 'border-slate-300'}`}>
                        {dischargeReason === 'deceased' && <div className="size-2 rounded-full bg-slate-500"></div>}
                      </div>
                      <span className="text-sm font-bold text-slate-700">Fallecimiento</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Detalles / Observaciones</label>
                  <textarea
                    className="w-full rounded-xl border-slate-200 text-sm min-h-[80px]"
                    placeholder="Ingrese detalles adicionales del egreso..."
                    value={outcomeDetails}
                    onChange={(e) => setOutcomeDetails(e.target.value)}
                  ></textarea>
                </div>

                <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => setShowDischargeModal(false)} className="flex-1 py-3 rounded-xl border border-slate-200 font-bold text-sm text-slate-600 hover:bg-slate-50">Cancelar</button>
                  <button type="submit" disabled={isProcessing} className="flex-1 py-3 rounded-xl bg-slate-900 font-bold text-sm text-white hover:bg-slate-800 disabled:opacity-70">
                    {isProcessing ? 'Procesando...' : 'Confirmar Egreso'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }
    </div >
  );
};

export default SafetyPanel;

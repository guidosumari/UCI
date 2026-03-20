
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

const HandoffForm: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();


  const [patient, setPatient] = useState<any>(null); // Ideally use Patient type, but reusing existing structure for now
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [patientList, setPatientList] = useState<any[]>([]); // List for selection if no ID

  // Estado para controlar el paso actual (1 a 5)
  const [currentStep, setCurrentStep] = useState(1); // Reset to 1 for correct flow
  const [isSaving, setIsSaving] = useState(false);

  // Estados para el flujo de egreso/alta
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [dischargeReason, setDischargeReason] = useState<'discharged' | 'deceased' | 'transferred'>('discharged');
  const [outcomeDetails, setOutcomeDetails] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Handoff Form State
  const [selectedStatus, setSelectedStatus] = useState('');
  const [situationText, setSituationText] = useState('');

  const { user } = useAuth();

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

  React.useEffect(() => {
    const fetchPatient = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from('patients')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (data) {
          // Map DB fields to match component usage (Patient interface)
          setPatient({
            ...data,
            dni: data.dni,
            hc: data.hc,
            admitDate: data.admit_date,
            isbarStatus: data.isbar_status,
            lastValidated: data.last_validated,
            nurseAvatar: data.nurse_avatar || `https://i.pravatar.cc/150?u=${data.id}`,
            generalStatus: data.general_status,
            // Ensure array fields are handled if they come as null/undefined
            allergies: data.allergies || []
          });
          if (data.general_status) setSelectedStatus(data.general_status);
        }
      } catch (err) {
        console.error("Error fetching patient:", err);
        // Fallback or alert? For now, maybe just stay loading or show error
        alert("Error al cargar paciente");
        navigate('/');
      } finally {
        setLoadingPatient(false);
      }
    };

    const fetchAllPatients = async () => {
      const { data } = await supabase.from('patients').select('*').order('bed', { ascending: true });
      if (data) setPatientList(data);
      setLoadingPatient(false);
    };

    if (id) {
      fetchPatient();
    } else {
      fetchAllPatients();
    }
  }, [id, navigate]);

  if (loadingPatient) {
    return <div className="flex items-center justify-center h-screen font-bold text-slate-400">Cargando...</div>;
  }

  // If no ID and we have list, show selection
  if (!id && !patient) {
    return (
      <div className="bg-[#f8f9fc] min-h-screen p-8 text-center font-display">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-black text-slate-900 mb-2">Seleccionar Paciente</h1>
          <p className="text-slate-500 mb-8">Elija un paciente para iniciar el proceso de ISBAR (Entrega de Turno)</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {patientList.map(p => (
              <div
                key={p.id}
                onClick={() => navigate(`/handoff/${p.id}`)}
                className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center gap-3 cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all group"
              >
                <div className="bg-blue-50 text-blue-600 font-bold text-xl size-12 flex items-center justify-center rounded-full group-hover:bg-primary group-hover:text-white transition-colors">
                  {p.bed}
                </div>
                <div className="text-center">
                  <h3 className="font-bold text-slate-900 leading-tight">{p.name}</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase mt-1">HC: {p.hc}</p>
                </div>
                <button className="mt-2 text-xs font-bold bg-slate-50 text-slate-600 py-2 px-4 rounded-lg w-full group-hover:bg-primary group-hover:text-white transition-colors">
                  Iniciar
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => navigate('/')} className="mt-12 text-slate-400 hover:text-slate-600 font-bold text-sm flex items-center gap-2 mx-auto">
            <span className="material-symbols-outlined">arrow_back</span> Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!patient) {
    return <div className="flex items-center justify-center h-screen">Paciente no encontrado.</div>;
  }


  const stepNames = [
    'Identificación',
    'Situación',
    'Antecedentes',
    'Evaluación',
    'Recomendación'
  ];

  const handleNext = async () => {
    if (currentStep < 5) {
      setCurrentStep(currentStep + 1);
    } else {
      // Lógica de finalización
      if (!user) {
        alert("Error: No hay usuario autenticado. No se puede guardar.");
        return;
      }

      console.log("Guardando reporte. Status:", selectedStatus);
      setIsSaving(true);

      try {
        const reportData = {
          user_id: user.id,
          patient_id: patient.id,
          patient_name: patient.name,
          status: 'completed',
          shift_summary: {
            // En una implementación real, aquí recopilaríamos los estados de cada input
            // Por ahora guardamos una estructura de ejemplo ya que los inputs no tienen estado controlado en este mockup
            situation: "Resumen de situación...",
            background: "Antecedentes...",
            assessment: "Evaluación completa...",
            recommendation: "Plan de cuidados..."
          }
        };

        const { error: reportError } = await supabase.from('handoff_reports').insert(reportData);

        if (reportError) throw reportError;

        // Mapeo actualizado de gravedad
        let acuity = 'ESTABLE';
        if (selectedStatus === 'Crítico Inestable') acuity = 'ALTA';
        else if (selectedStatus === 'Crítico Estabilizado') acuity = 'MEDIA';
        else if (selectedStatus === 'Estable') acuity = 'ESTABLE';

        // Usar el texto de situación (diagnóstico) como estado general si existe, sino el estado seleccionado
        // Esto permite mostrar "Neumonía..." en lugar de solo "Inestable" en el Dashboard
        const finalGeneralStatus = situationText || selectedStatus;

        const { error: patientError } = await supabase
          .from('patients')
          .update({
            general_status: finalGeneralStatus,
            acuity: acuity,
            last_clinical_update: new Date().toISOString()
          })
          .eq('id', patient.id);

        if (patientError) throw patientError;

        alert("Entrega de turno completada y guardada con éxito.");
        navigate('/');
      } catch (err: any) {
        console.error('Error saving report:', err);
        alert("Error al guardar el reporte: " + err.message);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getStepStatus = (stepNumber: number) => {
    if (currentStep > stepNumber) return 'completed';
    if (currentStep === stepNumber) return 'active';
    return 'pending';
  };

  // Renderizado dinámico del contenido según el paso
  const renderStepContent = () => {
    switch (currentStep) {
      case 1: // Identificación
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">fingerprint</span>
                Verificación de Identidad
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Nombre Completo</p>
                  <p className="font-bold text-slate-800">{patient.name}</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Identificación</p>
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800 text-sm">DNI: {patient.dni}</span>
                    <span className="font-bold text-slate-800 text-sm">HC: {patient.hc}</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 flex items-center gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <input type="checkbox" className="rounded text-emerald-600 focus:ring-emerald-500 size-5" id="verify" />
                <label htmlFor="verify" className="text-sm font-bold text-emerald-800">He verificado la identidad con el brazalete del paciente</label>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800">
                <span className="material-symbols-outlined text-red-500">logout</span>
                Gestión de Egreso / Alta
              </h3>
              <p className="text-sm text-slate-500 mb-4">
                Si el paciente va a ser dado de alta, trasladado o ha fallecido durante este turno, regístrelo aquí.
                Esta acción finalizará la admisión actual.
              </p>
              <button
                onClick={() => setShowDischargeModal(true)}
                className="bg-slate-50 border border-slate-200 text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200 px-4 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 w-full justify-center sm:w-auto"
              >
                <span className="material-symbols-outlined">logout</span>
                Registrar Egreso / Alta del Paciente
              </button>
            </div>
          </div>
        );
      case 2: // Situación
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-lg mb-4">Resumen de Situación Actual</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-2">Motivo de Ingreso / Diagnóstico Principal</label>
                  <textarea
                    value={situationText}
                    onChange={(e) => setSituationText(e.target.value)}
                    className="w-full rounded-xl border-slate-200 min-h-[100px] text-sm font-medium"
                    placeholder="Ej: Insuficiencia respiratoria aguda secundaria a neumonía...">
                  </textarea>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-2">Estado General</label>
                  <div className="flex gap-3">
                    <div className="flex gap-3 flex-wrap">
                      {['Crítico Inestable', 'Crítico Estabilizado', 'Estable'].map(status => (
                        <button
                          key={status}
                          onClick={() => setSelectedStatus(status)}
                          className={`px-4 py-2 rounded-lg border text-xs font-bold transition-all ${selectedStatus === status ? 'bg-primary text-white border-primary shadow-md scale-105' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                        >
                          {status}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 3: // Antecedentes
        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">history_edu</span>
                Historial Médico
              </h3>
              <textarea className="w-full rounded-xl border-slate-200 min-h-[150px] text-sm font-medium" placeholder="Antecedentes quirúrgicos, comorbilidades crónicas..."></textarea>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-red-500">warning</span>
                Alergias Conocidas
              </h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {patient.allergies.length > 0 ? (
                  patient.allergies.map(a => (
                    <span key={a} className="px-3 py-1 bg-red-50 text-red-600 rounded-full text-xs font-bold border border-red-100">{a}</span>
                  ))
                ) : (
                  <p className="text-sm text-slate-400 italic">No se reportan alergias.</p>
                )}
              </div>
              <button className="text-xs font-bold text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">add_circle</span> Añadir Alergia
              </button>
            </div>
          </div>
        );
      case 4: // Evaluación (Assessment)
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden group hover:border-primary/30 transition-all">
                <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-slate-800 font-bold tracking-tight">
                    <div className="bg-red-50 p-2 rounded-lg text-red-500">
                      <span className="material-symbols-outlined filled">ecg_heart</span>
                    </div>
                    Cardiovascular
                  </div>
                </div>
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Presión Arterial</label>
                      <input className="w-full rounded-xl border-slate-200 focus:border-primary focus:ring-primary/20 text-sm font-semibold h-11" placeholder="120/80" type="text" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Frecuencia Cardíaca</label>
                      <input className="w-full rounded-xl border-slate-200 focus:border-primary focus:ring-primary/20 text-sm font-semibold h-11" placeholder="80 bpm" type="number" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden group hover:border-primary/30 transition-all">
                <div className="bg-slate-50/50 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-slate-800 font-bold tracking-tight">
                    <div className="bg-blue-50 p-2 rounded-lg text-blue-500">
                      <span className="material-symbols-outlined filled">pulmonology</span>
                    </div>
                    Pulmonar
                  </div>
                </div>
                <div className="p-6 space-y-5">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Ajustes del Ventilador</label>
                    <select className="w-full rounded-xl border-slate-200 focus:border-primary focus:ring-primary/20 text-sm font-semibold h-11">
                      <option>AC / VC</option>
                      <option>Soporte de Presión (PS)</option>
                      <option>SIMV</option>
                      <option>CPAP</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 hover:border-primary/30 transition-all">
              <label className="block text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-xl">description</span>
                Notas Detalladas de Evaluación
              </label>
              <textarea
                className="w-full rounded-2xl border-slate-200 focus:border-primary focus:ring-primary/20 text-sm font-medium min-h-[180px] p-4 placeholder:text-slate-300"
                placeholder="Describa hallazgos neurológicos, metabólicos, renales y cutáneos observados durante el turno..."
              ></textarea>
            </div>
          </div>
        );
      case 5: // Recomendación
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-primary">
                <span className="material-symbols-outlined">assignment_turned_in</span>
                Plan de Cuidados y Objetivos para el Turno
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Tareas Pendientes Prioritarias</label>
                  <div className="space-y-2">
                    {['Pendiente resultado de cultivo', 'Ajustar dosis de Noradrenalina', 'Coordinar traslado a TAC'].map(task => (
                      <div key={task} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <input type="checkbox" className="rounded text-primary focus:ring-primary" />
                        <span className="text-sm font-bold text-slate-700">{task}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Criterios de Escalamiento / Alerta</label>
                  <textarea className="w-full rounded-xl border-slate-200 min-h-[100px] text-sm font-medium" placeholder="Si la PAM baja de 65mmHg, llamar a..."></textarea>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-[#f8f9fc] h-screen flex overflow-hidden font-display">
      {/* Sidebar de Progreso */}
      <aside className="w-80 bg-white border-r border-border-light flex flex-col flex-shrink-0 z-20 shadow-sm h-full overflow-y-auto">
        <div className="h-16 flex items-center px-6 border-b border-border-light">
          <div className="flex items-center gap-2 text-primary cursor-pointer" onClick={() => navigate('/')}>
            <div className="bg-primary/10 p-1.5 rounded-lg">
              <span className="material-symbols-outlined filled text-2xl">local_hospital</span>
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">MediSafe <span className="text-primary">ISBAR</span></span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-8 px-6">
          <div className="relative flex flex-col gap-0">
            {stepNames.map((name, i) => {
              const stepNum = i + 1;
              const status = getStepStatus(stepNum);
              return (
                <div key={i} className="flex gap-4 relative group cursor-pointer" onClick={() => setCurrentStep(stepNum)}>
                  <div className="flex flex-col items-center">
                    <div className={`size-9 rounded-full flex items-center justify-center ring-4 ring-white z-10 transition-all duration-300 ${status === 'completed' ? 'bg-emerald-50 border border-emerald-200 shadow-sm' :
                      status === 'active' ? 'bg-primary text-white shadow-lg scale-110' : 'bg-white border-2 border-slate-200 text-slate-400'
                      }`}>
                      {status === 'completed' ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-5 text-emerald-600">
                          <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.14-.094l3.74-5.24Z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <span className="text-sm font-bold">{stepNum}</span>
                      )}
                    </div>
                    {i < stepNames.length - 1 && (
                      <div className={`w-0.5 h-full -my-2 transition-colors duration-500 ${status === 'completed' ? 'bg-emerald-200' : 'bg-slate-100'
                        }`}></div>
                    )}
                  </div>
                  <div className="pb-10 pt-1.5">
                    <h3 className={`text-sm font-bold leading-none tracking-tight ${status === 'active' ? 'text-primary' :
                      status === 'completed' ? 'text-slate-700' : 'text-slate-400'
                      }`}>
                      {name}
                    </h3>
                    <p className={`text-[10px] font-bold mt-1.5 uppercase tracking-widest ${status === 'completed' ? 'text-emerald-600' :
                      status === 'active' ? 'text-primary' : 'text-slate-300'
                      }`}>
                      {status === 'completed' ? 'Completado' : status === 'active' ? 'En proceso' : 'Pendiente'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6 border-t border-border-light bg-slate-50/50">
          <button className="flex w-full items-center justify-center rounded-xl h-11 bg-white border border-slate-200 text-slate-700 text-sm font-bold hover:bg-slate-50 transition-all shadow-sm mb-3">
            <span className="material-symbols-outlined text-lg mr-2">save</span>
            Guardar Borrador
          </button>
          <button onClick={() => navigate('/')} className="flex w-full items-center justify-center rounded-xl h-11 text-slate-500 text-sm font-bold hover:text-slate-800 transition-colors">
            Cancelar
          </button>
        </div>
      </aside>

      {/* Área Principal del Formulario */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-border-light flex items-center justify-between px-8 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-primary animate-pulse"></div>
            <h2 className="text-lg font-bold text-slate-800">Nueva Entrega Clínica</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900">Dra. Sarah Chen</p>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Médico de UCI • Turno ID: #8892</p>
            </div>
            <img src="https://picsum.photos/id/177/200/200" className="size-10 rounded-full border border-slate-200 shadow-sm" alt="Sarah Chen" />
          </div>
        </header>

        {/* Info del Paciente (Sticky) */}
        <div className="bg-white border-b border-blue-50 px-8 py-4 flex-shrink-0 shadow-sm sticky top-0 z-10">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-primary to-blue-600 text-white rounded-2xl size-14 flex items-center justify-center font-bold text-xl shadow-md border-2 border-white">
                {patient.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">{patient.name}</h1>
                  <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border uppercase tracking-wider ${patient.acuity === 'ALTA' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                    }`}>
                    {patient.acuity}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1 font-medium">
                  <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-bold">HC: {patient.hc}</span>
                  <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                  <span className="flex items-center gap-1 text-primary font-bold">
                    <span className="material-symbols-outlined text-[16px]">bed</span> Cama: {patient.bed}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate(`/safety/${patient.id}`)}
              className="bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">monitor_heart</span>
              Panel de Seguridad
            </button>
          </div>
        </div>

        {/* Contenido Scrolleable */}
        <div className="flex-1 overflow-y-auto p-8 relative no-scrollbar">
          <div className="max-w-4xl mx-auto pb-24">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">{stepNames[currentStep - 1]}</h2>
                <p className="text-slate-500 font-medium mt-1">Fase {currentStep} de la metodología ISBAR.</p>
              </div>
              <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
                <span className="material-symbols-outlined text-sm">history</span> Última edición: hace segundos
              </div>
            </div>

            {renderStepContent()}
          </div>
        </div>

        {/* Footer de Navegación */}
        <div className="h-24 bg-white border-t border-border-light flex items-center justify-between px-10 flex-shrink-0">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-200 font-bold text-sm transition-all shadow-sm ${currentStep === 1 ? 'opacity-30 cursor-not-allowed' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            Paso Anterior
          </button>

          <div className="flex items-center gap-4">
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Paso {currentStep} de 5</span>
            <button
              onClick={handleNext}
              disabled={isSaving}
              className={`flex items-center gap-2 px-10 py-3 rounded-xl bg-primary text-white font-bold text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
            >
              {isSaving ? 'Guardando...' : (currentStep === 5 ? 'Finalizar Entrega' : `Siguiente: ${stepNames[currentStep]}`)}
              {!isSaving && <span className="material-symbols-outlined text-lg">arrow_forward</span>}
            </button>
          </div>
        </div>
      </main>

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
    </div>
  );
};

export default HandoffForm;


import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MOCK_PATIENTS } from '../constants';
import { Acuity, Patient, Interconsultation } from '../types';
import { supabase } from '../services/supabase';
import { useEffect } from 'react';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [waitingList, setWaitingList] = useState<Interconsultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'critical' | 'history'>('all');

  const getAcuityColor = (acuity: Acuity) => {
    switch (acuity) {
      case Acuity.HIGH: return 'bg-acuity-high';
      case Acuity.MOD: return 'bg-acuity-mod';
      case Acuity.STABLE: return 'bg-acuity-stable';
      default: return 'bg-slate-300';
    }
  };

  const getAcuityLabelColor = (acuity: Acuity) => {
    switch (acuity) {
      case Acuity.HIGH: return 'text-acuity-high border-red-200 bg-red-50';
      case Acuity.MOD: return 'text-acuity-mod border-amber-200 bg-amber-50';
      case Acuity.STABLE: return 'text-acuity-stable border-emerald-200 bg-emerald-50';
      default: return 'text-slate-400 border-slate-200 bg-slate-50';
    }
  };

  const filteredPatients = useMemo(() => {
    if (filter === 'critical') {
      return patients.filter(p => p.acuity === Acuity.HIGH);
    }
    if (filter === 'history') {
      return []; // Placeholder for history view being empty or different
    }
    return patients;
  }, [patients, filter]);

  useEffect(() => {
    fetchPatients();

    // Recargar al volver a la pestaña/ventana
    const handleFocus = () => {
      fetchPatients();
      fetchWaitingList();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchWaitingList = async () => {
    const { data } = await supabase
      .from('interconsultations')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (data) setWaitingList(data as Interconsultation[]);
  };

  const fetchPatients = async () => {
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false });

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
        setPatients(mappedPatients);
      }
    } catch (error) {
      console.error('Error fetching patients:', error);
      // Fallback to mocks just in case of empty or error for demo
      // setPatients(MOCK_PATIENTS); 
    } finally {
      setLoading(false);
    }
  };

  const seedData = async () => {
    setLoading(true);
    try {
      // Map mock patients to DB format (omitting ID to let DB generate UUIDs)
      const dbPatients = MOCK_PATIENTS.map(p => ({
        bed: p.bed,
        name: p.name,
        dni: p.dni,
        hc: p.hc,
        acuity: p.acuity,
        dob: p.dob,
        admit_date: p.admitDate,
        weight: p.weight,
        allergies: p.allergies,
        isbar_status: p.isbarStatus,
        last_validated: p.lastValidated,
        nurse: p.nurse,
        nurse_avatar: p.nurseAvatar,
        general_status: p.generalStatus,
        status: 'active'
      }));

      const { error } = await supabase.from('patients').insert(dbPatients);
      if (error) throw error;
      fetchPatients();
    } catch (e) {
      console.error("Error seeding data:", e);
      alert("Error cargando datos de prueba: " + (e as any).message);
    } finally {
      setLoading(false);
    }
  };





  return (
    <div className="bg-background-light min-h-screen flex flex-col relative font-sans">
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-3 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex flex-wrap lg:flex-nowrap items-center justify-between gap-4 lg:gap-0">
          <div className="flex items-center justify-between w-full lg:w-auto">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center size-10 rounded-xl bg-primary shadow-sm text-white">
                <span className="material-symbols-outlined text-2xl filled">vital_signs</span>
              </div>
              <div>
                <h1 className="text-xl font-extrabold leading-tight tracking-tight text-slate-900">UCI Unidad 4</h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
                  <span className={`size-1.5 rounded-full ${filter === 'history' ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'}`}></span>
                  {filter === 'history' ? 'Modo: Historial' : 'Sincronizado: En vivo'}
                </p>
              </div>
            </div>
            {/* Mobile User Profile */}
            <div className="flex lg:hidden items-center gap-3">
              <div className="size-10 rounded-full ring-2 ring-primary/20 p-0.5 cursor-pointer">
                <img src="https://picsum.photos/id/177/200/200" className="size-full rounded-full object-cover" alt="Perfil" />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row flex-1 w-full lg:w-auto order-3 lg:order-none max-w-none lg:max-w-xl mx-0 lg:mx-8 items-stretch lg:items-center gap-3">
            <div className="flex flex-1 items-center gap-3 bg-slate-50 px-4 py-2 rounded-full border border-slate-200">
              <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
              <input type="text" placeholder="Buscar paciente, cama o enfermero..." className="bg-transparent border-none focus:ring-0 text-sm w-full placeholder:text-slate-400" />
            </div>

            <button
              onClick={() => navigate('/interconsultas')}
              className="flex justify-center items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-indigo-700 transition shadow-lg hover:shadow-indigo-500/30 hover:-translate-y-0.5 whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-lg"></span>
              Interconsultas
              {waitingList.length > 0 && (
                <span className="bg-white text-indigo-600 text-[10px] h-5 min-w-[20px] px-1 flex items-center justify-center rounded-full font-black">
                  {waitingList.length}
                </span>
              )}
            </button>
          </div>

          <div className="hidden lg:flex items-center gap-3 pl-4 border-l border-slate-200 ml-2 order-2 lg:order-none">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-bold text-slate-900">Dra. Sarah C.</p>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">Residente Jefe</p>
            </div>
            <div className="size-10 rounded-full ring-2 ring-primary/20 p-0.5 cursor-pointer">
              <img src="https://picsum.photos/id/177/200/200" className="size-full rounded-full object-cover" alt="Perfil" />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-6">
        {/* Estadísticas */}
        {/* Estadísticas */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Ocupación Total</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-slate-900 tracking-tight">{patients.length}/18</span>
                  <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    {Math.round((patients.length / 18) * 100)}%
                  </span>
                </div>
              </div>
              <div className="bg-primary/5 p-3 rounded-xl text-primary">
                <span className="material-symbols-outlined text-2xl">bed</span>
              </div>
            </div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full mt-6 overflow-hidden">
              <div className="bg-primary h-full rounded-full shadow-[0_0_8px_rgba(19,91,236,0.3)] transition-all duration-1000" style={{ width: `${(patients.length / 18) * 100}%` }}></div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Distribución de Gravedad</p>
              <div className="bg-amber-50 p-3 rounded-xl text-amber-600">
                <span className="material-symbols-outlined text-2xl">monitoring</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex flex-col items-center">
                <span className="text-2xl font-black text-acuity-high">{patients.filter(p => p.acuity === Acuity.HIGH).length}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Alta</span>
              </div>
              <div className="h-10 w-px bg-slate-100"></div>
              <div className="flex flex-col items-center">
                <span className="text-2xl font-black text-acuity-mod">{patients.filter(p => p.acuity === Acuity.MOD).length}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Media</span>
              </div>
              <div className="h-10 w-px bg-slate-100"></div>
              <div className="flex flex-col items-center">
                <span className="text-2xl font-black text-acuity-stable">{patients.filter(p => p.acuity === Acuity.STABLE).length}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Estable</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer" onClick={() => navigate('/interconsultas')}>
            <div className="flex flex-col h-full justify-between gap-6">
              <div>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Lista de Espera UCI</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-slate-900 tracking-tighter">{waitingList.length}</span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-tight">Pacientes</span>
                  </div>
                  <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                    <span className="material-symbols-outlined text-2xl">hourglass_top</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center bg-slate-50/50 rounded-2xl p-4 border border-slate-100/50">
                <div className="flex flex-col items-center flex-1">
                  <span className="text-2xl font-black text-red-600 leading-none mb-1">{waitingList.filter(w => w.priority === '1').length}</span>
                  <span className="text-[10px] font-black text-red-400/80 uppercase tracking-widest">Prioridad 1</span>
                </div>
                <div className="h-8 w-px bg-slate-200 shadow-[1px_0_0_0_white]"></div>
                <div className="flex flex-col items-center flex-1">
                  <span className="text-2xl font-black text-amber-600 leading-none mb-1">{waitingList.filter(w => w.priority === '2').length}</span>
                  <span className="text-[10px] font-black text-amber-400/80 uppercase tracking-widest">Prioridad 2</span>
                </div>
                <div className="h-8 w-px bg-slate-200 shadow-[1px_0_0_0_white]"></div>
                <div className="flex flex-col items-center flex-1">
                  <span className="text-2xl font-black text-indigo-600 leading-none mb-1">{waitingList.filter(w => w.priority === '3').length}</span>
                  <span className="text-[10px] font-black text-indigo-400/80 uppercase tracking-widest">Prioridad 3</span>
                </div>
              </div>
            </div>

            {/* Background Accent */}
            <div className="absolute -right-4 -bottom-4 opacity-[0.03] rotate-12 transition-transform group-hover:scale-110">
              <span className="material-symbols-outlined text-9xl">hourglass_empty</span>
            </div>
          </div>

          <div
            onClick={() => navigate('/antibiotics')}
            className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer"
          >
            <div className={`absolute right-0 top-0 h-full w-1.5 transition-all ${patients.some(p => p.allergies?.length > 0 || p.physicalExam?.infectious?.antibiotic) ? 'bg-red-500 group-hover:w-2' : 'bg-emerald-500 group-hover:w-2'}`}></div>
            <div className="flex justify-between items-start">
              <div className="w-full">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">Alergias / Alertas</p>
                {patients.some(p => p.allergies?.length > 0 || p.physicalExam?.infectious?.antibiotic) ? (
                  <>
                    <p className="text-4xl font-black text-slate-900 tracking-tight">
                      {patients.filter(p => p.allergies?.length > 0 || p.physicalExam?.infectious?.antibiotic).length}
                    </p>
                    <div className="mt-2 space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                      {/* Alergias */}
                      {patients.filter(p => p.allergies?.length > 0).map(p => (
                        <div key={`allergy-${p.id}`} className="text-[11px] leading-tight text-red-600 font-medium bg-red-50 p-1.5 rounded border border-red-100 flex items-start gap-1">
                          <span className="material-symbols-outlined text-[14px] shrink-0 mt-0.5">warning</span>
                          <div>
                            <span className="font-bold text-red-800">Cama {p.bed}:</span> Alergias: {p.allergies.join(', ')}
                          </div>
                        </div>
                      ))}
                      {/* Antibióticos */}
                      {patients.filter(p => p.physicalExam?.infectious?.antibiotic).map(p => (
                        <div key={`atb-${p.id}`} className="text-[11px] leading-tight text-blue-600 font-medium bg-blue-50 p-1.5 rounded border border-blue-100 flex items-start gap-1">
                          <span className="material-symbols-outlined text-[14px] shrink-0 mt-0.5 text-blue-500">medication</span>
                          <div>
                            <span className="font-bold text-blue-800">Cama {p.bed}:</span> {p.physicalExam.infectious.antibiotic} (Día {p.physicalExam.infectious.antibiotic_days || '?'})
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-4xl font-black text-slate-900 tracking-tight">0</p>
                    <p className="text-xs font-semibold text-emerald-600 mt-2 flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Sin alertas activas
                    </p>
                  </>
                )}

              </div>
              <div className={`p-3 rounded-xl ${patients.some(p => p.allergies?.length > 0 || p.physicalExam?.infectious?.antibiotic) ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-500'}`}>
                <span className="material-symbols-outlined text-2xl filled">notifications_active</span>
              </div>
            </div>
          </div>
        </section>

        {/* Listado de Camas */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 p-2 rounded-lg text-white">
              <span className="material-symbols-outlined text-xl">grid_view</span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Estado de Camas</h2>

          </div>
          <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <button
              onClick={() => setFilter('all')}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'all' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Vista General
            </button>
            <button
              onClick={() => setFilter('critical')}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'critical' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Solo Críticos
            </button>
            <button
              onClick={() => setFilter('history')}
              className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${filter === 'history' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
            >
              Historial de Egresos
            </button>
          </div>
        </div>



        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
          {filteredPatients.map((p) => (
            <div
              key={p.id}
              onClick={() => navigate(`/safety/${p.id}`)}
              className="group cursor-pointer flex flex-col bg-white rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 border border-slate-200 overflow-hidden relative transition-all duration-300 animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <div className={`h-2 w-full ${getAcuityColor(p.acuity)}`}></div>
              <div className="p-5 flex flex-col h-full gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Cama</span>
                      <h3 className="text-3xl font-black text-slate-900 leading-none">{p.bed}</h3>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg border uppercase tracking-wider ${getAcuityLabelColor(p.acuity)}`}>
                    {p.acuity}
                  </span>
                </div>

                <div>
                  <p className="text-lg font-bold text-slate-800 line-clamp-1 leading-tight">{p.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tight mb-2">HC: {p.hc}</p>
                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 mt-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Estado General</p>
                    <p className="text-[11px] font-bold text-slate-600 line-clamp-2 leading-snug">
                      {p.generalStatus ? p.generalStatus : '\u00A0'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    {p.lastClinicalUpdate ? (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                        <span className="material-symbols-outlined text-xs">update</span>
                        Evolución: {new Date(p.lastClinicalUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                        <span className="material-symbols-outlined text-xs">history_edu</span>
                        Sin evolución
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 mt-1">
                  <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider">
                    <span className="text-slate-400">Entrega Turno</span>
                    <span className={p.isbarStatus < 5 ? 'text-red-500' : 'text-emerald-500'}>
                      {p.isbarStatus}/5
                    </span>
                  </div>
                  <div className="flex gap-1.5 h-1.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <div key={s} className={`flex-1 rounded-full transition-all duration-500 ${p.isbarStatus >= s ? 'bg-primary shadow-[0_0_5px_rgba(19,91,236,0.2)]' : 'bg-slate-100'}`}></div>
                    ))}
                  </div>
                </div>

                <div className="mt-auto pt-4 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-full bg-slate-100 border border-slate-200 p-0.5">
                      <img src={p.nurseAvatar} alt={p.nurse} className="size-full rounded-full object-cover" />
                    </div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{p.nurse}</span>
                  </div>
                  <div className="size-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-lg">open_in_new</span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Botón de Nueva Admisión */}
          <div
            onClick={() => navigate('/new-admission')}
            className="group cursor-pointer flex flex-col bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 items-center justify-center hover:border-primary/50 hover:bg-primary/[0.02] transition-all min-h-[280px]"
          >
            <div className="text-center p-6">
              <div className="size-16 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto mb-4 text-slate-300 group-hover:text-primary transition-colors shadow-sm">
                <span className="material-symbols-outlined text-3xl">add</span>
              </div>
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest">Nueva Admisión</h3>
              <p className="text-xs text-slate-400 mt-1">{18 - patients.length} camas disponibles</p>
            </div>
          </div>

          {/* Seed Button - Only show if empty */}
          {patients.length === 0 && !loading && (
            <div
              onClick={(e) => { e.stopPropagation(); seedData(); }}
              className="group cursor-pointer flex flex-col bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-200 items-center justify-center hover:border-emerald-500/50 hover:bg-emerald-50/50 transition-all min-h-[280px]"
            >
              <div className="text-center p-6">
                <div className="size-16 rounded-full bg-white border border-slate-200 flex items-center justify-center mx-auto mb-4 text-slate-300 group-hover:text-emerald-500 transition-colors shadow-sm">
                  <span className="material-symbols-outlined text-3xl hidden sm:block">database</span>
                </div>
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mt-2">Cargar Datos de Prueba</h3>
                <p className="text-xs text-slate-400 mt-1">Restaurar pacientes de ejemplo</p>
              </div>
            </div>
          )}
        </div>
      </main>


    </div >
  );
};

export default Dashboard;

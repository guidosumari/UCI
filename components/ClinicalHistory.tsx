import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const PhysicalExamInput = ({
    label,
    value,
    onChange,
    placeholder = '',
    width = '',
    type = 'number'
}: {
    label: string,
    value: string,
    onChange: (val: string) => void,
    placeholder?: string,
    width?: string,
    type?: 'text' | 'number'
}) => (
    <div className={`flex flex-col ${width}`}>
        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 truncate" title={label}>{label}</label>
        <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full border border-slate-200 rounded px-3 py-2 text-sm font-bold text-slate-700 focus:border-primary focus:ring-1 focus:ring-primary/20 bg-white"
            placeholder={placeholder}
            onWheel={(e) => e.currentTarget.blur()}
        />
    </div>
);

interface Props {
    patientId: string;
}

const ClinicalHistory: React.FC<Props> = ({ patientId }) => {
    const navigate = useNavigate();
    const [activeSection, setActiveSection] = useState<'filiacion' | 'antecedentes' | 'anamnesis' | 'examen_fisico' | 'problemas' | 'plan'>('filiacion');
    const [patientData, setPatientData] = useState<any>({
        // Filiación
        name: '', age: '', sex: '', dni: '', hc: '', bed: '', acuity: 'ESTABLE', address: '', relative: '', relative_phone: '', hospital_admission: '', icu_admission: '', ucin_transfer_date: '',
        marital_status: '', religion: '', occupation: '',
        // Anamnesis (Added fields)
        illness_duration: '', symptoms: '', onset: '', illness_course: '', anamnesis_text: '',
        // Antecedentes (Checkbox)
        hx_hta: false, hx_dm: false, hx_icc: false, hx_erc: false, hx_tbc: false, hx_epoc: false, hx_fibrosis: false, hx_other: '', hx_surgical: '', hx_medication: '',
        allergies: '',
        // Examen Físico
        physical_exam: {
            vital_signs: { pa: '', pam: '', spo2: '', etco2: '', weight: '', height: '', fr: '', fc: '', fio2: '', temp: '', pid: '', imc: '' },
            neurologic: '',
            glasgow: 15,
            respiratory: {
                description: '', interface: '', fio2: '', pc: '', ppico: '', t_ins: '', vci: '', po2: '', pco2: '',
                fr: '', peep: '', ie: '', cdin: '', vce: '', pafio2: '', gaa: ''
            },
            cardiovascular: '',
            renal: { urea: '', creatinine: '', fg: '', bh: '', acute_renal_failure: false },
            metabolic: {
                na: '', k: '', cl: '', cai: '', cas: '', p: '', mg: '',
                ph: '', hco3: '', eb: '', glu: '', lact: '', osmo: '',
                bt: '', bd: '', bi: '', tgo: '', tgp: '',
                pt: '', alb: '', fa: '', ggt: '', dhl: ''
            },
            abdomen: '',
            hematology: {
                hb: '', hto: '', plaq: '',
                hma: '', leu: '', ab: '', seg: '', linf: '', lce: '',
                perf_coag: '', tp: '', inr: '', ttpa: '', tt: '', fib: ''
            },
            infectious: { pcr: '', pct: '', antibiotic: '', cultures: '', antibiotic_days: '' },
            chronic_health: {
                enabled: false,
                type: 'non_operative'
            }
        },
        // Problemas
        health_problems: '',
        // Plan
        plan: '',
        apache_score: null
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const calculateApacheII = (data: any) => {
        const parseNum = (val: any) => {
            if (val === null || val === undefined || val === '') return null;
            const n = parseFloat(val);
            return isNaN(n) ? null : n;
        };
        
        let score = 0;
        const aps = data.physical_exam || {};
        const vs = aps.vital_signs || {};
        const met = aps.metabolic || {};
        const hem = aps.hematology || {};
        const ren = aps.renal || {};
        const resp = aps.respiratory || {};

        // 1. Temp (C)
        const temp = parseNum(vs.temp);
        if (temp !== null) {
            if (temp >= 41 || temp <= 29.9) score += 4;
            else if (temp >= 39 || temp <= 31.9) score += 3;
            else if (temp <= 33.9) score += 2;
            else if (temp >= 38.5 || temp <= 35.9) score += 1;
        }

        // 2. MAP (mmHg)
        const map = parseNum(vs.pam);
        if (map !== null) {
            if (map >= 160 || map <= 49) score += 4;
            else if (map >= 130) score += 3;
            else if (map >= 110 || map <= 69) score += 2;
        }

        // 3. Heart Rate
        const hr = parseNum(vs.fc);
        if (hr !== null) {
            if (hr >= 180 || hr <= 39) score += 4;
            else if (hr >= 140 || (hr >= 40 && hr <= 54)) score += 3;
            else if (hr >= 110 || (hr >= 55 && hr <= 69)) score += 2;
        }

        // 4. Resp Rate
        const rr = parseNum(vs.fr);
        if (rr !== null) {
            if (rr >= 50 || rr <= 5) score += 4;
            else if (rr >= 35 || (rr >= 6 && rr <= 9)) score += 3;
            else if (rr >= 25 || (rr >= 10 && rr <= 11)) score += 1;
        }

        // 5. pH (phiipinas)
        const ph = parseNum(met.ph);
        if (ph !== null) {
            if (ph >= 7.7 || ph < 7.15) score += 4;
            else if (ph >= 7.6 || (ph >= 7.15 && ph <= 7.24)) score += 3;
            else if (ph >= 7.5 || (ph >= 7.25 && ph <= 7.32)) score += 2;
        }

        // 6. Sodium
        const na = parseNum(met.na);
        if (na !== null) {
            if (na >= 180 || na <= 110) score += 4;
            else if (na >= 160 || (na >= 111 && na <= 119)) score += 3;
            else if (na >= 155 || (na >= 120 && na <= 129)) score += 2;
            else if (na >= 150) score += 1;
        }

        // 7. Potassium
        const k = parseNum(met.k);
        if (k !== null) {
            if (k >= 7 || k < 2.5) score += 4;
            else if (k >= 6) score += 3;
            else if (k <= 2.9) score += 2;
            else if (k >= 5.5 || (k >= 3 && k <= 3.4)) score += 1;
        }

        // 8. Creatinine
        const cre = parseNum(ren.creatinine);
        if (cre !== null) {
            let crePoints = 0;
            if (cre >= 3.5) crePoints = 4;
            else if (cre >= 2) crePoints = 3;
            else if (cre >= 1.5 || cre < 0.6) crePoints = 2;
            score += ren.acute_renal_failure ? (crePoints * 2) : crePoints;
        }

        // 9. Hematocrit
        const hct = parseNum(hem.hto);
        if (hct !== null) {
            if (hct >= 60 || hct < 20) score += 4;
            else if (hct >= 50 || (hct >= 20 && hct <= 29.9)) score += 2;
            else if (hct >= 46) score += 1;
        }

        // 10. WBC count
        const wbc = parseNum(hem.leu);
        if (wbc !== null) {
            if (wbc >= 40 || wbc < 1) score += 4;
            else if (wbc >= 20 || (wbc >= 1 && wbc <= 2.9)) score += 3;
            else if (wbc >= 15) score += 1;
        }

        // 11. Glasgow Coma Scale
        const gcs = parseNum(aps.glasgow) || 15;
        score += (15 - Math.max(3, Math.min(15, gcs)));

        // 12. Oxygenation (Simplified PaO2 pts for FiO2 < 50%)
        const po2 = parseNum(resp.po2);
        if (po2 !== null) {
            if (po2 < 55) score += 4;
            else if (po2 <= 60) score += 3;
            else if (po2 <= 70) score += 1;
        }

        // 13. Age
        const ageNum = parseInt(data.age);
        if (!isNaN(ageNum)) {
            if (ageNum >= 75) score += 6;
            else if (ageNum >= 65) score += 5;
            else if (ageNum >= 55) score += 3;
            else if (ageNum >= 45) score += 2;
        }

        // 14. Chronic Health
        if (aps.chronic_health?.enabled) {
            score += (aps.chronic_health.type === 'elective_post_op' ? 2 : 5);
        }

        return score;
    };


    useEffect(() => {
        if (patientId === 'new') {
            setLoading(false);
            setPatientData((prev: any) => ({
                ...prev,
                // Default values for new patient if needed
                hospital_admission: new Date().toISOString().split('T')[0]
            }));
        } else {
            fetchData();
        }
    }, [patientId]);

    const fetchData = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('patients').select('*').eq('id', patientId).single();
        if (data) {
            // Calculate age from DOB if available
            let calculatedAge = '';
            if (data.dob) {
                const birthDate = new Date(data.dob.split('/').reverse().join('-')); // Assuming dd/mm/yyyy format
                if (!isNaN(birthDate.getTime())) {
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const m = today.getMonth() - birthDate.getMonth();
                    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
                        age--;
                    }
                    calculatedAge = age.toString() + ' años';
                } else {
                    calculatedAge = data.dob; // Fallback just in case
                }
            }

            setPatientData((prev: any) => ({
                ...prev,
                name: data.name,
                hospital_admission: data.admit_date,
                dni: data.dni || '',
                hc: data.hc || '',
                bed: data.bed || '',
                age: calculatedAge,
                physical_exam: data.physical_exam || prev.physical_exam, // Load from DB or keep default structure
                illness_duration: data.illness_duration || '',
                symptoms: data.symptoms || '',
                onset: data.onset || '',
                illness_course: data.physical_exam?.clinical_extras?.illness_course || '',
                anamnesis_text: data.anamnesis_text || '',
                allergies: data.allergies ? data.allergies.join(', ') : '',
                marital_status: data.physical_exam?.clinical_extras?.marital_status || '',
                religion: data.physical_exam?.clinical_extras?.religion || '',
                occupation: data.physical_exam?.clinical_extras?.occupation || '',
                health_problems: data.physical_exam?.clinical_extras?.health_problems || '',
                plan: data.physical_exam?.clinical_extras?.plan || '',
                apache_score: data.apache_score || null
            }));

        }
        setLoading(false);
    };

    const handleChange = (field: string, value: any) => {
        setPatientData((prev: any) => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setSaving(true);

        if (patientId === 'new') {
            const physicalExamPayload = {
                ...patientData.physical_exam,
                clinical_extras: {
                    marital_status: patientData.marital_status,
                    religion: patientData.religion,
                    occupation: patientData.occupation,
                    illness_course: patientData.illness_course,
                    health_problems: patientData.health_problems,
                    plan: patientData.plan
                }
            };

            const apacheScore = calculateApacheII(patientData);

            // Create new patient
            const newPatient = {
                name: patientData.name,
                dni: patientData.dni,
                bed: patientData.bed || '00',
                hc: patientData.hc || 'PENDING',
                status: 'active',
                acuity: patientData.acuity || 'ESTABLE',
                illness_duration: patientData.illness_duration,
                symptoms: patientData.symptoms,
                onset: patientData.onset,
                anamnesis_text: patientData.anamnesis_text,
                admit_date: patientData.hospital_admission,
                physical_exam: physicalExamPayload, // Save structured data
                allergies: patientData.allergies ? patientData.allergies.split(',').map((s: string) => s.trim()).filter((s: string) => s !== '') : [],
                apache_score: apacheScore
            };


            // Warning: The ClinicalHistory form DOES NOT have Bed or HC inputs currently.
            // I should add them if this is to be the primary creation form.

            // For now, let's just insert with what we have and assume we'll fix the missing fields in a moment.
            try {
                const { data, error } = await supabase.from('patients').insert([newPatient]).select();
                if (error) throw error;
                if (data) {
                    // After create, navigate to safety panel
                    navigate(`/safety/${data[0].id}?tab=history`);
                }
            } catch (e: any) {
                alert('Error creando paciente: ' + e.message);
            }
        } else {
            const physicalExamPayload = {
                ...patientData.physical_exam,
                clinical_extras: {
                    marital_status: patientData.marital_status,
                    religion: patientData.religion,
                    occupation: patientData.occupation,
                    illness_course: patientData.illness_course,
                    health_problems: patientData.health_problems,
                    plan: patientData.plan
                }
            };
            
            const apacheScore = calculateApacheII(patientData);
            
            // Update existing
            try {
                const { error } = await supabase.from('patients').update({
                    name: patientData.name,
                    dni: patientData.dni,
                    bed: patientData.bed,
                    hc: patientData.hc,
                    status: 'active',
                    acuity: patientData.acuity,
                    illness_duration: patientData.illness_duration,
                    symptoms: patientData.symptoms,
                    onset: patientData.onset,
                    anamnesis_text: patientData.anamnesis_text,
                    admit_date: patientData.hospital_admission,
                    physical_exam: physicalExamPayload,
                    allergies: patientData.allergies ? patientData.allergies.split(',').map((s: string) => s.trim()).filter((s: string) => s !== '') : [],
                    apache_score: apacheScore
                }).eq('id', patientId);


                if (error) throw error;
                alert('Datos de Historia Clínica Guardados.');
            } catch (e: any) {
                alert('Error actualizando paciente: ' + e.message);
            }
        }
        setSaving(false);
    };

    const generateClinicalHistoryPDF = () => {
        const doc = new jsPDF('p', 'pt', 'a4'); 
        let yPos = 40;

        const boxStyles = { lineColor: [0, 0, 0], lineWidth: 1, fillColor: [255, 255, 255] };
        
        doc.rect(40, yPos, 160, 40); 
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text('Servicio:', 45, yPos + 12);
        doc.text('UCIN', 95, yPos + 12);
        doc.line(40, yPos + 20, 200, yPos + 20);
        doc.text('HCL:', 45, yPos + 32);
        doc.text(patientData.hc || '----', 95, yPos + 32);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(14);
        doc.text('HISTORIA CLÍNICA UCIN – ADULTOS', 250, yPos + 25);
        doc.setLineWidth(1);
        doc.line(250, yPos + 27, 490, yPos + 27);

        yPos += 60;

        const safe = (val: any) => val ? String(val).toUpperCase() : '------';

        const createTable = (head: any[], body: any[], options: any = {}) => {
            autoTable(doc, {
                head: head,
                body: body,
                startY: yPos,
                theme: 'grid',
                styles: {
                    fontSize: 8,
                    textColor: [0, 0, 0],
                    lineColor: [0, 0, 0],
                    lineWidth: 0.5,
                    cellPadding: 3,
                    font: 'helvetica',
                },
                headStyles: {
                    fillColor: [255, 255, 255],
                    textColor: [0, 0, 0],
                    fontStyle: 'bold',
                    halign: 'center',
                },
                ...options
            });
            yPos = (doc as any).lastAutoTable.finalY + 10;
        };

        createTable(
            [[{ content: 'DATOS DE FILIACIÓN', colSpan: 4 }]],
            [
                ['Nombre:', { content: safe(patientData.name), colSpan: 3 }],
                ['Edad: ' + safe(patientData.age), { content: 'Sexo: ' + safe(patientData.sex), colSpan: 2 }, 'DNI: ' + safe(patientData.dni)],
                ['Estado civil: ' + safe(patientData.marital_status), { content: 'Religión: ' + safe(patientData.religion), colSpan: 2 }, 'Ocupación: ' + safe(patientData.occupation)],
                [{ content: 'Fecha de Ingreso al Hosp.: ' + safe(patientData.hospital_admission), colSpan: 4 }],
                [{ content: 'Fecha de ingreso a UCIN: ' + safe(patientData.icu_admission).replace('T', ' '), colSpan: 4 }],
                [{ content: 'Dirección: ' + safe(patientData.address), colSpan: 4 }],
                [{ content: 'Persona Responsable: ' + safe(patientData.relative), colSpan: 2 }, { content: 'CEL: ' + safe(patientData.relative_phone), colSpan: 2 }]
            ]
        );

        const getAntecedentesString = () => {
            let acts = [];
            if(patientData.hx_hta) acts.push('HTA');
            if(patientData.hx_dm) acts.push('DM');
            if(patientData.hx_icc) acts.push('ICC');
            if(patientData.hx_erc) acts.push('ERC');
            if(patientData.hx_tbc) acts.push('TBC');
            if(patientData.hx_epoc) acts.push('EPOC');
            if(patientData.hx_fibrosis) acts.push('FIBROSIS');
            if(patientData.hx_other) acts.push(patientData.hx_other);
            return acts.length > 0 ? acts.join(', ') : 'NIEGA';
        };

        createTable(
            [[{ content: 'ANTECEDENTES', colSpan: 6 }]],
            [
                ['Personales:', { content: getAntecedentesString().toUpperCase(), colSpan: 5 }],
                ['Hábitos Nocivos:', 'Tabaco:', 'NIEGA', 'Alcohol:', 'NIEGA', 'Drogas: NIEGA'],
                ['RAMs/Alergias:', { content: patientData.allergies ? patientData.allergies.toUpperCase() : 'NIEGA', colSpan: 5 }],
                ['Cirugías previas:', { content: safe(patientData.hx_surgical), colSpan: 5 }],
                ['Transfusiones:', { content: 'NIEGA', colSpan: 5 }],
                ['Medicación Habitual:', { content: safe(patientData.hx_medication), colSpan: 5 }],
                ['Familiares:', { content: 'NIEGA', colSpan: 5 }]
            ]
        );

        createTable(
            [[{ content: 'ENFERMEDAD ACTUAL', colSpan: 4 }]],
            [
                ['T.E: ' + safe(patientData.illness_duration), 'Inicio: ' + safe(patientData.onset), {content: 'Curso: ' + safe(patientData.illness_course), colSpan: 2}],
                [{ content: 'Síntomas y Signos: ' + safe(patientData.symptoms), colSpan: 4 }],
                [{ content: safe(patientData.anamnesis_text), colSpan: 4, styles: { cellPadding: 5 } }]
            ]
        );

        const pe = patientData.physical_exam || {};
        const getV = (section: string, field: string) => pe[section] && pe[section][field] ? pe[section][field].toUpperCase() : '';

        createTable(
            [[{ content: 'EXAMEN FÍSICO', colSpan: 8 }]],
            [
                ['Peso', getV('vital_signs', 'weight'), 'PA:', getV('vital_signs', 'pa'), 'FC:', getV('vital_signs', 'fc'), 'SatO2', getV('vital_signs', 'spo2')],
                ['Talla', getV('vital_signs', 'height'), 'T°:', getV('vital_signs', 'temp'), 'FR:', getV('vital_signs', 'fr'), 'FiO2', getV('vital_signs', 'fio2')],
                ['General', { content: getV('neurologic', 'glasgow') || 'REG, REN, REH', colSpan: 7 }],
                ['Piel', { content: 'TIBIA, ELÁSTICA, LLENADO CAPILAR < 2"', colSpan: 7 }],
                ['Neurológico:', { content: safe(pe.neurologic), colSpan: 7 }],
                ['Respiratorio:', { content: 'MV PASA EN AHT. ' + safe(pe.respiratory?.description) + '. SOP. VENT: ' + getV('respiratory', 'interface'), colSpan: 7 }],
                ['Cardiovascular:', { content: safe(pe.cardiovascular), colSpan: 7 }],
                ['Abdomen:', { content: safe(pe.abdomen), colSpan: 7 }],
                [
                    'Renal:', 
                    { content: `UREA: ${getV('renal', 'urea')} CREA: ${getV('renal', 'creatinine')}\nBH: ${getV('renal', 'bh')}`, colSpan: 3 },
                    { content: `pH ${getV('metabolic', 'ph')} pCO2 ${getV('metabolic', 'pco2')}\npO2 ${getV('respiratory', 'po2')} HCO3 ${getV('metabolic', 'hco3')}`, colSpan: 2 },
                    { content: `NA: ${getV('metabolic', 'na')} K: ${getV('metabolic', 'k')}\nCL: ${getV('metabolic', 'cl')}`, colSpan: 2 }
                ],
                [
                    'Metabólico:', 
                    { content: `Glu: ${getV('metabolic','glu')} Lact: ${getV('metabolic','lact')}`, colSpan: 3 },
                    { content: `Ca++: ${getV('metabolic','cai')} Mg++: ${getV('metabolic','mg')}`, colSpan: 2 },
                    { content: `BT: ${getV('metabolic','bt')} TGP: ${getV('metabolic','tgp')}`, colSpan: 2 }
                ],
                [
                    'Hematológico:', 
                    { content: `Hb ${getV('hematology', 'hb')}   Hto: ${getV('hematology', 'hto')}`, colSpan: 3 },
                    { content: `Plaquetas: ${getV('hematology', 'plaq')}`, colSpan: 2 },
                    { content: `Score APACHE II: ${calculateApacheII(patientData)}`, colSpan: 2, styles: { fontStyle: 'bold', textColor: [79, 70, 229] } }
                ],

                [
                    'Infeccioso:', { content: `Leuco ${getV('hematology', 'leu')}   PCR ${getV('infectious', 'pcr')}   PCT ${getV('infectious', 'pct')}`, colSpan: 7 }
                ]
            ]
        );

        createTable(
            [[{ content: 'PROBLEMAS DE SALUD', colSpan: 1 }]],
            [
                [{ content: safe(patientData.health_problems).replace(/\n/g, '\n'), styles: { minCellHeight: 120, cellPadding: 5 } }]
            ]
        );

        createTable(
            [[{ content: 'PLAN', colSpan: 1 }]],
            [
                [{ content: safe(patientData.plan).replace(/\n/g, '\n'), styles: { minCellHeight: 120, cellPadding: 5 } }]
            ]
        );

        const safeName = patientData.name ? String(patientData.name).replace(/ /g, '_') : 'Desconocido';
        doc.save(`HC_${patientData.hc || 'nueva'}_${safeName}.pdf`);
    };

    const renderFiliacion = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Nombre Completo</label>
                <input type="text" value={patientData.name} onChange={e => handleChange('name', e.target.value)} readOnly={patientId !== 'new'} className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 ${patientId === 'new' ? 'bg-white' : 'bg-slate-50'}`} />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Historia Clínica</label>
                <input type="text" value={patientData.hc} onChange={e => handleChange('hc', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="HC-..." />
            </div>
            <div className="md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Cama</label>
                <input type="text" value={patientData.bed} onChange={e => handleChange('bed', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="00" />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Edad</label>
                <input type="text" value={patientData.age} onChange={e => handleChange('age', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Ej: 45 años" />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Sexo</label>
                <select value={patientData.sex} onChange={e => handleChange('sex', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">Seleccionar...</option>
                    <option value="M">Masculino</option>
                    <option value="F">Femenino</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">DNI / CE</label>
                <input type="text" value={patientData.dni} onChange={e => handleChange('dni', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Estado Civil</label>
                <select value={patientData.marital_status} onChange={e => handleChange('marital_status', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">Seleccionar...</option>
                    <option value="SOLTERO">Soltero(a)</option>
                    <option value="CASADO">Casado(a)</option>
                    <option value="DIVORCIADO">Divorciado(a)</option>
                    <option value="VIUDO">Viudo(a)</option>
                    <option value="CONVIVIENTE">Conviviente</option>
                </select>
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Religión</label>
                <input type="text" value={patientData.religion} onChange={e => handleChange('religion', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Ej: Católica" />
            </div>
            <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Ocupación</label>
                <input type="text" value={patientData.occupation} onChange={e => handleChange('occupation', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Ej: Maestro, Comerciante..." />
            </div>

            <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Dirección</label>
                <input type="text" value={patientData.address} onChange={e => handleChange('address', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Av. Principal 123..." />
            </div>
            <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Familiar Responsable</label>
                <input type="text" value={patientData.relative} onChange={e => handleChange('relative', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Nombre y parentesco" />
            </div>
            <div className="col-span-2 md:col-span-1">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Teléfono de Contacto</label>
                <input type="tel" value={patientData.relative_phone} onChange={e => handleChange('relative_phone', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" placeholder="Ej: 999-999-999" />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Ingreso Hospital</label>
                <input type="date" value={patientData.hospital_admission} onChange={e => handleChange('hospital_admission', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Fecha de Pase a UCIN</label>
                <input type="datetime-local" value={patientData.ucin_transfer_date} onChange={e => handleChange('ucin_transfer_date', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
                <p className="text-[10px] text-slate-400 mt-1">Evaluación por interconsulta / Pase a área crítica</p>
            </div>
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Ingreso Físico UCIN</label>
                <input type="datetime-local" value={patientData.icu_admission} onChange={e => handleChange('icu_admission', e.target.value)} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm" />
            </div>
        </div>
    );

    const renderAntecedentes = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary text-lg">medical_services</span>
                    Patológicos
                </h4>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { key: 'hx_hta', label: 'HTA' },
                        { key: 'hx_dm', label: 'DM' },
                        { key: 'hx_icc', label: 'ICC' },
                        { key: 'hx_erc', label: 'ERC' },
                        { key: 'hx_tbc', label: 'Tuberculosis' },
                        { key: 'hx_epoc', label: 'EPOC' },
                        { key: 'hx_fibrosis', label: 'Fibrosis Pulmonar' },
                    ].map(item => (
                        <label key={item.key} className="flex items-center gap-2 cursor-pointer p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200">
                            <input
                                type="checkbox"
                                checked={patientData[item.key]}
                                onChange={e => handleChange(item.key, e.target.checked)}
                                className="rounded text-primary focus:ring-primary size-4"
                            />
                            <span className="text-sm text-slate-700 font-medium">{item.label}</span>
                        </label>
                    ))}
                    <div className="col-span-2">
                        <label className="flex flex-col gap-1 cursor-pointer p-2">
                            <span className="text-sm text-slate-700 font-medium">Otros Antecedentes:</span>
                            <textarea
                                value={patientData.hx_other}
                                onChange={e => handleChange('hx_other', e.target.value)}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm min-h-[50px] focus:border-primary focus:ring-primary/20"
                                placeholder="Especificar otros antecedentes patológicos..."
                            />
                        </label>
                    </div>
                </div>
            </div>

            <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                <h4 className="text-sm font-bold text-red-700 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg">warning</span>
                    Alergias a Medicamentos
                </h4>
                <textarea
                    value={patientData.allergies}
                    onChange={e => handleChange('allergies', e.target.value)}
                    className="w-full border border-red-200 rounded-lg p-3 text-sm min-h-[60px] focus:border-red-400 focus:ring-red-400/20"
                    placeholder="Ingrese medicamentos a los que el paciente es alérgico, separados por comas..."
                />
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200">
                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-orange-500 text-lg">accessibility_new</span>
                    Valoración Funcional Previa
                </h4>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Índice de Katz (Estado Basal)</label>
                    <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-xs text-slate-500 uppercase font-bold text-center">
                                <tr>
                                    <th className="px-4 py-3 w-1/3 text-left">Actividad</th>
                                    <th className="px-4 py-3 w-1/3">Independiente (1 pt)</th>
                                    <th className="px-4 py-3 w-1/3">Dependiente (0 pt)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {[
                                    {
                                        key: 'bathing',
                                        label: '1. Baño',
                                        ind: 'Se baña solo o precisa ayuda para lavar alguna zona, como la espalda, o una extremidad con minusvalía.',
                                        dep: 'Precisa ayuda para lavar más de una zona, para salir o entrar en la bañera, o no puede bañarse solo.'
                                    },
                                    {
                                        key: 'dressing',
                                        label: '2. Vestido',
                                        ind: 'Saca ropa de cajones y armarios, se la pone, y abrocha. Se excluye el acto de atarse los zapatos.',
                                        dep: 'No se viste por sí mismo, o permanece parcialmente desvestido.'
                                    },
                                    {
                                        key: 'toileting',
                                        label: '3. Uso del WC',
                                        ind: 'Va al WC solo, se arregla la ropa y se limpia.',
                                        dep: 'Precisa ayuda para ir al WC.'
                                    },
                                    {
                                        key: 'transferring',
                                        label: '4. Movilidad',
                                        ind: 'Se levanta y acuesta en la cama por sí mismo, y puede levantarse de una silla por sí mismo.',
                                        dep: 'Precisa ayuda para levantarse y acostarse en la cama o silla. No realiza uno o más desplazamientos.'
                                    },
                                    {
                                        key: 'continence',
                                        label: '5. Continencia',
                                        ind: 'Control completo de micción y defecación.',
                                        dep: 'Incontinencia parcial o total de la micción o defecación.'
                                    },
                                    {
                                        key: 'feeding',
                                        label: '6. Alimentación',
                                        ind: 'Lleva el alimento a la boca desde el plato o equivalente (se excluye cortar la carne).',
                                        dep: 'Precisa ayuda para comer, no come en absoluto, o requiere alimentación parenteral.'
                                    },
                                ].map((item) => (
                                    <tr key={item.key} className="hover:bg-white transition-colors group">
                                        <td className="px-4 py-4 align-top w-1/4">
                                            <span className="font-bold text-slate-800 block mb-1">{item.label}</span>
                                        </td>
                                        <td className="px-4 py-3 align-top w-1/3 relative">
                                            <label
                                                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all h-full ${patientData.katz?.[item.key] === 'independent'
                                                    ? 'bg-emerald-50 border-emerald-200 ring-1 ring-emerald-200'
                                                    : 'border-transparent hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className="pt-0.5 shrink-0">
                                                    <input
                                                        type="radio"
                                                        name={`katz_${item.key}`}
                                                        checked={patientData.katz?.[item.key] === 'independent'}
                                                        onChange={() => {
                                                            const currentKatz = patientData.katz || {};
                                                            handleChange('katz', { ...currentKatz, [item.key]: 'independent' });
                                                        }}
                                                        className="size-4 text-emerald-600 focus:ring-emerald-500 border-slate-300"
                                                    />
                                                </div>
                                                <div className="text-xs text-slate-600 leading-relaxed">
                                                    <span className="font-bold text-emerald-700 block mb-0.5">Independiente</span>
                                                    {item.ind}
                                                </div>
                                            </label>
                                        </td>
                                        <td className="px-4 py-3 align-top w-1/3">
                                            <label
                                                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all h-full ${patientData.katz?.[item.key] === 'dependent'
                                                    ? 'bg-red-50 border-red-200 ring-1 ring-red-200'
                                                    : 'border-transparent hover:bg-slate-50'
                                                    }`}
                                            >
                                                <div className="pt-0.5 shrink-0">
                                                    <input
                                                        type="radio"
                                                        name={`katz_${item.key}`}
                                                        checked={patientData.katz?.[item.key] === 'dependent'}
                                                        onChange={() => {
                                                            const currentKatz = patientData.katz || {};
                                                            handleChange('katz', { ...currentKatz, [item.key]: 'dependent' });
                                                        }}
                                                        className="size-4 text-red-600 focus:ring-red-500 border-slate-300"
                                                    />
                                                </div>
                                                <div className="text-xs text-slate-600 leading-relaxed">
                                                    <span className="font-bold text-red-700 block mb-0.5">Dependiente</span>
                                                    {item.dep}
                                                </div>
                                            </label>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t border-slate-200">
                                <tr>
                                    <td colSpan={3} className="px-4 py-3 text-right">
                                        <span className="text-xs font-bold text-slate-500 uppercase mr-2">Puntaje Total:</span>
                                        <span className="text-lg font-black text-slate-800">
                                            {Object.values(patientData.katz || {}).filter(v => v === 'independent').length} / 6
                                        </span>
                                        <span className="ml-3 text-xs font-medium px-2 py-1 rounded bg-slate-200 text-slate-600">
                                            {(() => {
                                                const score = Object.values(patientData.katz || {}).filter(v => v === 'independent').length;
                                                if (score === 6) return 'Independiente (A)';
                                                if (score >= 4) return 'Dependencia Leve (B)';
                                                if (score >= 2) return 'Dependencia Moderada (C-D)';
                                                return 'Dependencia Severa (E-G)';
                                            })()}
                                        </span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Antecedentes Quirúrgicos</label>
                    <textarea
                        value={patientData.hx_surgical}
                        onChange={e => handleChange('hx_surgical', e.target.value)}
                        className="w-full border border-slate-200 rounded-xl p-3 text-sm min-h-[100px]"
                        placeholder="Cirugías previas y fechas aproximadas..."
                    ></textarea>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Medicación Habitual</label>
                    <textarea
                        value={patientData.hx_medication}
                        onChange={e => handleChange('hx_medication', e.target.value)}
                        className="w-full border border-slate-200 rounded-xl p-3 text-sm min-h-[100px]"
                        placeholder="Fármacos que consume regularmente..."
                    ></textarea>
                </div>
            </div>
        </div>
    );

    const renderAnamnesis = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Signos y Síntomas Principales</label>
                <input
                    type="text"
                    value={patientData.symptoms}
                    onChange={e => handleChange('symptoms', e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold"
                    placeholder="Ej: Disnea, fiebre, tos productiva..."
                />
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Tiempo de Enfermedad</label>
                    <input
                        type="text"
                        value={patientData.illness_duration}
                        onChange={e => handleChange('illness_duration', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                        placeholder="Ej: 3 días, 4 horas..."
                    />
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Forma de Inicio</label>
                    <select
                        value={patientData.onset}
                        onChange={e => handleChange('onset', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    >
                        <option value="">Seleccionar...</option>
                        <option value="INSIDIOSO">Insidioso</option>
                        <option value="BRUSCO">Brusco</option>
                    </select>
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Curso</label>
                    <select
                        value={patientData.illness_course}
                        onChange={e => handleChange('illness_course', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
                    >
                        <option value="">Seleccionar...</option>
                        <option value="PROGRESIVO">Progresivo</option>
                        <option value="ESTACIONARIO">Estacionario</option>
                        <option value="FLUCTUANTE">Fluctuante</option>
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Relato Cronológico (Anamnesis)</label>
                <div className="relative">
                    <textarea
                        value={patientData.anamnesis_text}
                        onChange={e => handleChange('anamnesis_text', e.target.value)}
                        className="w-full border border-slate-200 rounded-xl p-4 text-sm min-h-[250px] leading-relaxed resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="Escriba aquí el relato de la enfermedad (mínimo 2 párrafos)..."
                    ></textarea>
                    <div className="absolute bottom-3 right-4 text-xs text-slate-400 font-medium">Se recomiendan 2 párrafos de detalle.</div>
                </div>
            </div>
        </div>
    );

    const renderPhysicalExam = () => {
        const handlePhyChange = (section: string, field: string, value: string) => {
            setPatientData((prev: any) => ({
                ...prev,
                physical_exam: {
                    ...prev.physical_exam,
                    [section]: {
                        ...prev.physical_exam[section],
                        [field]: value
                    }
                }
            }));
        };

        const handlePhyTextChange = (field: string, value: string) => {
            setPatientData((prev: any) => ({
                ...prev,
                physical_exam: {
                    ...prev.physical_exam,
                    [field]: value
                }
            }));
        };

        const renderInput = (label: string, section: string, field: string, placeholder = '', width = '', type: 'text' | 'number' = 'number') => (
            <PhysicalExamInput
                label={label}
                value={patientData.physical_exam?.[section]?.[field] || ''}
                onChange={(val) => handlePhyChange(section, field, val)}
                placeholder={placeholder}
                width={width}
                type={type}
            />
        );

        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 select-none">
                {/* Signos Vitales */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3 border-b pb-2 border-slate-200">Signos Vitales y Biológicos</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {renderInput("PA (mmHg)", "vital_signs", "pa", "120/80", "", "text")}
                        {renderInput("PAM", "vital_signs", "pam", "93")}
                        {renderInput("SPO2 (%)", "vital_signs", "spo2", "98%")}
                        {renderInput("EtCO2", "vital_signs", "etco2")}
                        {renderInput("Peso (Kg)", "vital_signs", "weight")}
                        {renderInput("Talla (m)", "vital_signs", "height")}

                        {renderInput("FR (rpm)", "vital_signs", "fr")}
                        {renderInput("FC (lpm)", "vital_signs", "fc")}
                        {renderInput("FiO2 (%)", "vital_signs", "fio2")}
                        {renderInput("Temp (ºC)", "vital_signs", "temp")}
                        {renderInput("P. Id.", "vital_signs", "pid")}
                        {renderInput("IMC", "vital_signs", "imc")}
                    </div>
                </div>

                {/* Neurológico */}
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Neurológico</h4>
                        <div className="flex items-center gap-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Glasgow (GCS):</label>
                            <input 
                                type="number" 
                                min="3" 
                                max="15" 
                                value={patientData.physical_exam?.glasgow || 15}
                                onChange={(e) => handlePhyChange('neurologic', 'glasgow', e.target.value)}
                                className="w-12 border border-slate-200 rounded px-1 py-0.5 text-xs font-bold text-center"
                            />
                        </div>
                    </div>
                    <textarea
                        value={patientData.physical_exam?.neurologic || ''}
                        onChange={(e) => handlePhyTextChange('neurologic', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs min-h-[40px] resize-none"
                        placeholder="Descripción neurológica (Pupilas, Sedación, Motor...)"
                    />
                </div>


                {/* Cardiovascular */}
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-2">Cardiovascular</h4>
                    <textarea
                        value={patientData.physical_exam?.cardiovascular || ''}
                        onChange={(e) => handlePhyTextChange('cardiovascular', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs min-h-[40px] resize-none"
                        placeholder="Ruidos cardiacos, llenado capilar, edemas, perfusión..."
                    />
                </div>

                {/* Respiratorio */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3 border-b pb-2 border-slate-200">Respiratorio / Ventilatorio</h4>

                    <div className="mb-4">
                        <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Examen Físico Respiratorio</label>
                        <textarea
                            value={patientData.physical_exam?.respiratory?.description || ''}
                            onChange={(e) => handlePhyChange('respiratory', 'description', e.target.value)}
                            className="w-full border border-slate-200 rounded-lg p-2 text-xs min-h-[40px] resize-none bg-white focus:border-primary focus:ring-1 focus:ring-primary/20"
                            placeholder="Murmullo vehicular, ruidos agregados, tirajes..."
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-y-3 gap-x-4">
                        <div className="md:col-span-12 lg:col-span-4 mb-2">
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Interface</label>
                            <select
                                value={patientData.physical_exam?.respiratory?.interface || ''}
                                onChange={(e) => handlePhyChange('respiratory', 'interface', e.target.value)}
                                className="w-full border border-slate-200 rounded px-2 py-1.5 text-xs font-bold text-slate-700 bg-white focus:border-primary focus:ring-1 focus:ring-primary/20"
                            >
                                <option value="">Seleccionar...</option>
                                <option value="Ventilando espontáneamente sin O2">Ventilando espontáneamente sin O2</option>
                                <option value="Ventilación no invasiva / CNAF">Ventilación no invasiva / CNAF</option>
                                <option value="Ventilación invasiva">Ventilación invasiva</option>
                            </select>
                        </div>

                        {(patientData.physical_exam?.respiratory?.interface === 'Ventilación invasiva') && (
                            <div className="md:col-span-12 lg:col-span-8 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 animate-in fade-in slide-in-from-top-2">
                                {renderInput("FiO2", "respiratory", "fio2")}
                                {renderInput("PC", "respiratory", "pc")}
                                {renderInput("Ppico", "respiratory", "ppico")}
                                {renderInput("T.ins", "respiratory", "t_ins")}
                                {renderInput("VCI", "respiratory", "vci")}

                                {renderInput("FR (Set)", "respiratory", "fr")}
                                {renderInput("PEEP", "respiratory", "peep")}
                                {renderInput("I:E", "respiratory", "ie", "", "", "text")}
                                {renderInput("CDIN", "respiratory", "cdin")}
                                {renderInput("VCE", "respiratory", "vce")}

                                {renderInput("PO2", "respiratory", "po2")}
                                {renderInput("PCO2", "respiratory", "pco2")}
                                {renderInput("PaFiO2", "respiratory", "pafio2")}
                                {renderInput("G(A-a)", "respiratory", "gaa")}
                            </div>
                        )}


                        {(patientData.physical_exam?.respiratory?.interface === 'Ventilación no invasiva / CNAF') && (
                            <div className="md:col-span-12 lg:col-span-8 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 animate-in fade-in slide-in-from-top-2">
                                {renderInput("FiO2", "respiratory", "fio2")}
                                {renderInput("PaFiO2", "respiratory", "pafio2")}
                            </div>
                        )}
                    </div>
                </div>

                {/* Renal */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3 border-b pb-2 border-slate-200">Renal / Medio Interno</h4>
                    <div className="flex flex-wrap gap-4 items-end mb-4">
                        {renderInput("Urea (mg/dL)", "renal", "urea", "", "w-24")}
                        {renderInput("Crea (mg/dL)", "renal", "creatinine", "", "w-24")}
                        {renderInput("F.G.", "renal", "fg", "", "w-24")}
                        <div className="flex-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase mb-1">Balance Hídrico (BH)</label>
                            <input
                                type="text"
                                value={patientData.physical_exam?.renal?.bh || ''}
                                onChange={(e) => handlePhyChange('renal', 'bh', e.target.value)}
                                className="w-full border border-slate-200 rounded px-2 py-1 text-xs"
                            />
                        </div>
                    </div>
                </div>

                {/* Metabólico */}
                <div className="bg-white p-4 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3 border-b pb-2 border-slate-200">Metabólico / Hepático</h4>
                    <div className="space-y-3">
                        {/* Electrolitos */}
                        <div className="flex flex-wrap gap-2">
                            <span className="text-xs font-bold text-slate-400 w-12 flex items-center">Iones:</span>
                            {renderInput("Na+", "metabolic", "na", "", "w-16")}
                            {renderInput("K+", "metabolic", "k", "", "w-16")}
                            {renderInput("Cl-", "metabolic", "cl", "", "w-16")}
                            {renderInput("Ca++ i", "metabolic", "cai", "", "w-16")}
                            {renderInput("Ca++ s", "metabolic", "cas", "", "w-16")}
                            {renderInput("P+", "metabolic", "p", "", "w-16")}
                            {renderInput("Mg++", "metabolic", "mg", "", "w-16")}
                        </div>
                        {/* AGA */}
                        <div className="flex flex-wrap gap-2 bg-blue-50/50 p-2 rounded-lg">
                            <span className="text-xs font-bold text-blue-400 w-12 flex items-center">AGA:</span>
                            {renderInput("PH", "metabolic", "ph", "", "w-16")}
                            {renderInput("HCO3-", "metabolic", "hco3", "", "w-16")}
                            {renderInput("EB", "metabolic", "eb", "", "w-16")}
                            {renderInput("Glu", "metabolic", "glu", "", "w-16")}
                            {renderInput("Lact", "metabolic", "lact", "", "w-16")}
                            {renderInput("Osmo", "metabolic", "osmo", "", "w-20")}
                        </div>
                        {/* Perfil Hepático */}
                        <div className="flex flex-wrap gap-2">
                            <span className="text-xs font-bold text-amber-500 w-12 flex items-center">Hígado:</span>
                            {renderInput("BT", "metabolic", "bt", "", "w-14")}
                            {renderInput("BD", "metabolic", "bd", "", "w-14")}
                            {renderInput("BI", "metabolic", "bi", "", "w-14")}
                            {renderInput("TGO", "metabolic", "tgo", "", "w-14")}
                            {renderInput("TGP", "metabolic", "tgp", "", "w-14")}

                            {renderInput("PT", "metabolic", "pt", "", "w-14")}
                            {renderInput("Alb", "metabolic", "alb", "", "w-14")}
                            {renderInput("FA", "metabolic", "fa", "", "w-14")}
                            {renderInput("GGT", "metabolic", "ggt", "", "w-14")}
                            {renderInput("DHL", "metabolic", "dhl", "", "w-14")}
                        </div>
                    </div>
                </div>

                {/* Abdomen */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-2">Abdomen</h4>
                    <textarea
                        value={patientData.physical_exam?.abdomen || ''}
                        onChange={(e) => handlePhyTextChange('abdomen', e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs min-h-[40px] resize-none"
                        placeholder="Blando, depresible, ruidos hidroaéreos..."
                    />
                </div>

                {/* Infeccioso / Inflamatorio y Hematológico */}
                <div className="grid grid-cols-1 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3 border-b pb-2 border-slate-200">Infeccioso / Inflamatorio</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                            {renderInput("PCR", "infectious", "pcr")}
                            {renderInput("Procalcitonina (PCT)", "infectious", "pct")}
                            {renderInput("Días Atb", "infectious", "antibiotic_days")}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Antibiótico Actual</label>
                                <textarea
                                    value={patientData.physical_exam?.infectious?.antibiotic || ''}
                                    onChange={(e) => handlePhyChange('infectious', 'antibiotic', e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg p-2 text-xs min-h-[40px] resize-none bg-white"
                                    placeholder="Meropenem, Vancomicina..."
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase mb-1 block">Cultivos</label>
                                <textarea
                                    value={patientData.physical_exam?.infectious?.cultures || ''}
                                    onChange={(e) => handlePhyChange('infectious', 'cultures', e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg p-2 text-xs min-h-[40px] resize-none bg-white"
                                    placeholder="Hemocultivo: Negativo..."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200">
                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-3 border-b pb-2 border-slate-200">Hematología</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                            {renderInput("Hb (g/dL)", "hematology", "hb")}
                            {renderInput("Hto (%)", "hematology", "hto")}
                            {renderInput("Plaq (mm3)", "hematology", "plaq")}
                            {renderInput("TP", "hematology", "tp")}
                            {renderInput("INR", "hematology", "inr")}
                            {renderInput("Fib", "hematology", "fib")}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 bg-red-50/50 p-3 rounded-lg border border-red-100">
                            {renderInput("Leucocitos", "hematology", "leu")}
                            {renderInput("Neutrófilos", "hematology", "seg")} {/* Segments are neutrophils usually in this context */}
                            {renderInput("Abastonados", "hematology", "ab")}
                            {renderInput("Linfocitos", "hematology", "linf")}
                            {renderInput("Monocitos", "hematology", "hma")} {/* Using HMA slot for Monocitos if appropriate or create new */}
                            {/* Assuming HMA, L.Ce were specific other cells, mapping broadly or keeping generic */}
                            {renderInput("Eosinófilos", "hematology", "lce")}
                        </div>
                    </div>
                </div>

                {/* Score APACHE II & Chronic Health (Combined) */}
                <div className="bg-indigo-50 p-5 rounded-2xl border border-indigo-100 shadow-sm mt-6">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                        <div className="flex-1">
                            <h4 className="text-sm font-black text-indigo-900 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-indigo-600">health_metrics</span>
                                APACHE II & Salud Crónica
                            </h4>
                            
                            <div className="space-y-4">
                                <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-indigo-100 cursor-pointer hover:bg-indigo-50/50 transition-colors">
                                    <input 
                                        type="checkbox"
                                        checked={patientData.physical_exam?.chronic_health?.enabled || false}
                                        onChange={(e) => handlePhyChange('chronic_health', 'enabled', e.target.checked)}
                                        className="size-5 rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <div>
                                        <span className="text-sm font-bold text-slate-700 block">Antecedente de Insuficiencia Orgánica Grave</span>
                                        <span className="text-[10px] text-slate-500 leading-tight block">Cirrosis, ICC NYHA IV, EPOC severo, Diálisis crónica o Inmunocomprometido.</span>
                                    </div>
                                </label>

                                {patientData.physical_exam?.chronic_health?.enabled && (
                                    <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
                                        <button 
                                            onClick={() => handlePhyChange('chronic_health', 'type', 'non_operative')}
                                            className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${patientData.physical_exam?.chronic_health?.type === 'non_operative' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200'}`}
                                        >
                                            No Operado / Emergencia (+5 pts)
                                        </button>
                                        <button 
                                            onClick={() => handlePhyChange('chronic_health', 'type', 'elective_post_op')}
                                            className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${patientData.physical_exam?.chronic_health?.type === 'elective_post_op' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200'}`}
                                        >
                                            Post-Op Electivo (+2 pts)
                                        </button>
                                    </div>
                                )}

                                <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                                    <input 
                                        type="checkbox"
                                        checked={patientData.physical_exam?.renal?.acute_renal_failure || false}
                                        onChange={(e) => handlePhyChange('renal', 'acute_renal_failure', e.target.checked)}
                                        className="size-4 rounded text-red-600 focus:ring-red-500"
                                    />
                                    <span className="text-xs font-bold text-red-700">Falla Renal Aguda (Duplica puntos de Creatinina)</span>
                                </div>
                            </div>
                        </div>

                        <div className="w-full md:w-64 flex flex-col items-center justify-center bg-white rounded-2xl border border-indigo-200 p-6 shadow-inner">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Score APACHE II</span>
                            <div className="text-6xl font-black text-indigo-600 tracking-tighter leading-none mb-2">
                                {calculateApacheII(patientData)}
                            </div>
                            <div className="text-center">
                                <div className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter ${
                                    calculateApacheII(patientData) > 25 ? 'bg-red-100 text-red-600' : 
                                    calculateApacheII(patientData) > 15 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                                }`}>
                                    {calculateApacheII(patientData) > 25 ? 'Riesgo Muy Alto' : 
                                     calculateApacheII(patientData) > 15 ? 'Riesgo Moderado' : 'Riesgo Bajo'}
                                </div>
                                <p className="text-[9px] text-slate-400 mt-2 font-medium">Predice mortalidad intrahospitalaria</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        );
    };

    const renderProblems = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Lista de Problemas de Salud</label>
                    <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-800 mb-2 border border-amber-100 font-medium">
                        Liste los problemas activos e inactivos del paciente para el plan de atención.
                    </div>
                    <div className="relative">
                        <textarea
                            value={patientData.health_problems}
                            onChange={e => handleChange('health_problems', e.target.value)}
                            className="w-full border border-slate-200 rounded-xl p-4 text-sm min-h-[300px] leading-relaxed resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                            placeholder="1. Insuficiencia Respiratoria Aguda&#10;2. Shock Séptico..."
                        ></textarea>
                    </div>
                </div>
                
                <div className="space-y-4">
                    <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-lg border border-indigo-400 overflow-hidden relative group">
                         <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <span className="material-symbols-outlined text-6xl">analytics</span>
                        </div>
                        <h5 className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 text-indigo-200">Score APACHE II</h5>
                        <div className="text-5xl font-black tracking-tighter mb-1">{calculateApacheII(patientData)}</div>
                        <div className="text-[10px] font-bold text-indigo-100 uppercase opacity-80 mb-4">Puntos Calculados</div>
                        
                        <div className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${
                            calculateApacheII(patientData) > 25 ? 'bg-red-500 text-white' : 
                            calculateApacheII(patientData) > 15 ? 'bg-amber-400 text-indigo-900' : 'bg-emerald-400 text-indigo-900'
                        }`}>
                            {calculateApacheII(patientData) > 25 ? 'Riesgo Muy Alto' : 
                             calculateApacheII(patientData) > 15 ? 'Riesgo Moderado' : 'Riesgo Bajo'}
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Estado de Gravedad</label>
                        <select 
                            value={patientData.acuity} 
                            onChange={e => handleChange('acuity', e.target.value)} 
                            className={`w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                                patientData.acuity === 'ALTA' ? 'bg-red-50 text-red-600' : 
                                patientData.acuity === 'MEDIA' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                            }`}
                        >
                            <option value="ESTABLE">Estable</option>
                            <option value="MEDIA">Crítico Estabilizado (Media)</option>
                            <option value="ALTA">Crítico Inestable (Alta)</option>
                        </select>
                    </div>
                </div>
            </div>
        </div >
    );


    const renderPlan = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Plan de Trabajo / Terapéutico</label>
                <div className="relative">
                    <textarea
                        value={patientData.plan}
                        onChange={e => handleChange('plan', e.target.value)}
                        className="w-full border border-slate-200 rounded-xl p-4 text-sm min-h-[300px] leading-relaxed resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="Detalle el plan diagnóstico y terapéutico..."
                    ></textarea>
                </div>
            </div>
        </div>
    );

    if (loading) return <div className="p-10 text-center text-slate-400">Cargando Historia Clínica...</div>;

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Historia Clínica de Admisión</h2>
                    <p className="text-xs text-slate-500">Datos de Ingreso a UCI</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={generateClinicalHistoryPDF}
                        className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all shadow-md flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-lg">download</span>
                        Descargar PDF
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-primary text-white px-5 py-2 rounded-lg font-bold text-sm hover:bg-blue-600 transition-all shadow-md disabled:opacity-70 flex items-center gap-2"
                    >
                        <span className="material-symbols-outlined text-lg">save</span>
                        {saving ? 'Guardando...' : 'Guardar Cambios'}
                    </button>
                    {patientId === 'new' && (
                        <button
                            onClick={() => window.location.hash = '/'}
                            className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-200 transition-all flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-lg">dashboard</span>
                            Volver al Dashboard
                        </button>
                    )}
                </div>
            </div>

            <div className="flex border-b border-slate-200 bg-slate-50 px-6">
                <button
                    onClick={() => setActiveSection('filiacion')}
                    className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${activeSection === 'filiacion' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    1. Filiación
                </button>
                <button
                    onClick={() => setActiveSection('antecedentes')}
                    className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${activeSection === 'antecedentes' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    2. Antecedentes
                </button>
                <button
                    onClick={() => setActiveSection('anamnesis')}
                    className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${activeSection === 'anamnesis' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    3. Anamnesis
                </button>
                <button
                    onClick={() => setActiveSection('examen_fisico')}
                    className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${activeSection === 'examen_fisico' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    4. Examen Físico
                </button>
                <button
                    onClick={() => setActiveSection('problemas')}
                    className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${activeSection === 'problemas' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    5. Probl. Salud
                </button>
                <button
                    onClick={() => setActiveSection('plan')}
                    className={`px-4 py-3 text-sm font-bold border-b-2 transition-all ${activeSection === 'plan' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    6. Plan
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 pb-32 bg-[#f8f9fc]">
                <div className="max-w-4xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mb-10">
                    {activeSection === 'filiacion' && renderFiliacion()}
                    {activeSection === 'antecedentes' && renderAntecedentes()}
                    {activeSection === 'anamnesis' && renderAnamnesis()}
                    {activeSection === 'examen_fisico' && renderPhysicalExam()}
                    {activeSection === 'problemas' && renderProblems()}
                    {activeSection === 'plan' && renderPlan()}
                </div>
            </div>
        </div>
    );
};

export default ClinicalHistory;

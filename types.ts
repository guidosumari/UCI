
export enum Acuity {
  HIGH = 'ALTA',
  MOD = 'MEDIA',
  STABLE = 'ESTABLE'
}

export interface Patient {
  id: string;
  bed: string;
  name: string;
  dni: string; // DNI / Carnet de Extranjería
  hc: string;  // Historia Clínica
  acuity: Acuity;
  dob: string;
  admitDate: string;
  weight: number;
  allergies: string[];
  isbarStatus: number; // 1-5
  lastValidated: string;
  nurse: string;
  nurseAvatar: string;
  generalStatus: string;
  status?: 'active' | 'discharged' | 'deceased' | 'transferred';
  outcome?: string;
  lastClinicalUpdate?: string;
  physicalExam?: any;
}

export interface VitalSign {
  time: string;
  value: number;
}

export interface Device {
  id: string;
  type: string;
  location: string;
  inserted: string;
  status: 'activo' | 'vencido' | 'pendiente';
  nextCheck: string;
}

export interface Interconsultation {
  id: string;
  created_at: string;
  patient_name: string;
  dni?: string;
  age: number;
  sex: string;
  hc: string;
  service_origin: string;
  bed_number: string;
  reason: 'procedimiento' | 'evaluacion_pase' | 'pcr' | 'ustna';
  procedure_type?: 'cvc' | 'intubacion';
  cvc_location?: string;
  cvc_attempts?: number;
  cvc_operators?: string;
  health_problem_1?: string;
  health_problem_2?: string;
  priority?: '1' | '2' | '3' | '4A' | '4B';
  response_date?: string;
  responders?: string;
  status: 'pending' | 'completed' | 'admitted';
}

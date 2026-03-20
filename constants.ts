
import { Patient, Acuity, Device } from './types';

export const MOCK_PATIENTS: Patient[] = [
  {
    id: '1',
    bed: '01',
    name: 'P. Smith',
    dni: '45678901',
    hc: '100456',
    acuity: Acuity.HIGH,
    dob: '12/05/1955',
    admitDate: '12 Oct, 2023',
    weight: 72,
    allergies: ['Penicilina'],
    isbarStatus: 2,
    lastValidated: 'hace 30m',
    nurse: 'Enf. Jones',
    nurseAvatar: 'https://picsum.photos/id/64/200/200',
    generalStatus: 'Inestable hemodinámicamente'
  },
  {
    id: '2',
    bed: '02',
    name: 'J. Doe',
    dni: '12345678',
    hc: '200123',
    acuity: Acuity.MOD,
    dob: '04/12/1960',
    admitDate: '14 Oct, 2023',
    weight: 85,
    allergies: ['Látex'],
    isbarStatus: 3,
    lastValidated: 'hace 1h',
    nurse: 'Enf. Smith',
    nurseAvatar: 'https://picsum.photos/id/65/200/200',
    generalStatus: 'Post-quirúrgico inmediato'
  },
  {
    id: '3',
    bed: '03',
    name: 'M. Kim',
    dni: '87654321',
    hc: '300789',
    acuity: Acuity.STABLE,
    dob: '22/08/1982',
    admitDate: '15 Oct, 2023',
    weight: 64,
    allergies: [],
    isbarStatus: 5,
    lastValidated: 'Ahora mismo',
    nurse: 'Enf. Wu',
    nurseAvatar: 'https://picsum.photos/id/66/200/200',
    generalStatus: 'En observación / Pre-alta'
  },
  {
    id: '4',
    bed: '04',
    name: 'L. García',
    dni: '99887766',
    hc: '400999',
    acuity: Acuity.MOD,
    dob: '30/11/1975',
    admitDate: '11 Oct, 2023',
    weight: 90,
    allergies: ['Sulfa'],
    isbarStatus: 4,
    lastValidated: 'hace 2h',
    nurse: 'Enf. White',
    nurseAvatar: 'https://picsum.photos/id/67/200/200',
    generalStatus: 'En destete ventilatorio'
  }
];

export const MOCK_DEVICES: Device[] = [
  {
    id: 'd1',
    type: 'Vía Central',
    location: 'Subclavia Derecha',
    inserted: '12 Oct, 2023',
    status: 'activo',
    nextCheck: '4h restantes'
  },
  {
    id: 'd2',
    type: 'Línea PICC',
    location: 'Basílica Izquierda',
    inserted: '02 Oct, 2023',
    status: 'vencido',
    nextCheck: 'Requerido Ahora'
  }
];

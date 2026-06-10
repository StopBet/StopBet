export interface PatientEvolution {
  label: string
  mood: number
  alert?: boolean
}

export interface PatientAlert {
  time: string
  rel: string
  resolved: boolean
}

export interface PatientSession {
  date: string
  summary: string
}

export interface Patient {
  id: string
  initials: string
  name: string
  email: string
  sede: string
  days: number
  status: 'normal' | 'riesgo'
  mood: string
  lastAlert: string
  lastAlertTone: 'danger' | 'muted'
  panicTotal: number
  moodAvg: string
  lastCheck: string
  evolution: PatientEvolution[]
  alerts: PatientAlert[]
  sessions: PatientSession[]
}

export interface TodayAlert {
  name: string
  rel: string
  time: string
  resolved: boolean
}

export interface AlertData {
  id: string
  initials: string
  name: string
  sede: string
  fecha: string
  tipo: string
  status: 'resuelto-ia' | 'sin-resolver' | 'resuelto-manual'
}

export interface PaymentData {
  id: string
  initials: string
  name: string
  sede: string
  amount: number
  dueDate: string
  permanencia: number
  status: 'pagado' | 'pendiente' | 'vencido' | 'exento'
}

export interface UpcomingPayment {
  initials: string
  name: string
  date: string
  amount: string
  urgent: boolean
}

export interface RecentCobro {
  initials: string
  name: string
  amount: string
  date: string
}

export interface RegistrationRequest {
  id: string
  initials: string
  name: string
  email: string
  sede: string
  rel: string
  date: string
  amount: string
}

export const SEDES = ['Todas', 'Santiago', 'Valparaíso', 'Concepción', 'Temuco']

export const PATIENTS: Patient[] = [
  {
    id: 'carlos', initials: 'CR', name: 'Carlos Rodríguez', email: 'carlos.rodriguez@email.com',
    sede: 'Santiago', days: 47, status: 'riesgo', mood: '😟', lastAlert: 'hace 2h', lastAlertTone: 'danger',
    panicTotal: 3, moodAvg: '3.2', lastCheck: 'hace 4 horas',
    evolution: [
      { label: '1 may', mood: 3 }, { label: '', mood: 4 }, { label: '8 may', mood: 4 },
      { label: '', mood: 2, alert: true }, { label: '15 may', mood: 3 }, { label: '', mood: 3 },
      { label: '22 may', mood: 2, alert: true }, { label: '', mood: 4 }, { label: '29 may', mood: 4 },
    ],
    alerts: [
      { time: 'Hoy · 14:32', rel: 'hace 2 horas', resolved: true },
      { time: 'Hoy · 09:15', rel: 'hace 7 horas', resolved: true },
      { time: '22 may · 21:40', rel: 'hace 7 días', resolved: false },
    ],
    sessions: [
      { date: '29 may · 16:20', summary: 'Sesión IA de respiración guiada tras impulso fuerte. Completada.' },
      { date: '26 may · 22:05', summary: 'Conversó con el asistente sobre gatillos de fin de semana.' },
    ],
  },
  { id: 'valentina', initials: 'VS', name: 'Valentina Soto', email: 'v.soto@email.com', sede: 'Valparaíso', days: 128, status: 'normal', mood: '😊', lastAlert: 'Nunca', lastAlertTone: 'muted', panicTotal: 0, moodAvg: '4.1', lastCheck: 'hace 6 horas', evolution: [], alerts: [], sessions: [] },
  { id: 'matias', initials: 'MF', name: 'Matías Fuentes', email: 'm.fuentes@email.com', sede: 'Santiago', days: 12, status: 'riesgo', mood: '😢', lastAlert: 'hace 1 día', lastAlertTone: 'danger', panicTotal: 2, moodAvg: '2.4', lastCheck: 'ayer', evolution: [], alerts: [], sessions: [] },
  { id: 'antonia', initials: 'AR', name: 'Antonia Reyes', email: 'a.reyes@email.com', sede: 'Concepción', days: 210, status: 'normal', mood: '😊', lastAlert: 'Nunca', lastAlertTone: 'muted', panicTotal: 0, moodAvg: '4.5', lastCheck: 'hace 2 horas', evolution: [], alerts: [], sessions: [] },
  { id: 'diego', initials: 'DM', name: 'Diego Morales', email: 'd.morales@email.com', sede: 'Santiago', days: 3, status: 'riesgo', mood: '😢', lastAlert: 'hace 5h', lastAlertTone: 'danger', panicTotal: 1, moodAvg: '2.1', lastCheck: 'hace 5 horas', evolution: [], alerts: [], sessions: [] },
  { id: 'francisca', initials: 'FL', name: 'Francisca Lagos', email: 'f.lagos@email.com', sede: 'Temuco', days: 89, status: 'normal', mood: '😊', lastAlert: 'hace 9 días', lastAlertTone: 'muted', panicTotal: 1, moodAvg: '3.9', lastCheck: 'hace 3 horas', evolution: [], alerts: [], sessions: [] },
  { id: 'tomas', initials: 'TH', name: 'Tomás Herrera', email: 't.herrera@email.com', sede: 'Valparaíso', days: 64, status: 'normal', mood: '😊', lastAlert: 'Nunca', lastAlertTone: 'muted', panicTotal: 0, moodAvg: '3.7', lastCheck: 'hace 8 horas', evolution: [], alerts: [], sessions: [] },
  { id: 'camila', initials: 'CF', name: 'Camila Fernández', email: 'c.fernandez@email.com', sede: 'Concepción', days: 156, status: 'normal', mood: '😊', lastAlert: 'Nunca', lastAlertTone: 'muted', panicTotal: 0, moodAvg: '4.3', lastCheck: 'hace 1 hora', evolution: [], alerts: [], sessions: [] },
  { id: 'sebastian', initials: 'SP', name: 'Sebastián Paredes', email: 's.paredes@email.com', sede: 'Temuco', days: 8, status: 'riesgo', mood: '😊', lastAlert: 'hace 3 días', lastAlertTone: 'muted', panicTotal: 1, moodAvg: '2.8', lastCheck: 'hace 2 horas', evolution: [], alerts: [], sessions: [] },
  { id: 'javiera', initials: 'JC', name: 'Javiera Contreras', email: 'j.contreras@email.com', sede: 'Santiago', days: 34, status: 'normal', mood: '😊', lastAlert: 'Nunca', lastAlertTone: 'muted', panicTotal: 0, moodAvg: '3.6', lastCheck: 'hace 4 horas', evolution: [], alerts: [], sessions: [] },
]

export const TODAY_ALERTS: TodayAlert[] = [
  { name: 'Carlos Rodríguez', rel: 'hace 2 horas', time: '14:32', resolved: true },
  { name: 'Diego Morales', rel: 'hace 5 horas', time: '11:08', resolved: false },
  { name: 'Carlos Rodríguez', rel: 'hace 7 horas', time: '09:15', resolved: true },
]

export const ALERT_DATA: AlertData[] = [
  { id: 'a1', initials: 'CR', name: 'Carlos Rodríguez', sede: 'Santiago', fecha: 'Hoy 14:32', tipo: 'Botón de pánico', status: 'resuelto-ia' },
  { id: 'a2', initials: 'DM', name: 'Diego Morales', sede: 'Santiago', fecha: 'Hoy 11:08', tipo: 'Botón de pánico', status: 'sin-resolver' },
  { id: 'a3', initials: 'CR', name: 'Carlos Rodríguez', sede: 'Santiago', fecha: 'Hoy 09:15', tipo: 'Botón de pánico', status: 'resuelto-ia' },
  { id: 'a4', initials: 'VS', name: 'Valentina Soto', sede: 'Valparaíso', fecha: 'Ayer 18:44', tipo: 'Botón de pánico', status: 'resuelto-manual' },
]

export const PAYMENT_DATA: PaymentData[] = [
  { id: 'carlos',    initials: 'CR', name: 'Carlos Rodríguez',  sede: 'Santiago',    amount: 30000, dueDate: '31/05/2026', permanencia: 2,  status: 'pagado'    },
  { id: 'valentina', initials: 'VS', name: 'Valentina Soto',    sede: 'Valparaíso',  amount: 30000, dueDate: '31/05/2026', permanencia: 5,  status: 'pagado'    },
  { id: 'matias',    initials: 'MF', name: 'Matías Fuentes',    sede: 'Santiago',    amount: 30000, dueDate: '31/05/2026', permanencia: 1,  status: 'vencido'   },
  { id: 'antonia',   initials: 'AR', name: 'Antonia Reyes',     sede: 'Concepción',  amount: 30000, dueDate: '30/06/2026', permanencia: 8,  status: 'pendiente' },
  { id: 'diego',     initials: 'DM', name: 'Diego Morales',     sede: 'Santiago',    amount: 30000, dueDate: '30/06/2026', permanencia: 1,  status: 'pendiente' },
  { id: 'francisca', initials: 'FL', name: 'Francisca Lagos',   sede: 'Temuco',      amount: 30000, dueDate: '31/05/2026', permanencia: 3,  status: 'pagado'    },
  { id: 'tomas',     initials: 'TH', name: 'Tomás Herrera',     sede: 'Valparaíso',  amount: 30000, dueDate: '—',          permanencia: 3,  status: 'exento'    },
  { id: 'camila',    initials: 'CF', name: 'Camila Fernández',  sede: 'Concepción',  amount: 30000, dueDate: '31/05/2026', permanencia: 6,  status: 'pagado'    },
  { id: 'sebastian', initials: 'SP', name: 'Sebastián Paredes', sede: 'Temuco',      amount: 30000, dueDate: '30/06/2026', permanencia: 1,  status: 'pendiente' },
  { id: 'javiera',   initials: 'JC', name: 'Javiera Contreras', sede: 'Santiago',    amount: 30000, dueDate: '31/05/2026', permanencia: 2,  status: 'pagado'    },
]

export const UPCOMING_PAYMENTS: UpcomingPayment[] = [
  { initials: 'DM', name: 'Diego Morales',     date: '3 jun 2026', amount: '$30.000', urgent: true  },
  { initials: 'AR', name: 'Antonia Reyes',     date: '5 jun 2026', amount: '$30.000', urgent: false },
  { initials: 'SP', name: 'Sebastián Paredes', date: '6 jun 2026', amount: '$30.000', urgent: false },
  { initials: 'MF', name: 'Matías Fuentes',    date: 'Vencido',    amount: '$30.000', urgent: true  },
]

export const RECENT_COBROS: RecentCobro[] = [
  { initials: 'VS', name: 'Valentina Soto',   amount: '$30.000', date: '1 jun 2026'  },
  { initials: 'CF', name: 'Camila Fernández', amount: '$30.000', date: '31 may 2026' },
  { initials: 'CR', name: 'Carlos Rodríguez', amount: '$30.000', date: '30 may 2026' },
]

export const INITIAL_REQUESTS: RegistrationRequest[] = [
  {
    id: 'ana', initials: 'AM', name: 'Ana Martínez', email: 'ana.m@email.com',
    sede: 'Santiago', rel: 'hace 2 horas', date: '29/05/2026 14:32', amount: '$30.000',
  },
  {
    id: 'rodrigo', initials: 'RS', name: 'Rodrigo Sepúlveda', email: 'r.sepulveda@email.com',
    sede: 'Viña del Mar', rel: 'hace 5 horas', date: '29/05/2026 11:48', amount: '$30.000',
  },
]

export const PSICOLOGOS = ['Dra. González (tú)', 'Dr. Ramírez', 'Dra. Fuentes', 'Dr. Cárdenas']

export const PADRINOS: Record<string, string[]> = {
  Santiago:       ['Asignar padrino…', 'Jorge Aravena · 6 años limpio', 'Patricio Núñez · 4 años limpio', 'Claudia Vera · 8 años limpia'],
  'Viña del Mar': ['Asignar padrino…', 'Marcelo Díaz · 5 años limpio', 'Sandra Rojas · 3 años limpia'],
}

export const REJECT_REASONS = [
  'No cumple criterios clínicos',
  'Datos incompletos',
  'No pertenece a esta sede',
  'Otro motivo',
]

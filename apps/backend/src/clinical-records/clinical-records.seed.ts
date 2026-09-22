import 'reflect-metadata';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { ClinicalRecordFieldChange } from '@stopbet/shared-types';
import { User } from '../users/entities/user.entity';
import { PatientAssignment } from '../psychologists/entities/patient-assignment.entity';
import { ClinicalRecord } from './entities/clinical-record.entity';
import { ClinicalRecordVersion } from './entities/clinical-record-version.entity';
import { ClinicalNote } from './entities/clinical-note.entity';
import { CheckIn } from '../check-ins/entities/check-in.entity';

// Seed propio de la HdU13, aparte de src/seed.ts para no tocar un archivo compartido:
//
//   pnpm run seed:fichas        (desde la raíz, después de `pnpm run seed`)
//
// **Deja pacientes sin ficha a propósito.** Si todos tuvieran una, no habría forma de ver el
// CA1 (la ficha vacía lista para completar) ni el chip «Sin ficha clínica» de la lista, que es
// justo lo que le dice al psicólogo a quién le falta.
//
// **También asigna pacientes a Miguel Ángel Lara**, el psicólogo con el que se prueba el panel.
// El seed base le deja 3, y con 3 filas no se puede juzgar cómo se ve la lista. Se agregan
// pacientes nuevos en vez de repartir los que ya existen: mover los de Tomás o Valentina los
// dejaría sin pacientes y ya no se vería que cada psicólogo alcanza solo a los suyos.
//
// No se tocan los `approval_pending` (Fernanda, Diego, Camila): son las solicitudes de ingreso
// de la HdU19 y asignarlos las haría desaparecer de esa pantalla.

const DEV_PASSWORD = 'Stopbet2026!';
const PSICOLOGO_DEMO = '33333333-3333-3333-3333-333333333333';
const SEDE_DEMO = 'Santiago';

// Quienes tienen que quedar SIN ficha para poder mostrar el CA1 (la ficha vacía lista para
// completar) y el chip «Sin ficha clínica» de la lista. El seed les borra la ficha si alguien
// se la creó, así que la demo se puede repetir corriendo el seed de nuevo.
const SIN_FICHA = [
  'pedro.alvarez@stopbet.cl',
  'roberto.fuentes@stopbet.cl',
  'rodrigo.caceres@stopbet.cl',
  'hector.sandoval@stopbet.cl',
  'ignacio.vidal@stopbet.cl',
  'tomas.riquelme@test.cl',
];

// Rachas y ánimos distintos a propósito: una lista donde todos van igual no deja ver el orden
// por señales de alerta ni la barra de adherencia.
const PACIENTES_DEMO = [
  { id: 'c1000000-0000-0000-0000-000000000001', firstName: 'Marcela', lastName: 'Ibáñez',  email: 'marcela.ibanez@stopbet.cl', rut: '17.456.789-3', phone: '+56911223301', daysStreak: 34, checkIns: ['good', 'good', 'tired'] },
  { id: 'c1000000-0000-0000-0000-000000000002', firstName: 'Rodrigo', lastName: 'Cáceres', email: 'rodrigo.caceres@stopbet.cl', rut: '14.567.890-1', phone: '+56911223302', daysStreak: 3,  checkIns: ['anxious', 'angry'] },
  { id: 'c1000000-0000-0000-0000-000000000003', firstName: 'Paulina', lastName: 'Núñez',   email: 'paulina.nunez@stopbet.cl',  rut: '18.678.901-5', phone: '+56911223303', daysStreak: 91, checkIns: ['good', 'good', 'good'] },
  { id: 'c1000000-0000-0000-0000-000000000004', firstName: 'Héctor',  lastName: 'Sandoval', email: 'hector.sandoval@stopbet.cl', rut: '13.789.012-7', phone: '+56911223304', daysStreak: 0,  checkIns: [] },
] as const;

const CONTENIDO = {
  carlos: {
    admissionReason:
      'Ingresa al programa derivado por su pareja, tras perder el sueldo del mes en apuestas deportivas en línea. Llega con disposición, aunque minimiza la frecuencia del juego.',
    gamblingHistory:
      'Juega hace 6 años. Partió con quinielas entre amigos y en 2024 pasó a casinos en línea, con apuestas diarias. Dos intentos previos de detenerse por cuenta propia, ambos de menos de un mes.',
    triggers:
      'Días de pago. Publicidad de casinos durante transmisiones deportivas. Discusiones en la casa. Quedarse solo en la noche.',
    healthAndSupport:
      'Sin patología previa diagnosticada. Duerme mal desde hace tres meses. Vive con su pareja, que acompaña el proceso y participó en la primera sesión de familiares.',
    treatmentGoals:
      'Sostener la abstinencia a 90 días. Asistir al grupo cada semana. Traspasar el manejo del sueldo a su pareja durante los primeros dos meses.',
  },
  ana: {
    admissionReason:
      'Ingresa por decisión propia tras una recaída que la dejó sin dinero para el arriendo. Es su primer tratamiento.',
    gamblingHistory:
      'Tragamonedas en línea desde 2023, en aumento durante el último año. Juega sobre todo de madrugada.',
    triggers: 'Insomnio. Estrés laboral al cierre de mes. Estar sola en la casa.',
    healthAndSupport:
      'En tratamiento por ansiedad con médico externo. Red de apoyo acotada: su hermana, que vive en otra región.',
    treatmentGoals:
      'Cortar el juego de madrugada con rutina de sueño. Sostener la asistencia al grupo. Reconstruir un fondo de emergencia.',
  },
  lucia: {
    admissionReason:
      'Derivada por el equipo de la sede tras tres meses sin poder pagar la mensualidad, con antecedentes de juego sostenido.',
    gamblingHistory:
      'Apuestas deportivas desde 2022. Alterna períodos de abstinencia de semanas con recaídas intensas.',
    triggers: 'Fines de semana con partidos. Cobrar el sueldo. Reuniones sociales donde se apuesta.',
    healthAndSupport:
      'Sin antecedentes de salud mental. Vive con su madre, que desconoce la magnitud de la deuda.',
    treatmentGoals:
      'Retomar la asistencia semanal al grupo. Hacer visible la deuda con su familia. Llegar a 30 días continuos.',
  },
  marcela: {
    admissionReason:
      'Ingresa derivada por su jefatura tras detectarse préstamos entre compañeros de trabajo. Reconoce el problema desde la primera sesión.',
    gamblingHistory:
      'Tragamonedas en línea desde 2022, con aumento sostenido durante el último año. Nunca jugó presencial.',
    triggers: 'Turnos de noche. Quedarse sola después del trabajo. Notificaciones de apps de apuestas.',
    healthAndSupport:
      'Sin antecedentes de salud mental. Vive con sus dos hijos. Su hermana la acompaña al grupo.',
    treatmentGoals:
      'Desinstalar las aplicaciones y bloquear los sitios. Sostener la asistencia al grupo. Saldar los préstamos en seis meses.',
  },
  paulina: {
    admissionReason:
      'Ingresa por derivación del consultorio, tras tres años de juego sostenido y una separación asociada a las deudas.',
    gamblingHistory:
      'Bingo en línea y raspaditos desde 2021. Períodos largos de abstinencia seguidos de recaídas al recibir dinero extra.',
    triggers: 'Aguinaldos y bonos. Aniversarios de la separación. Publicidad en redes sociales.',
    healthAndSupport:
      'Episodio depresivo tratado en 2023, hoy dado de alta. Red de apoyo sólida: sus padres y el grupo de los martes.',
    treatmentGoals:
      'Sostener los 90 días cumplidos. Acompañar a pacientes nuevos del grupo. Cerrar el último crédito pendiente.',
  },
  jorge: {
    admissionReason:
      'Ingresa derivado desde el hospital tras una consulta de urgencia por crisis de angustia asociada a deudas de juego.',
    gamblingHistory:
      'Casinos presenciales desde 2019 y en línea desde 2021. Nunca había pedido ayuda antes.',
    triggers: 'Cobros de deudas. Publicidad en redes sociales. Conflictos con su ex pareja.',
    healthAndSupport:
      'Crisis de angustia en seguimiento. Vive solo. Su hermano lo acompaña a las sesiones.',
    treatmentGoals:
      'Estabilizar las crisis con el equipo médico. Sostener la participación en el grupo. Ordenar las deudas con apoyo.',
  },
};

// Correlativo por ficha. El historial es de solo escritura, así que el seed lo arma explícito
// en vez de dejarlo a merced del orden de inserción.
type Paso = { autor: 'psicologo'; cambios: ClinicalRecordFieldChange[] };

async function main() {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [User, PatientAssignment, ClinicalRecord, ClinicalRecordVersion, ClinicalNote, CheckIn],
    synchronize: false,
  });
  await ds.initialize();

  const users = ds.getRepository(User);
  const assignments = ds.getRepository(PatientAssignment);
  const records = ds.getRepository(ClinicalRecord);
  const versions = ds.getRepository(ClinicalRecordVersion);
  const notes = ds.getRepository(ClinicalNote);

  const porCorreo = async (email: string) => {
    const u = await users.findOne({ where: { email } });
    if (!u) throw new Error(`No existe ${email}. ¿Corriste \`pnpm run seed\` antes?`);
    return u;
  };

  // El autor de cada ficha es el psicólogo que tiene asignado a ese paciente: una ficha
  // firmada por alguien que no lo atiende no es un dato de prueba, es un dato falso.
  const psicologoDe = async (patientId: string) => {
    const a = await assignments.findOne({ where: { patientId, active: true } });
    if (!a) throw new Error(`El paciente ${patientId} no tiene psicólogo asignado`);
    return a.psychologistId;
  };

  const escribir = async (
    email: string,
    contenido: (typeof CONTENIDO)['carlos'],
    pasos: Paso[] = [],
  ) => {
    const paciente = await porCorreo(email);
    const autor = await psicologoDe(paciente.id);

    // Las versiones se borran ANTES que la ficha y por el id viejo: la ficha nueva estrena id,
    // asi que limpiarlas despues dejaba huerfana la historia de la corrida anterior.
    const previa = await records.findOne({ where: { patientId: paciente.id } });
    if (previa) await versions.delete({ recordId: previa.id });
    await records.delete({ patientId: paciente.id });

    const ficha = await records.save(
      records.create({ patientId: paciente.id, ...contenido, updatedBy: autor }),
    );

    // La versión 1 siempre es la creación: los cinco campos desde vacío.
    const historial: Paso[] = [
      {
        autor: 'psicologo',
        cambios: (Object.keys(contenido) as (keyof typeof contenido)[]).map((field) => ({
          field,
          before: '',
          after: contenido[field],
        })),
      },
      ...pasos,
    ];

    for (const [i, paso] of historial.entries()) {
      await versions.save(
        versions.create({
          recordId: ficha.id,
          versionNumber: i + 1,
          changedBy: autor,
          changedFields: paso.cambios,
        }),
      );
    }

    console.log(
      `  ✓ ${paciente.firstName} ${paciente.lastName} — ficha con ${historial.length} versión(es)`,
    );
  };

  // ── 1. Escenario: que el psicólogo de prueba tenga una lista con la que se pueda juzgar ──
  const checkIns = ds.getRepository(CheckIn);
  const hash = await bcrypt.hash(DEV_PASSWORD, 10);

  console.log('\nPacientes de demostración\n');

  for (const demo of PACIENTES_DEMO) {
    const existente = await users.findOne({ where: { id: demo.id } });
    if (!existente) {
      await users.save(
        users.create({
          id: demo.id,
          email: demo.email,
          passwordHash: hash,
          role: 'patient',
          firstName: demo.firstName,
          lastName: demo.lastName,
          phone: demo.phone,
          rut: demo.rut,
          sedeId: SEDE_DEMO,
          daysStreak: demo.daysStreak,
          accountStatus: 'active',
          onboardingStatus: 'complete',
        }),
      );
    }

    const yaAsignado = await assignments.findOne({
      where: { patientId: demo.id, active: true },
    });
    if (!yaAsignado) {
      await assignments.save(
        assignments.create({
          patientId: demo.id,
          psychologistId: PSICOLOGO_DEMO,
          sedeId: SEDE_DEMO,
          active: true,
        }),
      );
    }

    // Los check-ins se cuentan hacia atrás desde hoy: la adherencia del panel mira los
    // últimos días, así que fechas fijas envejecerían y todos saldrían «sin check-ins».
    for (const [i, emotion] of demo.checkIns.entries()) {
      const dia = new Date();
      dia.setDate(dia.getDate() - i);
      const date = dia.toISOString().slice(0, 10);
      const existeCI = await checkIns.findOne({ where: { userId: demo.id, date } });
      if (!existeCI) {
        await checkIns.save(checkIns.create({ userId: demo.id, emotion, date }));
      }
    }

    console.log(`  ✓ ${demo.firstName} ${demo.lastName} — ${demo.daysStreak} días, ${demo.checkIns.length} check-in(s)`);
  }

  // Ignacio ya existía sin psicólogo. Es el único paciente sin asignar que está aprobado.
  const ignacio = await users.findOne({ where: { email: 'ignacio.vidal@stopbet.cl' } });
  if (ignacio) {
    const yaAsignado = await assignments.findOne({
      where: { patientId: ignacio.id, active: true },
    });
    if (!yaAsignado) {
      await assignments.save(
        assignments.create({
          patientId: ignacio.id,
          psychologistId: PSICOLOGO_DEMO,
          sedeId: ignacio.sedeId ?? SEDE_DEMO,
          active: true,
        }),
      );
      console.log('  ✓ Ignacio Vidal — asignado (estaba sin psicólogo)');
    }
  }

  console.log('\nFichas clínicas (HdU13)\n');

  // Carlos lleva tres versiones para que el historial del CA4 tenga algo que mostrar: una
  // ficha con una sola entrada no deja ver el antes/después, que es el punto del criterio.
  await escribir('demo@stopbet.cl', CONTENIDO.carlos, [
    {
      autor: 'psicologo',
      cambios: [
        {
          field: 'triggers',
          before: 'Días de pago. Publicidad de casinos durante transmisiones deportivas.',
          after:
            'Días de pago. Publicidad de casinos durante transmisiones deportivas. Discusiones en la casa.',
        },
      ],
    },
    {
      autor: 'psicologo',
      cambios: [
        {
          field: 'treatmentGoals',
          before: 'Sostener la abstinencia a 60 días. Asistir al grupo cada semana.',
          after: CONTENIDO.carlos.treatmentGoals,
        },
        {
          field: 'healthAndSupport',
          before:
            'Sin patología previa diagnosticada. Duerme mal desde hace tres meses. Vive con su pareja.',
          after: CONTENIDO.carlos.healthAndSupport,
        },
      ],
    },
  ]);

  await escribir('ana.perez@stopbet.cl', CONTENIDO.ana);
  await escribir('marcela.ibanez@stopbet.cl', CONTENIDO.marcela);
  await escribir('paulina.nunez@stopbet.cl', CONTENIDO.paulina);
  await escribir('lucia.vega@stopbet.cl', CONTENIDO.lucia);
  await escribir('jorge.morales@stopbet.cl', CONTENIDO.jorge);

  // Se borra la ficha de los que tienen que quedar sin ella. Sin esto, la ficha que se crea
  // durante una demo sobrevive a la siguiente corrida del seed y el CA1 ya no se puede mostrar
  // dos veces seguidas.
  for (const email of SIN_FICHA) {
    const paciente = await users.findOne({ where: { email } });
    if (!paciente) continue;

    // Las anotaciones cuelgan del paciente y no de la ficha, asi que se borran aparte: si no,
    // la que se agrega durante la demo queda pegada y la siguiente corrida ya no parte limpia.
    await notes.delete({ patientId: paciente.id });

    const ficha = await records.findOne({ where: { patientId: paciente.id } });
    if (!ficha) continue;
    await versions.delete({ recordId: ficha.id });
    await records.delete({ id: ficha.id });
    console.log(`  ✓ ${paciente.firstName} ${paciente.lastName} — ficha borrada, vuelve a «sin ficha»`);
  }

  console.log('\n  Sin ficha a propósito: Pedro Álvarez, Roberto Fuentes, Rodrigo Cáceres,');
  console.log('  Héctor Sandoval, Ignacio Vidal y Tomás Riquelme.');
  console.log('  Sirven para ver la ficha vacía del CA1 y el chip «Sin ficha clínica».');
  console.log('  Tomás Riquelme es el único que además trae el cuestionario de ingreso\n  respondido.\n');

  await ds.destroy();
}

main().catch((err) => {
  console.error('\nError en el seed de fichas clínicas:', err.message);
  process.exit(1);
});

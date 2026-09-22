/**
 * Asigna AJUTER al equipo clínico que ya existía antes de la columna users.institutionId.
 *
 * Solo toca psicólogos y coordinación SIN institución: es idempotente y no pisa una cuenta
 * que ya tenga otra. Es seguro mientras AJUTER sea el único cliente; con un segundo cliente
 * habrá que asignar a mano. No hay migraciones en el repo (ver CLAUDE.md, deudas técnicas),
 * por eso va como script.
 *
 * Uso: pnpm --filter @stopbet/backend run backfill:institution
 */
import { DataSource, In, IsNull } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { AJUTER_INSTITUTION_ID } from './institution';

async function run() {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [__dirname + '/../**/*.entity.{ts,js}'],
    synchronize: false,
  });
  await ds.initialize();

  const result = await ds.getRepository(User).update(
    { role: In(['psychologist', 'coordinator']), institutionId: IsNull() },
    { institutionId: AJUTER_INSTITUTION_ID },
  );
  // Solo el conteo: nada identificable en el log.
  console.log(`Cuentas del equipo clínico asignadas a ${AJUTER_INSTITUTION_ID}: ${result.affected ?? 0}`);

  await ds.destroy();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

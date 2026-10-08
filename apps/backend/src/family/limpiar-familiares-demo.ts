import 'reflect-metadata';
import { DataSource, In } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { FamilyLink } from './entities/family-link.entity';
import { FamilyLinkReview } from './entities/family-link-review.entity';
import { JUEGOS_DEMO, correosDeJuego, seleccionarBorrables, type JuegoDemo } from './familiares-demo';

// Borra las cuentas de familiar que se crean durante la demo de las HDU 22 y 23, para que la guía
// de criterios se pueda volver a usar con los mismos correos y RUT.
//
//   pnpm run limpiar:familiares-demo                     # solo muestra qué borraría
//   pnpm run limpiar:familiares-demo -- --confirmar      # borra
//   pnpm run limpiar:familiares-demo -- --juego 2 --confirmar
//
// Solo toca usuarios con rol familiar y uno de los correos de `familiares-demo.ts`. Al borrar el
// usuario, la base borra en cascada sus vínculos, notificaciones y asistencias; lo que no tiene
// clave foránea (historial de decisiones, sesiones y tokens de notificación) se borra a mano.

function leerArgs(argv: string[]): { confirmar: boolean; juegos: JuegoDemo[] } {
  const confirmar = argv.includes('--confirmar');
  const i = argv.indexOf('--juego');
  if (i === -1) return { confirmar, juegos: [...JUEGOS_DEMO] };
  const juego = Number(argv[i + 1]);
  if (!JUEGOS_DEMO.includes(juego as JuegoDemo)) {
    throw new Error(`--juego debe ser ${JUEGOS_DEMO.join(' o ')}`);
  }
  return { confirmar, juegos: [juego as JuegoDemo] };
}

async function limpiar(): Promise<void> {
  const { confirmar, juegos } = leerArgs(process.argv.slice(2));
  const correos = juegos.flatMap(correosDeJuego);

  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [User, FamilyLink, FamilyLinkReview],
    // Un script que borra no debe tocar el esquema.
    synchronize: false,
    logging: false,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  await ds.initialize();

  const encontrados = await ds
    .getRepository(User)
    .createQueryBuilder('u')
    .select(['u.id', 'u.email', 'u.role', 'u.firstName', 'u.lastName'])
    .where('LOWER(u.email) IN (:...correos)', { correos: correos.map((c) => c.toLowerCase()) })
    .getMany();
  const borrables = seleccionarBorrables(encontrados, correos);
  const ignorados = encontrados.filter((u) => !borrables.includes(u));

  console.log(`\nJuegos: ${juegos.join(', ')}. Cuentas de demo encontradas: ${borrables.length}\n`);
  for (const u of borrables) console.log(`  · ${u.email}  (${u.firstName} ${u.lastName})`);
  for (const u of ignorados) console.log(`  ! ${u.email} tiene rol «${u.role}»: no se toca`);

  if (borrables.length === 0) {
    console.log('\nNo hay nada que borrar: la guía ya se puede usar con estos correos.\n');
    await ds.destroy();
    return;
  }
  if (!confirmar) {
    console.log('\nNo se borró nada. Para borrar, vuelve a correrlo con `-- --confirmar`.\n');
    await ds.destroy();
    return;
  }

  const ids = borrables.map((u) => u.id);
  await ds.transaction(async (manager) => {
    const links = await manager.getRepository(FamilyLink).find({ where: { familyUserId: In(ids) }, select: { id: true } });
    const linkIds = links.map((l) => l.id);
    // Sin clave foránea a propósito (la auditoría no se borra sola en cascada): acá sí, porque es
    // el historial de cuentas de prueba que también se borran.
    if (linkIds.length) await manager.getRepository(FamilyLinkReview).delete({ linkId: In(linkIds) });
    await manager.query('DELETE FROM refresh_tokens WHERE "userId" = ANY($1)', [ids]);
    await manager.query('DELETE FROM device_tokens WHERE "userId" = ANY($1)', [ids]);
    await manager.getRepository(User).delete({ id: In(ids) });
  });

  console.log(`\nListo: ${borrables.length} cuenta(s) borradas. La guía se puede volver a usar con los mismos datos.\n`);
  await ds.destroy();
}

limpiar().catch((err) => {
  console.error('\nLa limpieza falló:', err.message);
  process.exit(1);
});

import 'dotenv/config';
import { DataSource, IsNull } from 'typeorm';
import { CommunityPost } from './community/entities/community-post.entity';

/**
 * Marca como logros los mensajes que ya estaban publicados.
 *
 * Desde ahora, compartir una insignia guarda los días en `achievementDays` y la app le da
 * una tarjeta propia en el foro. Los mensajes anteriores solo tienen el texto, así que acá
 * se les saca el número a los que siguen el formato que escribe el backend
 * (`🏅 ¡Alcancé N días sin apostar!`).
 *
 * Se puede correr más de una vez: solo toca los que todavía no tienen el dato.
 *
 *     pnpm run migrate:logros
 */
const FORMATO = /^🏅 ¡Alcancé (\d+) días? sin apostar!/;

async function main(): Promise<void> {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    synchronize: false,
  });
  await ds.initialize();

  const postRepo = ds.getRepository(CommunityPost);
  const candidatos = await postRepo.find({
    where: { type: 'forum_post', achievementDays: IsNull() },
  });

  let marcados = 0;
  for (const p of candidatos) {
    const coincide = FORMATO.exec(p.body);
    if (!coincide) continue;
    await postRepo.update({ id: p.id }, { achievementDays: Number(coincide[1]) });
    marcados += 1;
  }

  console.log(`Mensajes revisados: ${candidatos.length}`);
  console.log(`Marcados como logro: ${marcados}`);
  console.log('Los que no siguen el formato quedan como mensajes normales, que es lo correcto.');
  await ds.destroy();
}

main().catch((err) => {
  console.error('La migración falló:', err);
  process.exit(1);
});

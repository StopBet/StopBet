import 'dotenv/config';
import { DataSource } from 'typeorm';
import { CommunityPost } from './community/entities/community-post.entity';
import { PostReply } from './community/entities/post-reply.entity';

/**
 * Mueve las respuestas de `post_replies` al foro plano.
 *
 * El foro dejó de ser publicaciones con hilos colgando: ahora cualquier mensaje puede citar
 * a otro (`community_posts.replyToId`), como en WhatsApp. Lo que estaba escrito en la tabla
 * vieja tiene que seguir visible, así que cada respuesta pasa a ser un mensaje que cita a su
 * publicación.
 *
 * Se puede correr más de una vez: no duplica, porque reconoce lo ya migrado por el id.
 * **No borra `post_replies`.** Queda intacta hasta que alguien confirme que todo se ve bien;
 * eliminarla es una decisión aparte, y con `synchronize` encendido basta con quitar la
 * entidad para que se pierda.
 *
 *     pnpm --filter @stopbet/backend migrate:replies
 */
async function main(): Promise<void> {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    synchronize: false,
  });
  await ds.initialize();

  const replyRepo = ds.getRepository(PostReply);
  const postRepo = ds.getRepository(CommunityPost);

  const respuestas = await replyRepo.find({ relations: ['post'], order: { createdAt: 'ASC' } });
  console.log(`Respuestas en post_replies: ${respuestas.length}`);

  let migradas = 0;
  let saltadas = 0;

  for (const r of respuestas) {
    // El id de la respuesta se conserva como id del mensaje nuevo: así una segunda pasada
    // reconoce lo que ya migró, y las notificaciones que apuntaban a ella siguen sirviendo.
    const yaEstá = await postRepo.findOne({ where: { id: r.id } });
    if (yaEstá) {
      saltadas += 1;
      continue;
    }
    if (!r.post) {
      console.warn(`  ⚠ respuesta ${r.id} sin publicación: se omite`);
      saltadas += 1;
      continue;
    }

    await postRepo.save(
      postRepo.create({
        id: r.id,
        authorId: r.authorId,
        type: 'forum_post',
        sede: r.post.sede,
        title: null,
        body: r.body,
        eventDate: null,
        reportCount: 0,
        replyToId: r.postId,
        // La clave de idempotencia no se copia: es única en la tabla y la respuesta
        // original la conserva mientras `post_replies` siga ahí.
        clientRequestId: null,
        createdAt: r.createdAt,
      }),
    );
    migradas += 1;
  }

  console.log(`\nMigradas: ${migradas} · ya estaban: ${saltadas}`);
  console.log('`post_replies` queda intacta: bórrala solo cuando el foro se vea bien.');
  await ds.destroy();
}

main().catch((err) => {
  console.error('La migración falló:', err);
  process.exit(1);
});

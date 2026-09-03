import { CommunityService } from './community.service';

const AUTHOR_ID = 'user-1';
const POST_ID = 'post-1';
const KEY = 'abc-123';

const AUTHOR = { id: AUTHOR_ID, firstName: 'Carlos', lastName: 'Demo', role: 'patient' };

describe('CommunityService — escrituras idempotentes', () => {
  let service: CommunityService;
  let postRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let replyRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let userRepo: { findOne: jest.Mock; findOneOrFail: jest.Mock };
  let notificationRepo: { create: jest.Mock; save: jest.Mock };
  let communityMuteRepo: { findOne: jest.Mock };

  const noopRepo = () => ({ find: jest.fn().mockResolvedValue([]), findOne: jest.fn() });

  beforeEach(() => {
    postRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      // createdAt/updatedAt los pone la BD; el serializador los lee, así que el
      // mock tiene que traerlos o revienta al formatear.
      create: jest.fn((v) => ({
        id: 'nuevo-post',
        reportCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...v,
      })),
      save: jest.fn((v) => Promise.resolve(v)),
    };
    replyRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((v) => ({ id: 'nueva-respuesta', createdAt: new Date(), ...v })),
      save: jest.fn((v) => Promise.resolve(v)),
    };
    userRepo = {
      findOne: jest.fn().mockResolvedValue(AUTHOR),
      findOneOrFail: jest.fn().mockResolvedValue(AUTHOR),
    };
    notificationRepo = { create: jest.fn((v) => v), save: jest.fn((v) => Promise.resolve(v)) };
    communityMuteRepo = { findOne: jest.fn().mockResolvedValue(null) };

    service = new CommunityService(
      postRepo as any,
      replyRepo as any,
      noopRepo() as any,
      noopRepo() as any,
      noopRepo() as any,
      userRepo as any,
      notificationRepo as any,
      communityMuteRepo as any,
    );
  });

  // El caso real: la petición llega y se guarda, pero la respuesta se pierde de
  // vuelta. El paciente ve "sin conexión" y reintenta con la misma clave.
  describe('createPost', () => {
    it('con la misma clave devuelve el post ya creado y no guarda otro', async () => {
      const yaCreado = {
        id: 'post-original',
        authorId: AUTHOR_ID,
        author: AUTHOR,
        type: 'forum_post',
        sede: 'Santiago',
        body: 'Hola',
        reportCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      postRepo.findOne.mockResolvedValue(yaCreado);

      const res = await service.createPost(
        { body: 'Hola', sede: 'Santiago', clientRequestId: KEY },
        AUTHOR_ID,
      );

      expect(res.id).toBe('post-original');
      expect(postRepo.save).not.toHaveBeenCalled();
    });

    it('con una clave nueva sí guarda, y la deja registrada para el reintento', async () => {
      await service.createPost(
        { body: 'Hola', sede: 'Santiago', clientRequestId: KEY },
        AUTHOR_ID,
      );

      expect(postRepo.save).toHaveBeenCalledTimes(1);
      expect(postRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ clientRequestId: KEY }),
      );
    });

    // El APK viejo no manda la clave: tiene que seguir publicando igual.
    it('sin clave guarda como siempre y no busca duplicados', async () => {
      await service.createPost({ body: 'Hola', sede: 'Santiago' }, AUTHOR_ID);

      expect(postRepo.findOne).not.toHaveBeenCalled();
      expect(postRepo.save).toHaveBeenCalledTimes(1);
      expect(postRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ clientRequestId: null }),
      );
    });
  });

  describe('createReply', () => {
    beforeEach(() => {
      postRepo.findOne.mockResolvedValue({ id: POST_ID, authorId: 'otro-usuario' });
    });

    it('con la misma clave devuelve la respuesta ya creada y no guarda otra', async () => {
      replyRepo.findOne.mockResolvedValue({
        id: 'respuesta-original',
        postId: POST_ID,
        authorId: AUTHOR_ID,
        author: AUTHOR,
        body: 'ánimo',
        createdAt: new Date(),
      });

      const res = await service.createReply(POST_ID, { body: 'ánimo', clientRequestId: KEY }, AUTHOR_ID);

      expect(res.id).toBe('respuesta-original');
      expect(replyRepo.save).not.toHaveBeenCalled();
    });

    // Si no, el autor del post recibía un aviso por cada reintento.
    it('el reintento no vuelve a notificar al autor del post', async () => {
      replyRepo.findOne.mockResolvedValue({
        id: 'respuesta-original',
        postId: POST_ID,
        authorId: AUTHOR_ID,
        author: AUTHOR,
        body: 'ánimo',
        createdAt: new Date(),
      });

      await service.createReply(POST_ID, { body: 'ánimo', clientRequestId: KEY }, AUTHOR_ID);

      expect(notificationRepo.save).not.toHaveBeenCalled();
    });

    it('con una clave nueva sí guarda y notifica', async () => {
      await service.createReply(POST_ID, { body: 'ánimo', clientRequestId: KEY }, AUTHOR_ID);

      expect(replyRepo.save).toHaveBeenCalledTimes(1);
      expect(replyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ clientRequestId: KEY }),
      );
      expect(notificationRepo.save).toHaveBeenCalledTimes(1);
    });
  });
});

import { BadRequestException } from '@nestjs/common';
import { CommunityService } from './community.service';

const AUTHOR_ID = 'user-1';
const POST_ID = 'post-1';
const KEY = 'abc-123';

// `sedeId` con el NOMBRE, que es la forma de las cuentas del seed. El caso contrario
// -el UUID de quien se registró desde la app- tiene su propio test más abajo.
const AUTHOR = {
  id: AUTHOR_ID,
  firstName: 'Carlos',
  lastName: 'Demo',
  role: 'patient',
  sedeId: 'Santiago',
};
const SEDE = { id: 'sede-stgo', name: 'Santiago' };
const GIF = {
  id: 'abc123',
  title: 'Abrazo',
  url: 'https://media1.giphy.com/media/abc123/200w.gif',
  previewUrl: 'https://media1.giphy.com/media/abc123/100w.gif',
  width: 200,
  height: 150,
};

describe('CommunityService — escrituras idempotentes', () => {
  let service: CommunityService;
  let postRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let replyRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };
  let userRepo: { findOne: jest.Mock; findOneOrFail: jest.Mock; find: jest.Mock };
  let notificationRepo: { create: jest.Mock; save: jest.Mock };
  let communityMuteRepo: { findOne: jest.Mock; find: jest.Mock };
  let sedeRepo: { find: jest.Mock; findOne: jest.Mock };
  let gifs: { resolver: jest.Mock };

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
      // Los vecinos de la sede a los que se les avisa
      find: jest.fn().mockResolvedValue([]),
    };
    notificationRepo = { create: jest.fn((v) => v), save: jest.fn((v) => Promise.resolve(v)) };
    communityMuteRepo = { findOne: jest.fn().mockResolvedValue(null), find: jest.fn().mockResolvedValue([]) };
    sedeRepo = {
      find: jest.fn().mockResolvedValue([SEDE]),
      findOne: jest.fn().mockResolvedValue(SEDE),
    };
    gifs = { resolver: jest.fn().mockResolvedValue(GIF) };

    service = new CommunityService(
      postRepo as any,
      replyRepo as any,
      noopRepo() as any,
      noopRepo() as any,
      noopRepo() as any,
      userRepo as any,
      notificationRepo as any,
      communityMuteRepo as any,
      sedeRepo as any,
      noopRepo() as any,
      noopRepo() as any,
      gifs as any,
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

  describe('mensajes con GIF', () => {
    it('guarda el GIF que devuelve el backend, no lo que manda el cliente', async () => {
      const post = await service.createPost({ gifId: 'abc123' }, AUTHOR_ID);

      expect(gifs.resolver).toHaveBeenCalledWith('abc123');
      expect(postRepo.save).toHaveBeenCalledWith(expect.objectContaining({ body: '', gif: GIF }));
      expect(post.gif).toEqual(GIF);
    });

    it('sin texto ni GIF responde 400 y no guarda nada', async () => {
      await expect(service.createPost({ body: '   ' }, AUTHOR_ID)).rejects.toThrow(BadRequestException);
      expect(postRepo.save).not.toHaveBeenCalled();
    });

    it('si el GIF no pasa el filtro, el mensaje no se publica', async () => {
      gifs.resolver.mockRejectedValue(new BadRequestException('Ese GIF no se puede enviar'));

      await expect(service.createPost({ gifId: 'casino1' }, AUTHOR_ID)).rejects.toThrow(BadRequestException);
      expect(postRepo.save).not.toHaveBeenCalled();
    });

    it('citar un mensaje que es solo un GIF muestra «GIF»', async () => {
      postRepo.findOne.mockResolvedValue({ id: 'citado', sede: 'Santiago', body: '', gif: GIF, author: AUTHOR });

      const post = await service.createPost({ body: 'jaja', replyToId: 'citado' }, AUTHOR_ID);

      expect(post.replyTo?.body).toBe('GIF');
    });
  });

  // Responder dejó de ser una tabla aparte: es un mensaje más del foro que cita a otro.
  describe('responder es publicar citando', () => {
    const CITADO = {
      id: POST_ID,
      authorId: 'otro-usuario',
      author: { firstName: 'Jorge', lastName: 'Morales', role: 'patient' },
      sede: 'Santiago',
      body: 'Terminé mi primera semana',
      type: 'forum_post',
      reportCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      // El mismo repositorio atiende dos preguntas: el duplicado por clave y el mensaje
      // citado. Sin distinguirlas, el reintento devolvería el citado como si fuera suyo.
      postRepo.findOne.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(where.id === POST_ID ? CITADO : null),
      );
    });

    it('guarda el mensaje apuntando al que cita', async () => {
      await service.createReply(POST_ID, { body: 'ánimo' }, AUTHOR_ID);

      expect(postRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ replyToId: POST_ID, body: 'ánimo' }),
      );
      expect(postRepo.save).toHaveBeenCalledTimes(1);
    });

    it('avisa a quien fue citado', async () => {
      await service.createReply(POST_ID, { body: 'ánimo' }, AUTHOR_ID);

      expect(notificationRepo.save).toHaveBeenCalledTimes(1);
    });

    it('con la misma clave devuelve el mensaje ya creado y no guarda otro', async () => {
      const yaCreado = {
        id: 'respuesta-original',
        authorId: AUTHOR_ID,
        author: AUTHOR,
        type: 'forum_post',
        sede: 'Santiago',
        body: 'ánimo',
        reportCount: 0,
        replyToId: POST_ID,
        replyTo: CITADO,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      postRepo.findOne.mockImplementation(({ where }: { where: Record<string, unknown> }) =>
        Promise.resolve(where.clientRequestId === KEY ? yaCreado : CITADO),
      );

      const res = await service.createReply(POST_ID, { body: 'ánimo', clientRequestId: KEY }, AUTHOR_ID);

      expect(res.id).toBe('respuesta-original');
      expect(postRepo.save).not.toHaveBeenCalled();
      // Si no, quien fue citado recibía un aviso por cada reintento.
      expect(notificationRepo.save).not.toHaveBeenCalled();
    });

    it('la cita viaja recortada dentro de la respuesta', async () => {
      const largo = 'a'.repeat(300);
      postRepo.findOne.mockImplementation(() => Promise.resolve({ ...CITADO, body: largo }));

      const res = await service.createReply(POST_ID, { body: 'ánimo' }, AUTHOR_ID);

      expect(res.replyTo?.authorName).toBe('Jorge Morales');
      expect(res.replyTo?.body.endsWith('…')).toBe(true);
      expect(res.replyTo!.body.length).toBeLessThan(largo.length);
    });

    it('no deja citar un mensaje de otra sede', async () => {
      postRepo.findOne.mockImplementation(() =>
        Promise.resolve({ ...CITADO, sede: 'Concepción' }),
      );

      await expect(
        service.createReply(POST_ID, { body: 'ánimo' }, AUTHOR_ID),
      ).rejects.toThrow('otra sede');
      expect(postRepo.save).not.toHaveBeenCalled();
    });
  });

  // El cliente elegía la sede del cuerpo, así que cualquier sesión podía publicar en el foro
  // de una sede ajena: verificado contra el backend real antes de cerrarlo.
  describe('la sede sale de la cuenta, no del cuerpo', () => {
    it('ignora la sede que manda el cliente y guarda la del autor', async () => {
      await service.createPost({ body: 'Hola', sede: 'Concepción' }, AUTHOR_ID);

      expect(postRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sede: 'Santiago' }),
      );
    });

    it('traduce el UUID de quien se registró desde la app al nombre de su sede', async () => {
      userRepo.findOneOrFail.mockResolvedValue({ ...AUTHOR, sedeId: SEDE.id });

      await service.createPost({ body: 'Hola' }, AUTHOR_ID);

      expect(postRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sede: 'Santiago' }),
      );
    });

    // El gotcha de `users.sedeId`: la cuenta guarda el UUID y el post el nombre. Si se
    // comparara por un solo lado, media sede se quedaría sin poder responder.
    it('deja responder aunque la cuenta tenga el UUID y el mensaje citado el nombre', async () => {
      userRepo.findOneOrFail.mockResolvedValue({ ...AUTHOR, sedeId: SEDE.id });
      postRepo.findOne.mockResolvedValue({
        id: POST_ID,
        authorId: 'otro',
        author: { firstName: 'Jorge', lastName: 'Morales', role: 'patient' },
        sede: 'Santiago',
        body: 'hola',
      });

      await service.createReply(POST_ID, { body: 'hola' }, AUTHOR_ID);

      expect(postRepo.save).toHaveBeenCalledTimes(1);
    });
  });
});

describe('CommunityService — descartar reportes', () => {
  const PSYCHOLOGIST = { id: 'psy-1', role: 'psychologist' };
  let postRepo: { findOne: jest.Mock; update: jest.Mock };
  let reportRepo: { update: jest.Mock };
  let userRepo: { findOne: jest.Mock };
  let service: CommunityService;

  beforeEach(() => {
    postRepo = { findOne: jest.fn().mockResolvedValue({ id: POST_ID }), update: jest.fn() };
    reportRepo = { update: jest.fn().mockResolvedValue({ affected: 2 }) };
    userRepo = { findOne: jest.fn().mockResolvedValue(PSYCHOLOGIST) };
    const noop = () => ({}) as any;
    service = new CommunityService(
      postRepo as any, noop(), noop(), reportRepo as any, noop(), userRepo as any, noop(), noop(),
      noop(), noop(), noop(), noop(),
    );
  });

  it('marca los reportes pendientes con quién y cuándo, y saca la publicación de la cola', async () => {
    const result = await service.dismissReports(POST_ID, PSYCHOLOGIST.id);

    expect(reportRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ postId: POST_ID }),
      expect.objectContaining({ dismissedBy: PSYCHOLOGIST.id, dismissedAt: expect.any(Date) }),
    );
    expect(postRepo.update).toHaveBeenCalledWith({ id: POST_ID }, { reportCount: 0 });
    expect(result).toEqual({ dismissed: 2 });
  });

  it('un paciente no puede descartar reportes', async () => {
    userRepo.findOne.mockResolvedValue({ id: AUTHOR_ID, role: 'patient' });

    await expect(service.dismissReports(POST_ID, AUTHOR_ID)).rejects.toThrow('Solo un psicólogo');
    expect(reportRepo.update).not.toHaveBeenCalled();
  });
});

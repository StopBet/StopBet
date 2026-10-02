import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { firstValueFrom, take, toArray } from 'rxjs';
import { DirectMessagesService } from './direct-messages.service';

const SEDE = { id: 'aaaaaaaa-0000-0000-0000-000000000001', name: 'Santiago' };
// Una cuenta del seed guarda el nombre y una registrada el UUID: tienen que verse igual.
const ANA = { id: '11111111-1111-1111-1111-111111111111', firstName: 'Ana', lastName: 'Pérez', role: 'patient', sedeId: 'Santiago', accountStatus: 'active' };
const BETO = { id: '22222222-2222-2222-2222-222222222222', firstName: 'Beto', lastName: 'Soto', role: 'patient', sedeId: SEDE.id, accountStatus: 'active' };
const DE_OTRA_SEDE = { id: '33333333-3333-3333-3333-333333333333', firstName: 'Carla', lastName: 'Ruiz', role: 'patient', sedeId: 'Concepción', accountStatus: 'active' };
const PSICÓLOGA = { id: '44444444-4444-4444-4444-444444444444', firstName: 'Dra', lastName: 'Luz', role: 'psychologist', sedeId: 'Santiago', accountStatus: 'active' };
const USUARIOS = [ANA, BETO, DE_OTRA_SEDE, PSICÓLOGA];

const CONVERSACIÓN = { id: 'cccccccc-0000-0000-0000-000000000001', userAId: ANA.id, userBId: BETO.id, sede: 'Santiago' };

function insertQb() {
  const qb: Record<string, jest.Mock> = {};
  for (const m of ['insert', 'values', 'orIgnore']) qb[m] = jest.fn(() => qb);
  qb.execute = jest.fn().mockResolvedValue({});
  return qb;
}

describe('DirectMessagesService', () => {
  let userRepo: { findOne: jest.Mock; findOneOrFail: jest.Mock };
  let conversationRepo: Record<string, jest.Mock>;
  let messageRepo: Record<string, jest.Mock>;
  let reportRepo: Record<string, jest.Mock>;
  let blockRepo: Record<string, jest.Mock>;
  let pushService: { enviarAUsuarios: jest.Mock };
  let service: DirectMessagesService;

  beforeEach(() => {
    const porId = ({ where }: { where: { id: string } }) =>
      Promise.resolve(USUARIOS.find((u) => u.id === where.id) ?? null);
    userRepo = {
      findOne: jest.fn(porId),
      findOneOrFail: jest.fn(porId),
    };
    conversationRepo = {
      createQueryBuilder: jest.fn(insertQb),
      findOne: jest.fn().mockResolvedValue(null),
      findOneOrFail: jest.fn().mockResolvedValue(CONVERSACIÓN),
      update: jest.fn(),
    };
    messageRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((m) => Promise.resolve({ ...m, id: 'mmmmmmmm-0000-0000-0000-000000000001', createdAt: new Date() })),
      create: jest.fn((m) => m),
      findOneOrFail: jest.fn(({ where }) =>
        Promise.resolve({
          id: where.id,
          conversationId: CONVERSACIÓN.id,
          senderId: ANA.id,
          sender: ANA,
          body: 'hola',
          replyTo: null,
          createdAt: new Date(),
        }),
      ),
      increment: jest.fn(),
      delete: jest.fn(),
    };
    reportRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
      create: jest.fn((r) => r),
    };
    blockRepo = { count: jest.fn().mockResolvedValue(0), findOne: jest.fn().mockResolvedValue(null) };
    const sedeRepo = {
      findOne: jest.fn(({ where }) =>
        Promise.resolve(where.id === SEDE.id || where.name === SEDE.name ? SEDE : null),
      ),
      find: jest.fn().mockResolvedValue([SEDE]),
    };
    pushService = { enviarAUsuarios: jest.fn().mockResolvedValue(1) };

    service = new DirectMessagesService(
      conversationRepo as any,
      messageRepo as any,
      reportRepo as any,
      blockRepo as any,
      userRepo as any,
      sedeRepo as any,
      { find: jest.fn().mockResolvedValue([]) } as any,
      pushService as any,
    );
  });

  describe('send', () => {
    it('entrega a alguien de la misma sede aunque una cuenta guarde el nombre y la otra el UUID', async () => {
      const enviado = await service.send(ANA.id, BETO.id, { body: 'hola' });
      expect(enviado.body).toBe('hola');
      expect(messageRepo.save).toHaveBeenCalled();
    });

    it('rechaza con 404 a alguien de otra sede, sin confirmar que existe', async () => {
      await expect(service.send(ANA.id, DE_OTRA_SEDE.id, { body: 'hola' })).rejects.toThrow(NotFoundException);
      expect(messageRepo.save).not.toHaveBeenCalled();
    });

    it('no deja escribirle al equipo clínico mientras su app no muestre mensajes directos', async () => {
      await expect(service.send(ANA.id, PSICÓLOGA.id, { body: 'hola' })).rejects.toThrow(NotFoundException);
    });

    it('rechaza si hay un bloqueo en cualquiera de las dos direcciones', async () => {
      blockRepo.count.mockResolvedValue(1);
      await expect(service.send(ANA.id, BETO.id, { body: 'hola' })).rejects.toThrow(ForbiddenException);
      expect(blockRepo.count).toHaveBeenCalledWith({
        where: [
          { blockerId: ANA.id, blockedId: BETO.id },
          { blockerId: BETO.id, blockedId: ANA.id },
        ],
      });
    });

    it('un reintento con la misma clave devuelve el original y no vuelve a avisar', async () => {
      messageRepo.findOne.mockResolvedValueOnce({
        id: 'original', conversationId: CONVERSACIÓN.id, senderId: ANA.id, sender: ANA,
        body: 'hola', replyTo: null, createdAt: new Date(),
      });
      const r = await service.send(ANA.id, BETO.id, { body: 'hola', clientRequestId: 'k1' });
      expect(r.id).toBe('original');
      expect(messageRepo.save).not.toHaveBeenCalled();
      expect(pushService.enviarAUsuarios).not.toHaveBeenCalled();
    });

    it('no deja citar un mensaje de otra conversación', async () => {
      messageRepo.findOne
        .mockResolvedValueOnce({ id: 'ajeno', conversationId: 'otra-conversación' });
      await expect(
        service.send(ANA.id, BETO.id, { body: 'hola', replyToId: 'eeeeeeee-0000-0000-0000-000000000001' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('avisa por push quién escribió, nunca qué', async () => {
      await service.send(ANA.id, BETO.id, { body: 'me dieron ganas de apostar' });
      await new Promise((r) => setImmediate(r));
      const [destinatarios, título, cuerpo] = pushService.enviarAUsuarios.mock.calls[0];
      expect(destinatarios).toEqual([BETO.id]);
      expect(título).toBe('Ana Pérez');
      expect(cuerpo).not.toContain('apostar');
    });

    it('emite el mensaje solo a las dos personas de la conversación', async () => {
      const recibidos = firstValueFrom(service.observarUsuario(BETO.id).pipe(take(1), toArray()));
      await service.send(ANA.id, BETO.id, { body: 'hola' });
      const [evento] = await recibidos;
      expect(evento).toMatchObject({ kind: 'message', otherId: ANA.id });
    });
  });

  describe('report', () => {
    const MENSAJE = { id: 'm1', senderId: BETO.id, conversationId: CONVERSACIÓN.id, conversation: CONVERSACIÓN };

    it('no deja reportar un mensaje propio', async () => {
      messageRepo.findOne.mockResolvedValue(MENSAJE);
      await expect(service.report(BETO.id, 'm1', 'x')).rejects.toThrow(BadRequestException);
    });

    it('da 404 si el mensaje es de una conversación ajena', async () => {
      messageRepo.findOne.mockResolvedValue(MENSAJE);
      await expect(service.report(DE_OTRA_SEDE.id, 'm1', 'x')).rejects.toThrow(NotFoundException);
    });

    it('cuenta un solo reporte por persona', async () => {
      messageRepo.findOne.mockResolvedValue(MENSAJE);
      reportRepo.findOne.mockResolvedValue({ id: 'ya' });
      await service.report(ANA.id, 'm1', 'me pide plata');
      expect(messageRepo.increment).not.toHaveBeenCalled();
    });
  });

  describe('moderación', () => {
    it('el equipo clínico no puede borrar un mensaje directo que nadie reportó', async () => {
      messageRepo.findOne.mockResolvedValue({ id: 'm1', reportCount: 0 });
      await expect(service.deleteAsModerator('m1')).rejects.toThrow(ForbiddenException);
      expect(messageRepo.delete).not.toHaveBeenCalled();
    });

    it('devuelve null si el id no es de un mensaje directo, para que siga el foro', async () => {
      expect(await service.deleteAsModerator('no-existe')).toBeNull();
      expect(await service.dismissReportsAsModerator('no-existe', PSICÓLOGA.id)).toBeNull();
    });
  });
});

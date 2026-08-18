import { NotFoundException } from '@nestjs/common';
import { AiAssistantService } from './ai-assistant.service';
import { AiMessage } from './entities/ai-message.entity';

// Sin GEMINI_API_KEY el servicio deja `llm` en null y responde con el texto de
// respaldo: los tests corren offline y son deterministas.
const configService = { get: jest.fn().mockReturnValue(undefined) };

const SESSION_ID = 'session-1';
const USER_ID = 'user-1';

function userMessage(content: string): Partial<AiMessage> {
  return {
    id: `msg-${Math.random()}`,
    sessionId: SESSION_ID,
    role: 'user',
    content,
    techniqueTriggered: null,
    createdAt: new Date('2026-08-18T12:00:00Z'),
  };
}

describe('AiAssistantService', () => {
  let service: AiAssistantService;
  let sessionRepo: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock; update: jest.Mock };
  let messageRepo: { findOne: jest.Mock; find: jest.Mock; save: jest.Mock; create: jest.Mock };
  let summaryRepo: { findOne: jest.Mock; find: jest.Mock; create: jest.Mock; save: jest.Mock };

  beforeEach(() => {
    sessionRepo = {
      findOne: jest.fn(),
      create: jest.fn((v) => v),
      save: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    messageRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve({ ...v, id: 'saved', createdAt: new Date('2026-08-18T12:00:00Z') })),
    };
    summaryRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((v) => v),
      save: jest.fn((v) => Promise.resolve(v)),
    };

    service = new AiAssistantService(
      sessionRepo as any,
      messageRepo as any,
      summaryRepo as any,
      configService as any,
    );
  });

  describe('sendMessage — sesión inválida', () => {
    it('lanza 404 si la sesión no existe o ya está cerrada', async () => {
      sessionRepo.findOne.mockResolvedValue(null);
      await expect(
        service.sendMessage(SESSION_ID, USER_ID, { content: 'hola' } as any),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('CA2.1 — riesgo alto sugiere pánico, padrino y *4141', () => {
    beforeEach(() => {
      sessionRepo.findOne.mockResolvedValue({
        id: SESSION_ID, userId: USER_ID, status: 'active', previousContext: null,
      });
    });

    it.each([
      ['no aguanto más, voy a apostar hoy'],
      ['recaí ayer en el casino'],
      ['ya no quiero vivir así'],
    ])('marca riesgo alto y entrega las 3 vías de escape: %s', async (content) => {
      const res = await service.sendMessage(SESSION_ID, USER_ID, { content } as any);

      expect(res.crisis).not.toBeNull();
      expect(res.crisis!.riskLevel).toBe('high');
      expect(res.crisis!.suggestions).toEqual([
        'panic_button',
        'contact_sponsor',
        'crisis_line',
      ]);
    });

    it('marca sustained=false ante un pico aislado', async () => {
      messageRepo.find.mockResolvedValue([
        userMessage('hoy estuve tranquilo'),
        userMessage('no aguanto más'),
      ]);
      const res = await service.sendMessage(SESSION_ID, USER_ID, { content: 'no aguanto más' } as any);
      expect(res.crisis!.sustained).toBe(false);
    });

    it('marca sustained=true si ya venía en riesgo alto', async () => {
      messageRepo.find.mockResolvedValue([
        userMessage('recaí ayer'),
        userMessage('voy a apostar'),
      ]);
      const res = await service.sendMessage(SESSION_ID, USER_ID, { content: 'voy a apostar' } as any);
      expect(res.crisis!.sustained).toBe(true);
    });
  });

  describe('CA2.2 — un mensaje sin crisis no activa el protocolo', () => {
    beforeEach(() => {
      sessionRepo.findOne.mockResolvedValue({
        id: SESSION_ID, userId: USER_ID, status: 'active', previousContext: null,
      });
    });

    it.each([
      ['hola, ¿cómo estás?'],
      ['quería contarte que hoy salí a caminar'],
      ['gracias por la ayuda de ayer'],
    ])('no devuelve señal de crisis: %s', async (content) => {
      const res = await service.sendMessage(SESSION_ID, USER_ID, { content } as any);
      expect(res.crisis).toBeNull();
    });

    it('el riesgo medio tampoco dispara el protocolo de crisis', async () => {
      const res = await service.sendMessage(
        SESSION_ID, USER_ID, { content: 'tengo ansiedad y ganas de apostar' } as any,
      );
      expect(res.crisis).toBeNull();
    });

    it('igual sugiere una técnica de respiración ante el impulso', async () => {
      const res = await service.sendMessage(
        SESSION_ID, USER_ID, { content: 'tengo muchas ganas de apostar' } as any,
      );
      expect(res.techniqueTriggered).toBe('breathing');
    });
  });

  describe('sendMessage — respuesta', () => {
    beforeEach(() => {
      sessionRepo.findOne.mockResolvedValue({
        id: SESSION_ID, userId: USER_ID, status: 'active', previousContext: null,
      });
    });

    it('devuelve el mensaje del usuario y el del asistente', async () => {
      const res = await service.sendMessage(SESSION_ID, USER_ID, { content: 'hola' } as any);
      expect(res.userMessage.role).toBe('user');
      expect(res.assistantMessage.role).toBe('assistant');
      expect(res.assistantMessage.content.length).toBeGreaterThan(0);
    });

    it('actualiza la última actividad de la sesión', async () => {
      await service.sendMessage(SESSION_ID, USER_ID, { content: 'hola' } as any);
      expect(sessionRepo.update).toHaveBeenCalledWith(SESSION_ID, {
        lastActivityAt: expect.any(Date),
      });
    });
  });

  describe('startSession', () => {
    it('crea la sesión con un mensaje de apertura', async () => {
      sessionRepo.findOne.mockResolvedValue(null);
      sessionRepo.save.mockImplementation((v) =>
        Promise.resolve({ ...v, id: SESSION_ID, startedAt: new Date('2026-08-18T12:00:00Z'), closedAt: null, lastActivityAt: null }),
      );

      const res = await service.startSession(USER_ID);

      expect(res.session.id).toBe(SESSION_ID);
      expect(res.messages).toHaveLength(1);
      expect(res.messages[0].role).toBe('assistant');
    });
  });

  describe('getActiveSession', () => {
    it('devuelve null si el paciente no tiene sesión abierta', async () => {
      sessionRepo.findOne.mockResolvedValue(null);
      expect(await service.getActiveSession(USER_ID)).toBeNull();
    });

    it('devuelve la sesión abierta con su historial', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: SESSION_ID, userId: USER_ID, status: 'active', previousContext: null,
        startedAt: new Date('2026-08-18T12:00:00Z'), closedAt: null,
        lastActivityAt: new Date(),
      });
      messageRepo.find.mockResolvedValue([userMessage('hola')]);

      const res = await service.getActiveSession(USER_ID);

      expect(res).not.toBeNull();
      expect(res!.session.id).toBe(SESSION_ID);
      expect(res!.messages).toHaveLength(1);
    });

    it('cierra la sesión y devuelve null si lleva más de 10 min inactiva', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: SESSION_ID, userId: USER_ID, status: 'active', previousContext: null,
        startedAt: new Date(Date.now() - 60 * 60 * 1000), closedAt: null,
        lastActivityAt: new Date(Date.now() - 11 * 60 * 1000),
      });

      expect(await service.getActiveSession(USER_ID)).toBeNull();
      expect(sessionRepo.update).toHaveBeenCalledWith(
        SESSION_ID,
        expect.objectContaining({ status: 'closed' }),
      );
    });
  });

  describe('closeSession', () => {
    it('lanza 404 si la sesión no existe', async () => {
      sessionRepo.findOne.mockResolvedValue(null);
      await expect(service.closeSession(SESSION_ID, USER_ID)).rejects.toThrow(NotFoundException);
    });

    it('guarda el resumen y marca la sesión como cerrada', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: SESSION_ID, userId: USER_ID, status: 'active',
        startedAt: new Date(Date.now() - 12 * 60 * 1000),
      });
      messageRepo.find.mockResolvedValue([userMessage('tuve ganas de apostar')]);

      const summary = await service.closeSession(SESSION_ID, USER_ID);

      expect(summary.sessionId).toBe(SESSION_ID);
      expect(summary.durationMinutes).toBe(12);
      expect(sessionRepo.update).toHaveBeenCalledWith(
        SESSION_ID,
        expect.objectContaining({ status: 'closed' }),
      );
    });
  });

  describe('getSummaries', () => {
    it('devuelve los resúmenes del paciente', async () => {
      summaryRepo.find.mockResolvedValue([{ id: 's1' }]);
      expect(await service.getSummaries(USER_ID)).toHaveLength(1);
    });
  });
});

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
      ['ya aposté todo y no puedo parar'],
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

    it.each([
      ['recaí el mes pasado pero ya estoy mejor'],
      ['antes apostaba todos los fines de semana'],
    ])('NO dispara si la recaída es pasada y no hay descontrol: %s', async (content) => {
      const res = await service.sendMessage(SESSION_ID, USER_ID, { content } as any);
      expect(res.crisis).toBeNull();
    });

    it.each([
      ['recaí ahora, estoy en el casino'],
      ['volví a apostar hoy'],
    ])('SÍ dispara si la recaída está en curso: %s', async (content) => {
      const res = await service.sendMessage(SESSION_ID, USER_ID, { content } as any);
      expect(res.crisis?.riskLevel).toBe('high');
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
        userMessage('no puedo parar'),
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

  // Las tres conversaciones de prueba de docs/reglas-asistente.md §6 (S.1).
  describe('S.1 §6 — las tres conversaciones de prueba', () => {
    beforeEach(() => {
      sessionRepo.findOne.mockResolvedValue({
        id: SESSION_ID, userId: USER_ID, status: 'active', previousContext: null,
      });
    });

    it('C1 — sin crisis: un saludo no activa el protocolo', async () => {
      const res = await service.sendMessage(
        SESSION_ID, USER_ID, { content: 'Hola, ¿cómo funciona esto?' } as any,
      );
      expect(res.crisis).toBeNull();
    });

    it('C2 — impulso activo aguantado: acompaña, no alarma', async () => {
      const res = await service.sendMessage(
        SESSION_ID, USER_ID, { content: 'Tengo ganas de apostar pero estoy aguantando' } as any,
      );
      expect(res.crisis).toBeNull();
      expect(res.techniqueTriggered).toBe('breathing');
    });

    it('C3 — crisis severa: tarjeta con pánico, padrino y *4141', async () => {
      const res = await service.sendMessage(
        SESSION_ID, USER_ID, { content: 'No aguanto más, quiero desaparecer' } as any,
      );
      expect(res.crisis?.riskLevel).toBe('high');
      expect(res.crisis?.suggestions).toEqual([
        'panic_button',
        'contact_sponsor',
        'crisis_line',
      ]);
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

  // El servicio deja `llm` en null sin API key; se inyecta un doble para cubrir
  // los caminos que sí hablan con el modelo.
  describe('con LLM disponible', () => {
    const withLlm = (invoke: jest.Mock) => {
      (service as unknown as { llm: { invoke: jest.Mock } }).llm = { invoke };
    };

    beforeEach(() => {
      sessionRepo.findOne.mockResolvedValue({
        id: SESSION_ID, userId: USER_ID, status: 'active', previousContext: null,
        startedAt: new Date(Date.now() - 5 * 60 * 1000),
      });
    });

    it('usa la respuesta del modelo cuando responde bien', async () => {
      withLlm(jest.fn().mockResolvedValue({ content: '  Te escucho. ¿Qué pasó hoy?  ' }));
      const res = await service.sendMessage(SESSION_ID, USER_ID, { content: 'hola' } as any);
      expect(res.assistantMessage.content).toBe('Te escucho. ¿Qué pasó hoy?');
    });

    // S.8: si el asistente falla, el paciente no puede quedarse sin salida. El
    // mensaje de respaldo siempre tiene que dejar visible la ruta de escalada.
    it('quita el markdown del modelo antes de mostrarlo', async () => {
      withLlm(jest.fn().mockResolvedValue({
        content: 'Usa el **botón de pánico** ahora y __no esperes__.',
      }));
      const res = await service.sendMessage(SESSION_ID, USER_ID, { content: 'hola' } as any);

      expect(res.assistantMessage.content).toBe('Usa el botón de pánico ahora y no esperes.');
      expect(res.assistantMessage.content).not.toContain('**');
    });

    // La linea de ayuda chilena es literalmente *4141: si la limpieza de markdown se
    // lleva los asteriscos sueltos, borra el numero justo en el mensaje de crisis.
    it('NO toca los asteriscos sueltos del *4141', async () => {
      withLlm(jest.fn().mockResolvedValue({
        content: 'Puedes llamar al *4141 ahora mismo.',
      }));
      const res = await service.sendMessage(SESSION_ID, USER_ID, { content: 'hola' } as any);

      expect(res.assistantMessage.content).toContain('*4141');
    });

    it('quita el markdown aunque abarque varias lineas', async () => {
      withLlm(jest.fn().mockResolvedValue({
        content: 'Respira **muy\ndespacio** conmigo.',
      }));
      const res = await service.sendMessage(SESSION_ID, USER_ID, { content: 'hola' } as any);
      expect(res.assistantMessage.content).not.toContain('**');
    });

    it('cae al mensaje de respaldo y mantiene visible la ruta de escalada', async () => {
      withLlm(jest.fn().mockRejectedValue(new Error('API key not valid')));
      const res = await service.sendMessage(SESSION_ID, USER_ID, { content: 'hola' } as any);
      const texto = res.assistantMessage.content;

      expect(texto.length).toBeGreaterThan(0);
      expect(texto).toMatch(/4141|pánico|padrino/i);
    });

    it('devuelve siempre el mismo respaldo para la misma sesión', async () => {
      withLlm(jest.fn().mockRejectedValue(new Error('falla')));
      const uno = await service.sendMessage(SESSION_ID, USER_ID, { content: 'a' } as any);
      const dos = await service.sendMessage(SESSION_ID, USER_ID, { content: 'b' } as any);
      expect(uno.assistantMessage.content).toBe(dos.assistantMessage.content);
    });

    it('extrae el resumen clínico del JSON del modelo', async () => {
      withLlm(jest.fn().mockResolvedValue({
        content: '{"mood":"Ansiedad","trigger":"Estrés laboral","riskLevel":"medium","techniqueUsed":"respiración","progressNote":"Buen avance"}',
      }));
      messageRepo.find.mockResolvedValue([userMessage('tuve ansiedad')]);

      const summary = await service.closeSession(SESSION_ID, USER_ID);

      expect(summary.mood).toBe('Ansiedad');
      expect(summary.riskLevel).toBe('medium');
    });

    // Un 'low' guardado tras un fallo significaria "sin riesgo" cuando en realidad
    // nadie evaluó nada. El dashboard tiene que poder distinguir los dos casos.
    it('guarda riskLevel null si el modelo falla, no low', async () => {
      withLlm(jest.fn().mockRejectedValue(new Error('API caída')));
      messageRepo.find.mockResolvedValue([userMessage('tuve ansiedad')]);

      const summary = await service.closeSession(SESSION_ID, USER_ID);

      expect(summary.riskLevel).toBeNull();
      expect(summary.riskLevel).not.toBe('low');
    });

    it('guarda riskLevel null si el modelo devuelve un valor que no reconocemos', async () => {
      withLlm(jest.fn().mockResolvedValue({
        content: '{"mood":"Ansiedad","trigger":null,"riskLevel":"altísimo","techniqueUsed":null,"progressNote":null}',
      }));
      messageRepo.find.mockResolvedValue([userMessage('hola')]);

      const summary = await service.closeSession(SESSION_ID, USER_ID);
      expect(summary.riskLevel).toBeNull();
    });

    it('no revienta si el modelo devuelve un JSON inválido', async () => {
      withLlm(jest.fn().mockResolvedValue({ content: 'esto no es json' }));
      messageRepo.find.mockResolvedValue([userMessage('hola')]);

      const summary = await service.closeSession(SESSION_ID, USER_ID);
      expect(summary.sessionId).toBe(SESSION_ID);
    });
  });

  describe('getSummaries', () => {
    it('devuelve los resúmenes del paciente', async () => {
      summaryRepo.find.mockResolvedValue([{ id: 's1' }]);
      expect(await service.getSummaries(USER_ID)).toHaveLength(1);
    });
  });
});

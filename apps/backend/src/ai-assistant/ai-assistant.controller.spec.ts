import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';

describe('AiAssistantController', () => {
  const USER_ID = 'user-1';
  const SESSION_ID = 'session-1';

  let service: {
    startSession: jest.Mock;
    getActiveSession: jest.Mock;
    sendMessage: jest.Mock;
    closeSession: jest.Mock;
    getSummaries: jest.Mock;
  };
  let controller: AiAssistantController;

  beforeEach(() => {
    service = {
      startSession: jest.fn().mockResolvedValue({ session: { id: SESSION_ID } }),
      getActiveSession: jest.fn().mockResolvedValue(null),
      sendMessage: jest.fn().mockResolvedValue({ crisis: null }),
      closeSession: jest.fn().mockResolvedValue({ sessionId: SESSION_ID }),
      getSummaries: jest.fn().mockResolvedValue([]),
    };
    controller = new AiAssistantController(service as unknown as AiAssistantService);
  });

  it('startSession delega con el usuario del header', async () => {
    await controller.startSession(USER_ID);
    expect(service.startSession).toHaveBeenCalledWith(USER_ID);
  });

  it('getActiveSession delega con el usuario del header', async () => {
    expect(await controller.getActiveSession(USER_ID)).toBeNull();
    expect(service.getActiveSession).toHaveBeenCalledWith(USER_ID);
  });

  it('sendMessage delega sesión, usuario y cuerpo', async () => {
    const dto = { content: 'hola' } as never;
    await controller.sendMessage(SESSION_ID, USER_ID, dto);
    expect(service.sendMessage).toHaveBeenCalledWith(SESSION_ID, USER_ID, dto);
  });

  it('closeSession delega sesión y usuario', async () => {
    await controller.closeSession(SESSION_ID, USER_ID);
    expect(service.closeSession).toHaveBeenCalledWith(SESSION_ID, USER_ID);
  });

  it('getSummaries delega con el usuario del header', async () => {
    expect(await controller.getSummaries(USER_ID)).toEqual([]);
    expect(service.getSummaries).toHaveBeenCalledWith(USER_ID);
  });
});

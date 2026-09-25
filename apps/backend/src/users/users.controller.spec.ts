import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// Los guards (@UseGuards, @Roles) son metadata de decoradores — no interceptan
// una llamada directa al método. Su comportamiento ya está probado en
// roles.guard.spec.ts y en test/roles.e2e-spec.ts. Aquí solo se verifica que
// el controller delegue correctamente al servicio.
describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    listPatients: jest.Mock;
    getProgress: jest.Mock;
  };

  beforeEach(() => {
    usersService = {
      listPatients: jest.fn(),
      getProgress: jest.fn(),
    };
    controller = new UsersController(usersService as unknown as UsersService);
  });

  it('listPatients pasa el usuario del token al servicio', async () => {
    usersService.listPatients.mockResolvedValue([{ id: 'p1' }]);
    const viewer = { id: 'psy-1', role: 'psychologist' } as any;

    const result = await controller.listPatients(viewer);

    // El filtrado depende de quién consulta: si el controller no propaga el usuario,
    // el servicio devuelve la lista completa a cualquiera.
    expect(usersService.listPatients).toHaveBeenCalledWith(viewer);
    expect(result).toEqual([{ id: 'p1' }]);
  });

  it('getProgress delega en usersService.getProgress con el id de la ruta', async () => {
    usersService.getProgress.mockResolvedValue({ userId: 'p1', daysStreak: 10 });

    const result = await controller.getProgress('p1');

    expect(usersService.getProgress).toHaveBeenCalledWith('p1');
    expect(result.daysStreak).toBe(10);
  });
});

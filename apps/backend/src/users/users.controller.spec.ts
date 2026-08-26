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

  it('listPatients delega en usersService.listPatients', async () => {
    usersService.listPatients.mockResolvedValue([{ id: 'p1' }]);

    const result = await controller.listPatients();

    expect(usersService.listPatients).toHaveBeenCalled();
    expect(result).toEqual([{ id: 'p1' }]);
  });

  it('getProgress delega en usersService.getProgress con el id de la ruta', async () => {
    usersService.getProgress.mockResolvedValue({ userId: 'p1', daysStreak: 10 });

    const result = await controller.getProgress('p1');

    expect(usersService.getProgress).toHaveBeenCalledWith('p1');
    expect(result.daysStreak).toBe(10);
  });
});

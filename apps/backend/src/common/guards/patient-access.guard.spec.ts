import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PatientAccessGuard } from './patient-access.guard';

const ctx = (user: unknown, params: Record<string, string>) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user, params }) }) }) as unknown as ExecutionContext;

describe('PatientAccessGuard', () => {
  let repo: { exists: jest.Mock };
  let guard: PatientAccessGuard;

  beforeEach(() => {
    repo = { exists: jest.fn() };
    guard = new PatientAccessGuard(repo as any);
  });

  it('la coordinación accede a cualquier paciente sin consultar asignaciones', async () => {
    await expect(guard.canActivate(ctx({ id: 'c', role: 'coordinator' }, { patientId: 'p' }))).resolves.toBe(true);
    expect(repo.exists).not.toHaveBeenCalled();
  });

  it('un psicólogo con el paciente asignado pasa', async () => {
    repo.exists.mockResolvedValue(true);
    await expect(guard.canActivate(ctx({ id: 'psy', role: 'psychologist' }, { patientId: 'p' }))).resolves.toBe(true);
    expect(repo.exists).toHaveBeenCalledWith({ where: { psychologistId: 'psy', patientId: 'p', active: true } });
  });

  it('un psicólogo sin la asignación recibe 403', async () => {
    repo.exists.mockResolvedValue(false);
    await expect(guard.canActivate(ctx({ id: 'psy', role: 'psychologist' }, { patientId: 'p' }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('acepta el id del paciente como `:id` además de `:patientId`', async () => {
    repo.exists.mockResolvedValue(true);
    await guard.canActivate(ctx({ id: 'psy', role: 'psychologist' }, { id: 'p2' }));
    expect(repo.exists).toHaveBeenCalledWith({ where: { psychologistId: 'psy', patientId: 'p2', active: true } });
  });

  it('sin usuario o sin paciente en la ruta, 403', async () => {
    await expect(guard.canActivate(ctx(undefined, { patientId: 'p' }))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(ctx({ id: 'psy', role: 'psychologist' }, {}))).rejects.toBeInstanceOf(ForbiddenException);
  });
});

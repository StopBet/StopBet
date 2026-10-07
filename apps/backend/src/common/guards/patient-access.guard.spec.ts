import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PatientAccessGuard } from './patient-access.guard';
import { User } from '../../users/entities/user.entity';
import { Sede } from '../../sedes/entities/sede.entity';
import { PsychologistSede } from '../../psychologists/entities/psychologist-sede.entity';

const ctx = (user: unknown, params: Record<string, string>) =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user, params }) }) }) as unknown as ExecutionContext;

describe('PatientAccessGuard', () => {
  let repo: { exists: jest.Mock };
  let users: { findOne: jest.Mock };
  let sedes: { findOne: jest.Mock; find: jest.Mock };
  let psychSedes: { find: jest.Mock };
  let guard: PatientAccessGuard;

  const SANTIAGO = { id: 'sede-santiago', name: 'Santiago' };
  const VINA = { id: 'sede-vina', name: 'Viña del Mar' };

  beforeEach(() => {
    repo = { exists: jest.fn() };
    users = { findOne: jest.fn().mockResolvedValue(null) };
    // El seed guarda la sede del paciente por nombre: se traduce a sus dos formas.
    sedes = {
      findOne: jest.fn(({ where }) =>
        Promise.resolve([SANTIAGO, VINA].find((s) => s.name === where.name || s.id === where.id) ?? null),
      ),
      find: jest.fn().mockResolvedValue([SANTIAGO]),
    };
    psychSedes = { find: jest.fn().mockResolvedValue([{ sedeId: SANTIAGO.id }]) };
    const dataSource = {
      getRepository: (entity: unknown) =>
        entity === User ? users : entity === Sede ? sedes : entity === PsychologistSede ? psychSedes : undefined,
    };
    guard = new PatientAccessGuard(repo as any, dataSource as any);
  });

  const motivo = async (patientId: string) => {
    repo.exists.mockResolvedValue(false);
    const err = await guard
      .canActivate(ctx({ id: 'psy', role: 'psychologist', sedeId: 'Santiago' }, { patientId }))
      .catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    return (err as ForbiddenException).getResponse() as { reason?: string; message: string };
  };

  it('HdU13 CA5: a un paciente de otra sede responde «no es de tu sede»', async () => {
    users.findOne.mockResolvedValue({ id: 'p', sedeId: 'Viña del Mar' });
    await expect(motivo('p')).resolves.toMatchObject({
      reason: 'other_sede',
      message: 'Este paciente no es de tu sede',
    });
  });

  it('a un paciente de su sede sin asignar responde «no está asignado a ti»', async () => {
    users.findOne.mockResolvedValue({ id: 'p', sedeId: 'Santiago' });
    await expect(motivo('p')).resolves.toMatchObject({
      reason: 'not_assigned',
      message: 'Este paciente no está asignado a ti',
    });
  });

  it('reconoce la misma sede aunque el paciente la tenga por UUID y el psicólogo por nombre', async () => {
    users.findOne.mockResolvedValue({ id: 'p', sedeId: SANTIAGO.id });
    await expect(motivo('p')).resolves.toMatchObject({ reason: 'not_assigned' });
  });

  it('un id que no es de ningún paciente recibe el mensaje genérico, sin motivo', async () => {
    users.findOne.mockResolvedValue(null);
    const res = await motivo('no-existe');
    expect(res.reason).toBeUndefined();
    expect(res.message).toBe('No tienes acceso a este paciente');
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

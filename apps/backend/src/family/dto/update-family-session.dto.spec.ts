import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateFamilySessionDto } from './update-family-session.dto';

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(plainToInstance(UpdateFamilySessionDto, body), { whitelist: true, forbidNonWhitelisted: true });
  return errors.map((e) => e.property);
}

describe('UpdateFamilySessionDto — HdU14 CA2', () => {
  it('acepta cambiar solo la fecha o solo el cupo', async () => {
    expect(await errorsFor({ sessionDate: '2026-11-04T19:00:00Z' })).toEqual([]);
    expect(await errorsFor({ capacity: 15 })).toEqual([]);
  });

  it('valida el cupo igual que al crear', async () => {
    expect(await errorsFor({ capacity: 0 })).toEqual(['capacity']);
  });

  it('no deja cambiar la sede ni el tipo', async () => {
    expect(await errorsFor({ sedeId: 'Valparaíso' })).toEqual(['sedeId']);
    expect(await errorsFor({ audience: 'patients' })).toEqual(['audience']);
  });
});

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateSedesDto } from './update-sedes.dto';

describe('UpdateSedesDto', () => {
  it('acepta un set de sedes válido, sin reasignaciones', async () => {
    const dto = plainToInstance(UpdateSedesDto, {
      sedeIds: ['5f0348a7-eb1d-4352-a889-1f3be7655492'],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('acepta un mapa de reasignaciones opcional', async () => {
    const dto = plainToInstance(UpdateSedesDto, {
      sedeIds: ['5f0348a7-eb1d-4352-a889-1f3be7655492'],
      reassignments: { 'sede-a': '22222222-2222-2222-2222-222222222222' },
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rechaza sedeIds vacío — nunca dejar al psicólogo sin sedes', async () => {
    const dto = plainToInstance(UpdateSedesDto, { sedeIds: [] });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'sedeIds')).toBe(true);
  });

  it('rechaza un sedeId que no es UUID', async () => {
    const dto = plainToInstance(UpdateSedesDto, { sedeIds: ['no-es-uuid'] });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'sedeIds')).toBe(true);
  });
});

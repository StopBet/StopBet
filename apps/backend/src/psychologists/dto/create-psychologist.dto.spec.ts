import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePsychologistDto } from './create-psychologist.dto';

const base = {
  firstName: 'Fernanda',
  lastName: 'Fuentes',
  email: 'fernanda.fuentes@ajuter.cl',
  rut: '12.345.678-5',
  sedeIds: ['0805db22-992a-4955-8771-445c28073a05'],
};

describe('CreatePsychologistDto', () => {
  it('acepta un payload válido', async () => {
    const dto = plainToInstance(CreatePsychologistDto, base);
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rechaza un RUT inválido', async () => {
    const dto = plainToInstance(CreatePsychologistDto, { ...base, rut: '12.345.678-9' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'rut')).toBe(true);
  });

  it('rechaza un email con formato inválido', async () => {
    const dto = plainToInstance(CreatePsychologistDto, { ...base, email: 'no-es-un-correo' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('rechaza sedeIds vacío — 24.5 exige al menos una sede', async () => {
    const dto = plainToInstance(CreatePsychologistDto, { ...base, sedeIds: [] });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'sedeIds')).toBe(true);
  });

  it('rechaza un sedeId que no es UUID', async () => {
    const dto = plainToInstance(CreatePsychologistDto, { ...base, sedeIds: ['no-es-uuid'] });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'sedeIds')).toBe(true);
  });
});

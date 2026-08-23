import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubmitRegistrationDto } from './submit-registration.dto';

const base = {
  firstName: 'Ana',
  lastName: 'Pérez',
  email: 'ana.perez@correo.cl',
  sedeId: '11111111-1111-1111-1111-111111111111',
  institutionId: 'AJUTER',
};

async function rutErrors(rut: string) {
  const dto = plainToInstance(SubmitRegistrationDto, { ...base, rut });
  const errors = await validate(dto);
  return errors.filter((e) => e.property === 'rut');
}

describe('SubmitRegistrationDto — validación de RUT', () => {
  it('acepta un RUT válido con formato', async () => {
    expect(await rutErrors('12.345.678-5')).toHaveLength(0);
  });

  it('acepta un RUT válido con dígito verificador K', async () => {
    expect(await rutErrors('1.000.070-K')).toHaveLength(0);
  });

  it('rechaza un RUT con dígito verificador incorrecto', async () => {
    expect(await rutErrors('12.345.678-9')).not.toHaveLength(0);
  });

  it('rechaza un RUT vacío', async () => {
    expect(await rutErrors('')).not.toHaveLength(0);
  });

  it('rechaza un RUT con formato absurdo', async () => {
    expect(await rutErrors('abc-5')).not.toHaveLength(0);
  });
});

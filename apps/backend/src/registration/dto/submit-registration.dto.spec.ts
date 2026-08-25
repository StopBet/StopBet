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

async function birthDateErrors(birthDate: string) {
  const dto = plainToInstance(SubmitRegistrationDto, {
    ...base,
    rut: '12.345.678-5',
    birthDate,
  });
  const errors = await validate(dto);
  return errors.filter((e) => e.property === 'birthDate');
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

describe('SubmitRegistrationDto — validación de fecha de nacimiento', () => {
  it('acepta una fecha válida', async () => {
    expect(await birthDateErrors('1992-03-14')).toHaveLength(0);
  });

  it('acepta el 29 de febrero en un año bisiesto', async () => {
    expect(await birthDateErrors('2024-02-29')).toHaveLength(0);
  });

  // El bug que motivó este validador: @IsDateString() no estricto aceptaba estas tres,
  // y Postgres las rechazaba después con un 500 crudo en la cara del paciente.
  it('rechaza el 31 de febrero', async () => {
    expect(await birthDateErrors('2024-02-31')).not.toHaveLength(0);
  });

  it('rechaza el 30 de febrero', async () => {
    expect(await birthDateErrors('2024-02-30')).not.toHaveLength(0);
  });

  it('rechaza el 29 de febrero en un año no bisiesto', async () => {
    expect(await birthDateErrors('2023-02-29')).not.toHaveLength(0);
  });

  it('rechaza el 31 de un mes de 30 días', async () => {
    expect(await birthDateErrors('2024-04-31')).not.toHaveLength(0);
  });

  it('rechaza un mes fuera de rango', async () => {
    expect(await birthDateErrors('2024-13-01')).not.toHaveLength(0);
  });

  it('rechaza el formato chileno sin convertir', async () => {
    expect(await birthDateErrors('14/03/1992')).not.toHaveLength(0);
  });

  it('devuelve un mensaje en español', async () => {
    const [error] = await birthDateErrors('2024-02-31');
    expect(Object.values(error.constraints ?? {})).toContain(
      'La fecha de nacimiento no es una fecha válida',
    );
  });

  it('deja pasar la fecha ausente, que es opcional', async () => {
    const dto = plainToInstance(SubmitRegistrationDto, { ...base, rut: '12.345.678-5' });
    const errors = await validate(dto);
    expect(errors.filter((e) => e.property === 'birthDate')).toHaveLength(0);
  });
});

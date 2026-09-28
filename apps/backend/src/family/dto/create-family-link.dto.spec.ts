import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateFamilyLinkDto } from './create-family-link.dto';

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(plainToInstance(CreateFamilyLinkDto, body));
  return errors.map((e) => e.property);
}

describe('CreateFamilyLinkDto — RUT o correo del paciente', () => {
  it('acepta solo el RUT', async () => {
    expect(await errorsFor({ patientRut: '11.111.111-1' })).toEqual([]);
  });

  it('acepta solo el correo', async () => {
    expect(await errorsFor({ patientEmail: 'carlos@stopbet.cl' })).toEqual([]);
  });

  it('acepta los dos', async () => {
    expect(await errorsFor({ patientRut: '11.111.111-1', patientEmail: 'carlos@stopbet.cl' })).toEqual([]);
  });

  it('rechaza si no viene ninguno', async () => {
    expect(await errorsFor({})).toEqual(['patientRut', 'patientEmail']);
  });

  it('valida el RUT aunque venga también el correo', async () => {
    expect(await errorsFor({ patientRut: '11.111.111-2', patientEmail: 'carlos@stopbet.cl' })).toEqual([
      'patientRut',
    ]);
  });

  it('valida el correo aunque venga también el RUT', async () => {
    expect(await errorsFor({ patientRut: '11.111.111-1', patientEmail: 'no-es-correo' })).toEqual([
      'patientEmail',
    ]);
  });
});

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateFamilySessionDto } from './create-family-session.dto';

const VALIDA = {
  title: 'Grupo de apoyo',
  sessionDate: '2026-11-04T19:00:00Z',
  location: 'Sala 2',
  sedeId: 'Santiago',
  capacity: 12,
  audience: 'family',
};

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(plainToInstance(CreateFamilySessionDto, body));
  return errors.map((e) => e.property);
}

describe('CreateFamilySessionDto — HdU14 CA1', () => {
  it('acepta nombre, sede, fecha y hora, cupo y tipo', async () => {
    expect(await errorsFor(VALIDA)).toEqual([]);
    expect(await errorsFor({ ...VALIDA, audience: 'patients' })).toEqual([]);
  });

  it('exige el cupo', async () => {
    const { capacity: _omitido, ...sinCupo } = VALIDA;
    expect(await errorsFor(sinCupo)).toEqual(['capacity']);
  });

  it('rechaza un cupo de 0, negativo o con decimales', async () => {
    expect(await errorsFor({ ...VALIDA, capacity: 0 })).toEqual(['capacity']);
    expect(await errorsFor({ ...VALIDA, capacity: -3 })).toEqual(['capacity']);
    expect(await errorsFor({ ...VALIDA, capacity: 2.5 })).toEqual(['capacity']);
  });

  it('exige un tipo conocido', async () => {
    const { audience: _omitido, ...sinTipo } = VALIDA;
    expect(await errorsFor(sinTipo)).toEqual(['audience']);
    expect(await errorsFor({ ...VALIDA, audience: 'todos' })).toEqual(['audience']);
  });
});

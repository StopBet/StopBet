import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MarkPresenceDto } from './mark-presence.dto';

const ID = '11111111-1111-1111-1111-111111111111';

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const errors = await validate(plainToInstance(MarkPresenceDto, body));
  return errors.map((e) => e.property);
}

describe('MarkPresenceDto — HdU14 CA4', () => {
  it('acepta una lista de personas con asistió / no asistió', async () => {
    expect(await errorsFor({ marks: [{ userId: ID, attended: true }] })).toEqual([]);
  });

  it('exige al menos una persona', async () => {
    expect(await errorsFor({ marks: [] })).toEqual(['marks']);
  });

  it('valida cada marca: id y asistió', async () => {
    expect(await errorsFor({ marks: [{ userId: 'no-es-id', attended: true }] })).toEqual(['marks']);
    expect(await errorsFor({ marks: [{ userId: ID, attended: 'sí' }] })).toEqual(['marks']);
  });
});

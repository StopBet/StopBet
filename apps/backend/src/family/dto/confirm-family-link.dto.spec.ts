import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConfirmFamilyLinkDto } from './confirm-family-link.dto';

describe('ConfirmFamilyLinkDto — HDU 23 CA4', () => {
  it.each(['patient_consulted', 'in_person'])('acepta %s', async (verification) => {
    expect(await validate(plainToInstance(ConfirmFamilyLinkDto, { verification }))).toEqual([]);
  });

  it.each([{}, { verification: 'otro' }])('rechaza confirmar sin decir cómo se verificó: %j', async (body) => {
    const [error] = await validate(plainToInstance(ConfirmFamilyLinkDto, body));
    expect(error.constraints).toEqual({ isIn: 'Indica cómo verificaste el vínculo' });
  });
});

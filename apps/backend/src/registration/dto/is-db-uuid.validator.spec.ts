import { ClassConstructor, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ApproveRegistrationDto } from './approve-registration.dto';
import { DeactivatePsychologistDto } from '../../psychologists/dto/deactivate-psychologist.dto';

// El id de Miguel en el seed compartido. La forma es válida para Postgres, pero los bits de
// versión y variante no cumplen la RFC, así que `@IsUUID()` lo rechazaba y la aprobación
// devolvía 400 para casi todas las cuentas de desarrollo.
const SEED_ID = '33333333-3333-3333-3333-333333333333';
const REAL_V4 = '03cdafe3-268f-414a-8f9d-3cfbef532161';

async function errorsFor<T extends object>(
  cls: ClassConstructor<T>,
  value: unknown,
  property: string,
) {
  const dto = plainToInstance(cls, { [property]: value });
  const errors = await validate(dto);
  return errors.filter((e) => e.property === property);
}

describe('IsDbUuid', () => {
  describe('ApproveRegistrationDto.assignedPsychologistId', () => {
    it('acepta los ids escritos a mano del seed', async () => {
      expect(
        await errorsFor(ApproveRegistrationDto, SEED_ID, 'assignedPsychologistId'),
      ).toHaveLength(0);
    });

    it('acepta un uuid v4 real', async () => {
      expect(
        await errorsFor(ApproveRegistrationDto, REAL_V4, 'assignedPsychologistId'),
      ).toHaveLength(0);
    });

    it('sigue siendo opcional', async () => {
      expect(
        await errorsFor(ApproveRegistrationDto, undefined, 'assignedPsychologistId'),
      ).toHaveLength(0);
    });

    // Sin esto, un valor con forma inválida llega a la query y Postgres responde
    // `invalid input syntax for type uuid`: un 500 donde corresponde un 400.
    it.each<[unknown]>([['abc'], [''], ['1; DROP TABLE users'], [123], [{}]])(
      'rechaza %p',
      async (value) => {
        expect(
          await errorsFor(ApproveRegistrationDto, value, 'assignedPsychologistId'),
        ).not.toHaveLength(0);
      },
    );
  });

  describe('DeactivatePsychologistDto.reassignTo', () => {
    it('acepta los ids del seed, para poder reasignar a un psicólogo de desarrollo', async () => {
      expect(
        await errorsFor(DeactivatePsychologistDto, SEED_ID, 'reassignTo'),
      ).toHaveLength(0);
    });

    it('rechaza un valor con forma inválida', async () => {
      expect(
        await errorsFor(DeactivatePsychologistDto, 'no-es-un-id', 'reassignTo'),
      ).not.toHaveLength(0);
    });
  });
});

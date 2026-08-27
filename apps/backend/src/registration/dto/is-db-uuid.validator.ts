import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

// Postgres acepta cualquier valor con forma 8-4-4-4-12 hexadecimal; no mira los bits de
// versión ni de variante que exige la RFC. `@IsUUID()` sí los mira, y por eso rechaza los ids
// escritos a mano del seed ('33333333-3333-3333-3333-3333-33333333' y compañía), que son la
// mayoría de las cuentas de desarrollo. Validar con el criterio de la RFC deja fuera datos que
// la base guarda sin problema, así que se comprueba solo la forma: lo suficiente para que un
// valor basura dé 400 en vez de reventar la query con `invalid input syntax for type uuid`.
export const DB_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function IsDbUuid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isDbUuid',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          return typeof value === 'string' && DB_UUID_RE.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} debe ser un identificador válido`;
        },
      },
    });
  };
}

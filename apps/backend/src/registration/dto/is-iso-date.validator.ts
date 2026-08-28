import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { isValidIsoDate } from '@stopbet/shared-types';

// No se usa @IsDateString({ strict: true }): funciona, pero valida con validator.js mientras
// la app mobile valida con `isValidIsoDate` de shared-types, y dos implementaciones del mismo
// criterio pueden divergir. Envolver la función compartida deja una sola fuente de verdad.
export function IsIsoDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isIsoDate',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          return typeof value === 'string' && isValidIsoDate(value);
        },
        defaultMessage() {
          return 'La fecha de nacimiento no es una fecha válida';
        },
      },
    });
  };
}

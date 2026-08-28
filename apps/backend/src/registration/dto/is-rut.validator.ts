import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { isValidRut } from '@stopbet/shared-types';

export function IsRut(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isRut',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          return typeof value === 'string' && isValidRut(value);
        },
        defaultMessage() {
          return 'El RUT ingresado no es válido';
        },
      },
    });
  };
}

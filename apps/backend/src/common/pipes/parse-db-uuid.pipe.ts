import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { DB_UUID_RE } from '../../registration/dto/is-db-uuid.validator';

// Equivalente a `IsDbUuid` para parámetros de ruta y query, donde no hay DTO que decorar.
// `ParseUUIDPipe` de Nest aplica el criterio de la RFC y rechaza los ids escritos a mano del
// seed, que son la mayoría de las cuentas de desarrollo: con él, la demo no funciona.
//
// La expresión se importa del validador en vez de repetirse acá: si algún día se decide
// normalizar los ids del seed, hay un solo lugar que ajustar.
@Injectable()
export class ParseDbUuidPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !DB_UUID_RE.test(value)) {
      throw new BadRequestException('El identificador no es válido');
    }
    return value;
  }
}

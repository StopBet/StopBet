import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

// CA3: guardar con un campo obligatorio vacío queda bloqueado. Los cinco campos del CA1 son
// obligatorios, así que la validación es la misma para todos y se arma con este decorador
// compuesto en vez de repetirla cinco veces.
//
// `@IsNotEmpty` por sí solo deja pasar "   ": un campo con espacios cumple la validación y
// entra a la ficha como si el psicólogo hubiera escrito algo. El `@Transform` recorta antes de
// validar, así que el espacio en blanco se rechaza igual que el campo vacío, y de paso la ficha
// no guarda saltos de línea sueltos al final.
// `plural` existe solo para la concordancia del mensaje: cuatro de los cinco campos se nombran
// en plural («Los detonantes») y con una sola plantilla salía «Los detonantes es obligatorio»,
// que es el tipo de detalle que hace ver descuidada una herramienta clínica.
function CampoClinico(label: string, ejemplo: string, plural = false) {
  const obligatorio = plural ? 'son obligatorios' : 'es obligatorio';
  return function (target: object, propertyKey: string): void {
    ApiProperty({ description: label, example: ejemplo })(target, propertyKey);
    IsString({ message: `${label} ${plural ? 'deben' : 'debe'} ser texto` })(target, propertyKey);
    Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))(
      target,
      propertyKey,
    );
    IsNotEmpty({ message: `${label} ${obligatorio}` })(target, propertyKey);
  };
}

export class SaveClinicalRecordDto {
  @CampoClinico(
    'El motivo de ingreso',
    'Derivado por su pareja tras perder el sueldo en apuestas deportivas en línea.',
  )
  admissionReason: string;

  @CampoClinico(
    'Los antecedentes de la conducta de juego',
    'Juega hace 6 años. Empezó con quinielas entre amigos y pasó a casinos en línea en 2024.',
    true,
  )
  gamblingHistory: string;

  @CampoClinico(
    'Los detonantes',
    'Días de pago, publicidad de casinos en transmisiones deportivas, discusiones en la casa.',
    true,
  )
  triggers: string;

  @CampoClinico(
    'Los antecedentes de salud y red de apoyo',
    'Sin patología previa diagnosticada. Vive con su pareja, que acompaña el proceso.',
    true,
  )
  healthAndSupport: string;

  @CampoClinico(
    'Los objetivos del tratamiento',
    'Sostener la abstinencia a 90 días, asistir al grupo cada semana y recuperar el manejo del sueldo.',
    true,
  )
  treatmentGoals: string;
}

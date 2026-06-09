import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreatePostDto {
  @ApiProperty({ example: 'Hoy fue difícil pero lo logré. Quería compartirlo con ustedes.' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  body: string;

  @ApiProperty({ example: 'Santiago', description: 'Santiago | Viña del Mar | Concepción' })
  @IsNotEmpty()
  @IsString()
  sede: string;
}

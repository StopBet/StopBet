import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateReplyDto {
  @ApiProperty({ example: '¡Mucho ánimo! Cada día cuenta.' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  body: string;
}

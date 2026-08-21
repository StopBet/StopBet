import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterTokenDto {
  @ApiProperty({ description: 'Token de registro que entrega FCM en el dispositivo' })
  @IsString()
  @MinLength(10)
  @MaxLength(4096)
  token: string;

  @ApiProperty({ required: false, enum: ['android', 'ios'] })
  @IsOptional()
  @IsIn(['android', 'ios'])
  platform?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { FAMILY_LINK_VERIFICATIONS, FamilyLinkVerification } from '../entities/family-link.entity';

// HDU 23 CA4: confirmar exige decir cómo se verificó el vínculo. Sin este dato la
// confirmación queda sin sustento en la auditoría clínica.
export class ConfirmFamilyLinkDto {
  @ApiProperty({
    enum: FAMILY_LINK_VERIFICATIONS,
    description: 'patient_consulted: se le preguntó al paciente · in_person: se verificó en persona',
  })
  @IsIn(FAMILY_LINK_VERIFICATIONS, { message: 'Indica cómo verificaste el vínculo' })
  verification: FamilyLinkVerification;
}

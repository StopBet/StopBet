import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty } from 'class-validator';
import { ReactionEmoji } from '@stopbet/shared-types';

const REACTION_EMOJIS: ReactionEmoji[] = ['💪', '❤️', '🤗'];

export class AddReactionDto {
  @ApiProperty({ enum: REACTION_EMOJIS, example: '💪' })
  @IsNotEmpty()
  @IsIn(REACTION_EMOJIS)
  emoji: ReactionEmoji;
}

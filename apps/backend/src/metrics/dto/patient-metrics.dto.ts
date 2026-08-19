import { ApiProperty } from '@nestjs/swagger';

class MoodPointDto {
  @ApiProperty({ example: '2026-06-01' })
  date: string;

  @ApiProperty({ example: 4, minimum: 1, maximum: 5 })
  mood: number;
}

export class PatientMetricsDto {
  @ApiProperty({ type: [MoodPointDto] })
  evolution: MoodPointDto[];

  @ApiProperty({ example: 12 })
  totalCheckIns: number;

  @ApiProperty({ example: 1 })
  panicCount: number;

  @ApiProperty({ example: 3.7, nullable: true })
  moodAvg: number | null;
}
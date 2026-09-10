import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AchievementsController } from './achievements.controller';
import { DevToolsGuard } from '../common/guards/dev-tools.guard';

// POST /achievements/dev-set-days es una puerta trasera de desarrollo: si alguien
// borra el decorador en un rebase, vuelve a quedar viva en producción sin que falle
// ningún otro test unitario.
describe('POST /achievements/dev-set-days — protección declarada', () => {
  it('exige DevToolsGuard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      AchievementsController.prototype.devSetDays,
    );
    expect(guards).toEqual(expect.arrayContaining([DevToolsGuard]));
  });

  it('no aplica guards a nivel de clase, ni en los endpoints que usa mobile con x-user-id', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AchievementsController)).toBeUndefined();
    for (const method of ['getAchievements', 'reportRelapse', 'shareBadge'] as const) {
      expect(
        Reflect.getMetadata(GUARDS_METADATA, AchievementsController.prototype[method]),
      ).toBeUndefined();
    }
  });
});

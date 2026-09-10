import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthUser } from '@stopbet/shared-types';
import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

// El controlador es una capa de delegación: no tiene lógica propia, pero sí
// decide qué argumento de la petición recibe cada método del servicio. Estos
// tests fijan ese cableado, que es donde se cuelan los errores de este tipo de
// capa (pasar el header en vez del usuario del token, por ejemplo).
describe('CommunityController', () => {
  let controller: CommunityController;
  let service: jest.Mocked<Pick<
    CommunityService,
    | 'findAnnouncements'
    | 'createAnnouncement'
    | 'toggleAttendance'
    | 'findPosts'
    | 'createPost'
  >>;

  const AUTOR: AuthUser = {
    id: 'psicologo-1',
    email: 'psych@ajuter.cl',
    role: 'psychologist',
    firstName: 'Miguel',
    lastName: 'Lara',
    sedeId: null,
  };

  const USUARIO = 'usuario-1';
  const ANUNCIO = 'anuncio-1';

  beforeEach(() => {
    service = {
      findAnnouncements: jest.fn().mockResolvedValue([]),
      createAnnouncement: jest.fn().mockResolvedValue({ id: ANUNCIO }),
      toggleAttendance: jest.fn().mockResolvedValue({ attends: true }),
      findPosts: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      createPost: jest.fn().mockResolvedValue({ id: 'post-1' }),
    } as unknown as typeof service;

    controller = new CommunityController(service as unknown as CommunityService);
  });

  describe('anuncios', () => {
    it('createAnnouncement le pasa el id del usuario del token, no un header', async () => {
      const dto = { body: 'Anuncio', sede: 'Santiago' };
      await controller.createAnnouncement(AUTOR, dto);
      expect(service.createAnnouncement).toHaveBeenCalledWith(dto, AUTOR.id);
    });

    it('findAnnouncements consulta por el usuario de la cabecera', async () => {
      await controller.findAnnouncements(USUARIO, 'Santiago');
      expect(service.findAnnouncements).toHaveBeenCalledWith('Santiago', USUARIO);
    });

    it('toggleAttendance recibe el id del anuncio y el del usuario', async () => {
      await controller.toggleAttendance(ANUNCIO, USUARIO);
      expect(service.toggleAttendance).toHaveBeenCalledWith(ANUNCIO, USUARIO);
    });
  });
});

// El guard de POST /community/announcements es la única barrera del endpoint: si
// alguien lo borra en un rebase, el endpoint vuelve a quedar abierto a internet sin
// que falle ningún otro test unitario.
describe('POST /community/announcements — protección declarada', () => {
  it('exige JwtAuthGuard y RolesGuard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      CommunityController.prototype.createAnnouncement,
    );
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
  });

  it('restringe a psychologist y coordinator', () => {
    const roles = Reflect.getMetadata(
      ROLES_KEY,
      CommunityController.prototype.createAnnouncement,
    );
    expect(roles).toEqual(['psychologist', 'coordinator']);
  });

  it('no aplica guards a nivel de clase: los endpoints de mobile siguen sin token', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, CommunityController)).toBeUndefined();
    for (const method of ['findAnnouncements', 'toggleAttendance', 'findPosts', 'createPost'] as const) {
      expect(
        Reflect.getMetadata(GUARDS_METADATA, CommunityController.prototype[method]),
      ).toBeUndefined();
    }
  });
});

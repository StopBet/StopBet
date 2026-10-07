import { readTbkReturn } from './tbk-return-params.decorator';

describe('readTbkReturn', () => {
  it('lee el token de la query (retorno por GET)', () => {
    expect(readTbkReturn({ query: { TBK_TOKEN: 'abc123' } })).toEqual({
      token: 'abc123',
      abortedBuyOrder: null,
      abortedSessionId: null,
    });
  });

  it('lee el token del cuerpo (retorno por POST urlencoded)', () => {
    expect(readTbkReturn({ query: {}, body: { TBK_TOKEN: 'abc123' } }).token).toBe('abc123');
  });

  it('si el paciente anuló, trae además la orden de compra y la sesión', () => {
    const params = readTbkReturn({
      query: { TBK_TOKEN: 'abc', TBK_ORDEN_COMPRA: 'SB123', TBK_ID_SESION: 'sess-1' },
    });

    expect(params).toEqual({ token: 'abc', abortedBuyOrder: 'SB123', abortedSessionId: 'sess-1' });
  });

  // Por esto no se usa un DTO: el ValidationPipe global respondería 400 al navegador del paciente.
  it('ignora cualquier otro campo que mande Transbank', () => {
    const params = readTbkReturn({ query: { TBK_TOKEN: 'abc', campo_nuevo: 'x', otro: '1' } });

    expect(params).toEqual({ token: 'abc', abortedBuyOrder: null, abortedSessionId: null });
  });

  it.each([
    ['con espacios o símbolos', 'ab c;drop'],
    ['demasiado largo', 'a'.repeat(129)],
    ['vacío', ''],
  ])('descarta un token %s', (_caso, token) => {
    expect(readTbkReturn({ query: { TBK_TOKEN: token } }).token).toBeNull();
  });

  it('descarta valores que no son texto (arreglos u objetos de la query)', () => {
    expect(readTbkReturn({ query: { TBK_TOKEN: ['a', 'b'] } }).token).toBeNull();
    expect(readTbkReturn({ query: { TBK_TOKEN: { $ne: 'x' } } }).token).toBeNull();
  });

  it('sin query ni cuerpo no falla', () => {
    expect(readTbkReturn({})).toEqual({ token: null, abortedBuyOrder: null, abortedSessionId: null });
  });
});

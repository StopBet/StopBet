// Tipografía oficial StopBet — manual de marca (docs/manual-marca.md)
// Primaria   (títulos):    Chillax
// Secundaria (cuerpo/UI):  Satoshi   ← aplicada como default global en App.tsx
// Terciaria  (complemento): Lato

export const Fonts = {
  // Chillax — títulos y headings principales
  headingRegular:  'Chillax-Regular',
  heading:         'Chillax-SemiBold',
  headingBold:     'Chillax-Bold',

  // Satoshi — body, labels, botones (default global via Text.defaultProps)
  body:            'Satoshi-Regular',
  bodyMedium:      'Satoshi-Medium',
  bodyBold:        'Satoshi-Bold',

  // Lato — complementaria: apoyos, metadata, texto de bajo énfasis
  caption:         'Lato-Regular',
  captionBold:     'Lato-Bold',
};

export const FontSize = {
  xs:   11,
  sm:   13,
  base: 15,
  md:   17,
  lg:   20,
  xl:   24,
  xxl:  30,
  hero: 36,
};

export const LineHeight = {
  tight:  1.2,
  normal: 1.5,
  loose:  1.8,
};

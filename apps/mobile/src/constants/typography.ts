// Tipografía oficial StopBet — manual de marca
// Primaria  (títulos):       Chillax
// Secundaria (cuerpo/UI):    Lato      ← aplicada como default global en App.tsx
// Terciaria  (subtítulos):   Satoshi

export const Fonts = {
  // Chillax — títulos y headings principales
  headingRegular:  'Chillax-Regular',
  heading:         'Chillax-SemiBold',
  headingBold:     'Chillax-Bold',

  // Lato — body, labels, botones (default global via Text.defaultProps)
  body:            'Lato-Regular',
  bodyBold:        'Lato-Bold',

  // Satoshi — subtítulos, metadata, complementario
  caption:         'Satoshi-Regular',
  captionMedium:   'Satoshi-Medium',
  captionBold:     'Satoshi-Bold',
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

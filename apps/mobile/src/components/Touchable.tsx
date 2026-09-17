import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

/**
 * Un `TouchableOpacity` con la onda de Material.
 *
 * Android responde al toque con una onda que sale del dedo; la app solo bajaba la
 * opacidad, que es el gesto de iOS. En un teléfono Android eso se siente como si el
 * toque no hubiera entrado - sobre todo en el botón de pánico y en las reacciones, donde
 * el paciente necesita saber de inmediato que lo tocó.
 *
 * Se mantiene la baja de opacidad además de la onda: en superficies de color la onda
 * blanca casi no se ve, y al revés en superficies claras.
 */
export interface TouchableProps extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Igual que en TouchableOpacity: cuánto baja la opacidad al presionar. */
  activeOpacity?: number;
  /** Para círculos y botones redondos: la onda se desborda en vez de recortarse. */
  borderless?: boolean;
  /** Color de la onda; por omisión, gris translúcido que sirve sobre claro y sobre color. */
  rippleColor?: string;
}

export function Touchable({
  style,
  activeOpacity = 0.7,
  borderless = false,
  rippleColor = 'rgba(80,79,79,0.14)',
  children,
  ...rest
}: TouchableProps) {
  return (
    <Pressable
      // `foreground` dibuja la onda encima del contenido, que es lo que la recorta bien
      // en las píldoras y tarjetas con borderRadius.
      android_ripple={{ color: rippleColor, borderless, foreground: !borderless }}
      style={({ pressed }) => [style, pressed && { opacity: activeOpacity }]}
      {...rest}
    >
      {children}
    </Pressable>
  );
}

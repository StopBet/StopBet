// Los íconos se importan uno por uno (`.../icons/house.mjs`) y no desde el índice del
// paquete: importar del índice mete los 1.714 íconos de Lucide en el bundle. El paquete
// no publica tipos para esas rutas, así que se declaran acá.
declare module 'lucide-react-native/dist/esm/icons/*' {
  import type { FC } from 'react';
  import type { LucideProps } from 'lucide-react-native';
  const icon: FC<LucideProps>;
  export default icon;
}

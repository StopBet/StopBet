const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const monorepoRoot = path.resolve(__dirname, '../..');

const config = {
  // Limitar workers en máquinas con poca RAM (8 workers saturan la memoria en la serialización
  // final del bundle). 2 workers liberan ~500MB y permiten completar el build sin que el SO mate procesos.
  maxWorkers: 2,

  // node_modules local resuelve los polyfills de metro-runtime; node_modules raíz es obligatorio
  // porque pnpm symlinkea los paquetes (ej: @babel/runtime) hacia el store .pnpm que vive ahí.
  // No se observa todo el monorepo para evitar escanear apps/backend/node_modules.
  watchFolders: [
    path.resolve(__dirname, 'node_modules'),
    path.resolve(monorepoRoot, 'node_modules'),
    path.resolve(monorepoRoot, 'packages'),
  ],

  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],
    // Excluir las carpetas de build de Android: CMake crea/borra directorios
    // temporales (.cxx) durante la compilacion nativa y el watcher de Windows
    // (sin watchman) crashea con ENOENT al intentar observarlos.
    blockList: [
      /.*\/android\/build\/.*/,
      /.*\/android\/\.cxx\/.*/,
      /.*\/android\/app\/build\/.*/,
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

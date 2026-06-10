const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const monorepoRoot = path.resolve(__dirname, '../..');

const config = {
  // Solo observar node_modules propio y packages/ — no todo el monorepo (evita escanear backend/node_modules)
  // node_modules local es obligatorio: el dev server resuelve ahí los polyfills de metro-runtime
  watchFolders: [
    path.resolve(__dirname, 'node_modules'),
    path.resolve(monorepoRoot, 'packages'),
  ],

  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

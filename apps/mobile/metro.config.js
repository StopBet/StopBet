const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const monorepoRoot = path.resolve(__dirname, '../..');

const config = {
  // Limitar workers en máquinas con poca RAM.
  maxWorkers: 2,

  // node_modules local resuelve los polyfills de metro-runtime; node_modules raíz es
  // obligatorio porque pnpm symlinkea los paquetes hacia el store .pnpm que vive ahí.
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
    blockList: [
      /.*\/android\/build\/.*/,
      /.*\/android\/\.cxx\/.*/,
      /.*\/android\/app\/build\/.*/,
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

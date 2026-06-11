const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const monorepoRoot = path.resolve(__dirname, '../..');

// Cuando Metro corre desde S:\ (subst) las junctions de pnpm resuelven a rutas C:\.
// STOPBET_REAL_ROOT apunta al repo real (C:\...) para que esas rutas queden vigiladas.
const realRoot = process.env.STOPBET_REAL_ROOT || null;
const realMobileDir = realRoot ? path.resolve(realRoot, 'apps', 'mobile') : null;

const watchFolders = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'packages'),
  ...(realMobileDir ? [
    path.resolve(realMobileDir, 'node_modules'),
    path.resolve(realRoot, 'node_modules'),
    path.resolve(realRoot, 'packages'),
  ] : []),
];

const config = {
  // Limitar workers en máquinas con poca RAM.
  maxWorkers: 2,

  watchFolders,

  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(monorepoRoot, 'node_modules'),
      ...(realMobileDir ? [
        path.resolve(realMobileDir, 'node_modules'),
        path.resolve(realRoot, 'node_modules'),
      ] : []),
    ],
    blockList: [
      /.*\/android\/build\/.*/,
      /.*\/android\/\.cxx\/.*/,
      /.*\/android\/app\/build\/.*/,
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

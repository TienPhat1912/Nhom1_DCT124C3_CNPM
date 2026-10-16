const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// This repository has independent npm lockfiles, not an npm workspace root.
config.watchFolders = [...(config.watchFolders || []), path.resolve(__dirname, '../../packages')];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, 'node_modules')];
module.exports = config;

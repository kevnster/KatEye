const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// repo-root firebase-rtdb-schema-example.json for bundled fixture imports
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(projectRoot, '..')];

module.exports = config;

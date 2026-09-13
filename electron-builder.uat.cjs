const {build, version} = require('./package.json');

module.exports = {
  ...build,
  extends: null,
  appId: 'local.seasonshelf.desktop.uat',
  productName: 'Season Shelf UAT',
  directories: {...build.directories, output: 'release/uat'},
  extraMetadata: {appEnvironment: 'uat', version: version.includes('-uat.') ? version : `${version}-uat.0`},
  artifactName: 'Season-Shelf-UAT-Setup-${version}-${arch}.${ext}',
  mac: {...build.mac, artifactName: 'Season-Shelf-UAT-${version}-mac-${arch}.${ext}'},
  publish: {...build.publish, channel: 'uat', releaseType: 'prerelease'},
};

const {acceptsUpdate} = require('../src/desktop/environment.cjs');

module.exports = ({packager}) => {
  const environment = packager.config.extraMetadata?.appEnvironment;
  if (!acceptsUpdate(environment, packager.appInfo.version)) {
    throw new Error('Production requires a stable X.Y.Z version');
  }
};

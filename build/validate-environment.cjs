const {acceptsUpdate} = require('../src/desktop/environment.cjs');

module.exports = ({packager}) => {
  const environment = packager.config.extraMetadata?.appEnvironment;
  if (!acceptsUpdate(environment, packager.appInfo.version)) {
    throw new Error('Production requires X.Y.Z; UAT requires X.Y.Z-uat.N');
  }
};

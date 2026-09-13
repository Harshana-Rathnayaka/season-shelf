const path = require('node:path');
const {mkdirSync} = require('node:fs');

// Called before the single-instance lock or any credential/database access.
exports.configureProfile = (app, environment = app.isPackaged ? 'production' : 'development') => {
  if (!['development', 'uat', 'production'].includes(environment)) throw new Error('Invalid profile environment');
  // Retain the existing source-development profile and installed production path.
  const directory = environment === 'development' ? app.getPath('userData')
    : path.join(app.getPath('appData'), environment === 'uat' ? 'Season Shelf UAT' : 'Season Shelf',
      app.isPackaged ? 'installed' : environment === 'uat' ? 'development' : 'production-preview');
  mkdirSync(directory, {recursive:true});
  app.setPath('userData', directory);
  app.setPath('sessionData', directory);
  return directory;
};

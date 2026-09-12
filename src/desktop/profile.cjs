const path = require('node:path');
const {mkdirSync} = require('node:fs');

// Called before the single-instance lock or any credential/database access.
exports.configureProfile = app => {
  if (!app.isPackaged) return;
  const directory = path.join(app.getPath('appData'), 'Season Shelf', 'installed');
  mkdirSync(directory, {recursive:true});
  app.setPath('userData', directory);
};

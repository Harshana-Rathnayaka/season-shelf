const definitions = {
  development: {name: 'Season Shelf Dev', appId: 'local.seasonshelf.desktop.dev', channel: null},
  uat: {name: 'Season Shelf UAT', appId: 'local.seasonshelf.desktop.uat', channel: 'uat'},
  production: {name: 'Season Shelf', appId: 'local.seasonshelf.desktop', channel: 'latest'},
};

exports.resolveEnvironment = ({isPackaged, metadata = {}, argv = []}) => {
  // Installed identity comes from build metadata, never a launch argument.
  const flags = argv.filter(value => value.startsWith('--environment='));
  if (!isPackaged && flags.length > 1) throw new Error('Specify one environment');
  const environment = isPackaged ? (metadata.appEnvironment || 'production') : (flags[0]?.split('=')[1] || 'development');
  if (!Object.hasOwn(definitions, environment) || (isPackaged && environment === 'development')) {
    throw new Error('Invalid application environment');
  }
  const definition = definitions[environment];
  return {...definition, environment, name: !isPackaged && environment === 'production' ? 'Season Shelf Production Preview' : definition.name,
    liveReload: !isPackaged && environment === 'development' && argv.includes('--dev')};
};

exports.acceptsUpdate = (environment, version) => {
  if (typeof version !== 'string') return false;
  return environment === 'uat' ? /^\d+\.\d+\.\d+-uat\.\d+$/.test(version)
    : environment === 'production' && /^\d+\.\d+\.\d+$/.test(version);
};

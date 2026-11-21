exports.hasSecureStorage = (safeStorage, platform = process.platform) =>
  safeStorage.isEncryptionAvailable() &&
  (platform !== 'linux' || safeStorage.getSelectedStorageBackend() !== 'basic_text');

exports.credentialStorage = (store, safeStorage, platform = process.platform) => {
  const requireSecureStorage = () => {
    if (!exports.hasSecureStorage(safeStorage, platform))
      throw new Error('Secure OS credential storage is unavailable');
  };
  return {
    loadCredentials() {
      const encrypted = store.get('credentials', null);
      if (!encrypted) return null;
      requireSecureStorage();
      return JSON.parse(safeStorage.decryptString(Buffer.from(encrypted, 'base64')));
    },
    saveCredentials({ apiId, apiHash, session }) {
      requireSecureStorage();
      // Never persist passwords, verification codes or arbitrary caller fields.
      store.set('credentials', safeStorage.encryptString(JSON.stringify({ apiId, apiHash, session })).toString('base64'));
    },
    clearCredentials() { store.set('credentials', null); },
  };
};

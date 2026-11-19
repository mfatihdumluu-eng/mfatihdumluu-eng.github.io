const productionOrigin = 'https://invoice-control-api.onrender.com';

module.exports = ({ config }) => {
  const isStoreBeta = process.env.AVANTAGE_STORE_BETA === '1';
  const configuredOrigin = process.env.AVANTAGE_STAGING_ORIGIN;
  let origin = productionOrigin;

  if (isStoreBeta) {
    let staging;
    try {
      staging = new URL(configuredOrigin);
    } catch {
      throw new Error('Set AVANTAGE_STAGING_ORIGIN to the HTTPS origin of the staging API.');
    }
    if (staging.protocol !== 'https:' || staging.href !== `${staging.origin}/` || staging.origin === productionOrigin) {
      throw new Error('Store beta requires a separate HTTPS staging origin without a path or credentials.');
    }
    origin = staging.origin;
  }

  return { ...config, extra: { ...config.extra, invoiceOrigin: origin } };
};

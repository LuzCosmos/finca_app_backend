export const req = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`Missing env ${k}`);
  return v;
};
export const reqInt = (k: string) => {
  const n = parseInt(req(k), 10);
  if (Number.isNaN(n)) throw new Error(`Env ${k} must be an integer`);
  return n;
};

export const ENV = {
  ENVIRONMENT: req('ENVIRONMENT'),
  APP_PORT_EXTERNAL: reqInt('APP_PORT_EXTERNAL'),
  FA_DB_PORT_EXTERNAL: reqInt('FA_DB_PORT_EXTERNAL'),
  FA_REDIS_PORT_EXTERNAL: reqInt('FA_REDIS_PORT_EXTERNAL'),

  APP_PORT: reqInt('APP_PORT'),

  FA_DB_HOST: req('FA_DB_HOST'),
  FA_DB_PORT: reqInt('FA_DB_PORT'),
  FA_DB_NAME: req('FA_DB_NAME'),
  FA_DB_USER: req('FA_DB_USER'),
  FA_DB_PASSWORD: req('FA_DB_PASSWORD'),
  DB_SCHEMA: process.env.DB_SCHEMA ?? 'public',

  FA_REDIS_HOST: req('FA_REDIS_HOST'),
  FA_REDIS_PORT: reqInt('FA_REDIS_PORT'),
  FA_REDIS_PASSWORD: req('FA_REDIS_PASSWORD'),

  MQTT_BROKER_HOST: req('MQTT_BROKER_HOST'),
  MQTT_BROKER_PORT: reqInt('MQTT_BROKER_PORT'),
  MQTT_BROKER_PROTOCOL: req('MQTT_BROKER_PROTOCOL'),

  CHIRPSTACK_API_URL: req('CHIRPSTACK_API_URL'),
  CHIRPSTACK_API_KEY: req('CHIRPSTACK_API_KEY'),
};

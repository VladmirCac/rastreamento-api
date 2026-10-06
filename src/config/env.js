import "dotenv/config";

const variaveisAusentes = [];

function lerTextoObrigatorio(nome) {
  const valor = process.env[nome]?.trim();

  if (!valor) {
    variaveisAusentes.push(nome);
    return "";
  }

  return valor;
}

function lerNumero(nome, valorPadrao) {
  const valorBruto = process.env[nome];
  const valorNormalizado = valorBruto?.trim();

  if (!valorNormalizado) {
    return valorPadrao;
  }

  const valorNumero = Number(valorNormalizado);

  if (!Number.isFinite(valorNumero)) {
    throw new Error(`Variavel de ambiente invalida para numero: ${nome}`);
  }

  return valorNumero;
}

const config = {
  port: lerNumero("PORT", 3000),

  correiosBaseUrl: lerTextoObrigatorio("CORREIOS_BASE_URL"),
  usuarioMeusCorreios: lerTextoObrigatorio("USUARIO_MEUS_CORREIOS"),
  wsNovaApi: lerTextoObrigatorio("WS_NOVA_API"),
  contratoCorreios: lerTextoObrigatorio("CONTRATO_CORREIOS"),
  correiosDr: lerNumero("CORREIOS_DR", 30),

  airtableApiKey: lerTextoObrigatorio("AIRTABLE_API_KEY"),
  airtableBaseId: lerTextoObrigatorio("AIRTABLE_BASE_ID"),
  airtableTable: lerTextoObrigatorio("AIRTABLE_TABLE"),

  cronSecret: lerTextoObrigatorio("CRON_SECRET"),

  dbHost: lerTextoObrigatorio("DB_HOST"),
  dbPort: lerNumero("DB_PORT", 3306),
  dbUser: lerTextoObrigatorio("DB_USER"),
  dbPass: lerTextoObrigatorio("DB_PASS"),
  dbName: lerTextoObrigatorio("DB_NAME"),

  requestTimeoutMs: lerNumero("REQUEST_TIMEOUT_MS", 20000),
  correiosConcurrency: Math.max(1, lerNumero("CORREIOS_CONCURRENCY", 10)),
  tokenExpirySafetyMs: Math.max(0, lerNumero("TOKEN_EXPIRY_SAFETY_MS", 60000)),
};

if (variaveisAusentes.length > 0) {
  throw new Error(
    `Variaveis de ambiente obrigatorias ausentes: ${variaveisAusentes.join(", ")}`
  );
}

export default config;

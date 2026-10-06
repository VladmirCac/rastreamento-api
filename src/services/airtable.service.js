import axios from "axios";
import config from "../config/env.js";

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const airtableApi = axios.create({
  baseURL: `https://api.airtable.com/v0/${config.airtableBaseId}/${encodeURIComponent(config.airtableTable)}`,
  headers: {
    Authorization: `Bearer ${config.airtableApiKey}`,
    "Content-Type": "application/json",
  },
  timeout: config.requestTimeoutMs,
});

// Interceptor para reexecutar requisições que excederem o rate limit (HTTP 429) do Airtable
airtableApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const configOriginal = error.config;

    if (status === 429 && !configOriginal._retry429) {
      configOriginal._retry429 = true;
      console.warn("[Airtable] Limite de 5 req/s atingido (429). Aguardando 1.5s para nova tentativa...");
      await esperar(1500);
      return airtableApi(configOriginal);
    }

    return Promise.reject(error);
  }
);

export async function buscarPendentes() {
  let todosRegistros = [];
  let offset;
  // Exclui status terminais (Entregue, Devolvido, Cancelado) para evitar acúmulo infinito de consultas
  const filterByFormula = "AND(Status!='Entregue', Status!='Devolvido', Status!='Cancelado', Codigo!='')";

  do {
    const response = await airtableApi.get("", {
      params: {
        filterByFormula,
        offset,
      },
    });

    const registros = response.data.records || [];
    todosRegistros = todosRegistros.concat(registros);
    offset = response.data.offset;

    if (offset) {
      await esperar(220); // Respeita o limite de 5 req/s da API do Airtable
    }
  } while (offset);

  return todosRegistros;
}

export async function buscarCodigosExistentes(codigosFiltrar = []) {
  const codigos = new Set();

  // Se uma lista de códigos foi informada, faz a verificação pontual em vez de escanear a tabela toda
  if (Array.isArray(codigosFiltrar) && codigosFiltrar.length > 0) {
    const codigosUnicos = [...new Set(codigosFiltrar.filter(Boolean))];
    const TAMANHO_LOTE_CONSULTA = 40;

    for (let i = 0; i < codigosUnicos.length; i += TAMANHO_LOTE_CONSULTA) {
      const lote = codigosUnicos.slice(i, i + TAMANHO_LOTE_CONSULTA);
      const condicoes = lote.map((c) => `{Codigo}='${c.replace(/'/g, "\\'")}'`).join(",");
      const filterByFormula = `OR(${condicoes})`;

      let offset;
      do {
        const response = await airtableApi.get("", {
          params: {
            "fields[]": "Codigo",
            filterByFormula,
            offset,
          },
        });

        for (const record of response.data.records || []) {
          if (record.fields?.Codigo) {
            codigos.add(record.fields.Codigo);
          }
        }
        offset = response.data.offset;
        if (offset) await esperar(220);
      } while (offset);

      if (i + TAMANHO_LOTE_CONSULTA < codigosUnicos.length) {
        await esperar(220);
      }
    }

    return codigos;
  }

  // Fallback: varredura completa caso nenhum código específico seja passado
  let offset;
  do {
    const response = await airtableApi.get("", {
      params: {
        "fields[]": "Codigo",
        filterByFormula: "Codigo!=''",
        offset,
      },
    });

    for (const record of response.data.records || []) {
      if (record.fields.Codigo) {
        codigos.add(record.fields.Codigo);
      }
    }
    offset = response.data.offset;
    if (offset) await esperar(220);
  } while (offset);

  return codigos;
}

export async function criarRegistros(registros) {
  if (!Array.isArray(registros) || registros.length === 0) return;

  const chunks = [];
  for (let i = 0; i < registros.length; i += 10) {
    chunks.push(registros.slice(i, i + 10));
  }

  for (let i = 0; i < chunks.length; i++) {
    await airtableApi.post("", { records: chunks[i] });
    if (i < chunks.length - 1) {
      await esperar(220); // Throttle entre lotes para respeitar taxa máxima
    }
  }
}

export async function atualizarEmLote(registros) {
  if (!Array.isArray(registros) || registros.length === 0) return;

  const vistos = new Map();
  for (const registro of registros) {
    vistos.set(registro.id, registro);
  }
  const unicos = [...vistos.values()];

  const chunks = [];
  for (let i = 0; i < unicos.length; i += 10) {
    chunks.push(unicos.slice(i, i + 10));
  }

  for (let i = 0; i < chunks.length; i++) {
    await airtableApi.patch("", { records: chunks[i] });
    if (i < chunks.length - 1) {
      await esperar(220); // Throttle entre lotes para respeitar taxa máxima
    }
  }
}


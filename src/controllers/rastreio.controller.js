import crypto from "crypto";
import pLimit from "p-limit";
import config from "../config/env.js";
import { gerarToken } from "../services/token.service.js";
import { consultarRastreiosEmLote } from "../services/correios.service.js";
import { buscarPendentes, atualizarEmLote } from "../services/airtable.service.js";
import { mapearStatus } from "../utils/statusMapper.js";

const CORREIOS_REGEX = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

function validarSegredo(recebido, configurado) {
  if (!recebido || typeof recebido !== "string") return false;
  const bufA = Buffer.from(recebido);
  const bufB = Buffer.from(configurado);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function dividirEmLotes(lista, tamanho) {
  const lotes = [];

  for (let i = 0; i < lista.length; i += tamanho) {
    lotes.push(lista.slice(i, i + tamanho));
  }

  return lotes;
}

function montarAtualizacao(registro, ultimoEvento) {
  const novoStatus = mapearStatus(ultimoEvento);
  const statusAtual = registro.fields?.Status;
  const eventoAtual = registro.fields?.["Último Evento"];
  const descricaoEvento = ultimoEvento.descricao || "";

  const mudouStatus = novoStatus !== statusAtual;
  const mudouEvento = descricaoEvento !== eventoAtual;

  // Se nada relevante mudou, evita requisições de escrita desnecessárias no Airtable
  if (!mudouStatus && !mudouEvento) {
    return null;
  }

  const fields = {
    Status: novoStatus,
    "Último Evento": descricaoEvento,
    "Última Atualização": new Date().toISOString(),
  };

  if (novoStatus === "Postado" && !registro.fields?.["Data Postagem"]) {
    fields["Data Postagem"] =
      ultimoEvento.dtHrCriado?.split("T")[0] ||
      new Date().toISOString().split("T")[0];
  }

  if (novoStatus === "Entregue" && !registro.fields?.["Data Entrega"]) {
    fields["Data Entrega"] =
      ultimoEvento.dtHrCriado || new Date().toISOString();
  }

  return {
    id: registro.id,
    fields,
  };
}

export default async function rastreioController(req, res) {
  if (!validarSegredo(req.headers["x-secret"], config.cronSecret)) {
    return res.status(401).json({ erro: "Não autorizado" });
  }

  const inicioExecucao = Date.now();

  try {
    console.log("1. Gerando token dos Correios...");
    const token = await gerarToken();

    console.log("2. Buscando registros pendentes no Airtable...");
    const registros = await buscarPendentes();

    if (!registros.length) {
      return res.status(200).json({
        sucesso: true,
        mensagem: "Nenhum rastreio pendente encontrado",
        totalEncontrados: 0,
        totalAtualizados: 0,
        totalFalhas: 0,
        duracaoMs: Date.now() - inicioExecucao,
      });
    }

    // Sanitiza e valida o formato padrão de 13 caracteres dos Correios
    const registrosValidos = [];
    const mapaRegistros = new Map();

    for (const registro of registros) {
      const codigoBruto = registro.fields?.Codigo;
      if (!codigoBruto || typeof codigoBruto !== "string") continue;

      const codigoLimpo = codigoBruto.trim().toUpperCase();
      if (CORREIOS_REGEX.test(codigoLimpo)) {
        registrosValidos.push(registro);
        mapaRegistros.set(codigoLimpo, registro);
      } else {
        console.warn(`[Rastreio] Código com formato inválido ignorado: "${codigoBruto}" (ID: ${registro.id})`);
      }
    }

    const codigos = [...mapaRegistros.keys()];

    if (codigos.length === 0) {
      return res.status(200).json({
        sucesso: true,
        mensagem: "Nenhum código de rastreio com formato válido encontrado",
        totalEncontrados: registros.length,
        totalAtualizados: 0,
        totalFalhas: 0,
        duracaoMs: Date.now() - inicioExecucao,
      });
    }

    const TAMANHO_LOTE = 50;
    const lotes = dividirEmLotes(codigos, TAMANHO_LOTE);
    const limite = pLimit(config.correiosConcurrency);

    console.log(
      `3. Consultando ${codigos.length} rastreios em ${lotes.length} lote(s) com concorrencia ${config.correiosConcurrency}...`,
    );

    const resultados = await Promise.all(
      lotes.map((lote) =>
        limite(async () => {
          try {
            const objetos = await consultarRastreiosEmLote(lote, token);
            const atualizacoes = [];

            for (const objeto of objetos) {
              const codigo = objeto.codObjeto?.trim()?.toUpperCase();
              const registro = mapaRegistros.get(codigo);

              if (!registro) continue;

              const ultimoEvento = objeto?.eventos?.[0];
              if (!ultimoEvento) {
                console.warn(`Sem eventos para o código ${codigo}`);
                continue;
              }

              const atualizacao = montarAtualizacao(registro, ultimoEvento);
              if (atualizacao) {
                atualizacoes.push(atualizacao);
              }
            }

            return {
              atualizacoes,
              falhas: 0,
            };
          } catch (error) {
            console.error("Erro ao consultar lote:", lote);
            console.error(error.response?.data || error.message);

            return {
              atualizacoes: [],
              falhas: lote.length,
            };
          }
        }),
      ),
    );

    const atualizacoes = resultados.flatMap((resultado) => resultado.atualizacoes);
    const totalFalhas = resultados.reduce(
      (acumulado, resultado) => acumulado + resultado.falhas,
      0,
    );

    if (atualizacoes.length > 0) {
      await atualizarEmLote(atualizacoes);
    }

    const duracaoMs = Date.now() - inicioExecucao;

    console.log(
      JSON.stringify({
        evento: "atualizacao_rastreios_finalizada",
        totalEncontrados: registros.length,
        totalAtualizados: atualizacoes.length,
        totalFalhas,
        totalLotes: lotes.length,
        tamanhoLote: TAMANHO_LOTE,
        concorrencia: config.correiosConcurrency,
        duracaoMs,
      }),
    );

    return res.status(200).json({
      sucesso: true,
      mensagem: "Rastreios processados com sucesso",
      totalEncontrados: registros.length,
      totalAtualizados: atualizacoes.length,
      totalFalhas,
      totalLotes: lotes.length,
      tamanhoLote: TAMANHO_LOTE,
      concorrencia: config.correiosConcurrency,
      duracaoMs,
    });
  } catch (error) {
    console.error("Erro geral na atualização:", {
      status: error.response?.status,
      url: error.config?.url,
      mensagem: error.message,
      detalhes: error.response?.data,
    });

    return res.status(500).json({
      erro: "Erro interno no processamento dos rastreios",
      duracaoMs: Date.now() - inicioExecucao,
    });
  }
}

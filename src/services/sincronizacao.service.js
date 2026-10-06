import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buscarPostagensNovas } from "./mysql.service.js";
import { buscarCodigosExistentes, criarRegistros } from "./airtable.service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, "../data/sync_state.json");

let sincronizacaoEmAndamento = false;

async function lerUltimoCreatedAt() {
  try {
    const conteudo = await readFile(STATE_FILE, "utf8");
    const estado = JSON.parse(conteudo);
    const d = new Date(estado.lastCreatedAt);
    if (!Number.isNaN(d.getTime())) {
      return d;
    }
    throw new Error("Data invalida no sync_state.json");
  } catch {
    // Caso o arquivo não exista ou esteja corrompido:
    // Permite definir SYNC_START_DATE no ambiente, ou usa 7 dias atrás por segurança
    if (process.env.SYNC_START_DATE) {
      const dataEnv = new Date(process.env.SYNC_START_DATE);
      if (!Number.isNaN(dataEnv.getTime())) return dataEnv;
    }
    return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  }
}

async function gravarUltimoCreatedAt(data) {
  await mkdir(join(__dirname, "../data"), { recursive: true });
  await writeFile(
    STATE_FILE,
    JSON.stringify({ lastCreatedAt: data.toISOString() }, null, 2),
    "utf8"
  );
}

function formatarDataParaAirtable(valor) {
  if (!valor) return new Date().toISOString().split("T")[0];
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime())
    ? new Date().toISOString().split("T")[0]
    : d.toISOString().split("T")[0];
}

export async function executarSincronizacao() {
  if (sincronizacaoEmAndamento) {
    console.warn("[Sincronizacao] Ciclo anterior ainda em andamento. Ignorando novo disparo.");
    return;
  }

  sincronizacaoEmAndamento = true;

  try {
    console.log(`[Sincronizacao] Iniciando ciclo em ${new Date().toISOString()}`);

    const lastCreatedAt = await lerUltimoCreatedAt();
    console.log(`[Sincronizacao] Buscando postagens com created_at > ${lastCreatedAt.toISOString()}`);

    const postagens = await buscarPostagensNovas(lastCreatedAt);
    console.log(`[Sincronizacao] ${postagens.length} postagem(ns) encontrada(s) no MySQL`);

    if (postagens.length === 0) {
      console.log("[Sincronizacao] Nenhum registro novo. Ciclo encerrado.");
      return;
    }

    // Consulta apenas os códigos retornados do MySQL no Airtable (otimização de requisições)
    const codigosNovos = postagens
      .map((p) => p.numero_etiqueta?.trim())
      .filter(Boolean);

    const codigosExistentes = await buscarCodigosExistentes(codigosNovos);
    console.log(
      `[Sincronizacao] ${codigosExistentes.size} codigo(s) ja existente(s) no Airtable dentre os ${codigosNovos.length} consultados`
    );

    // Deduplica internamente no lote e remove os já existentes no Airtable
    const etiquetasVistas = new Set();
    const novosRegistros = [];

    for (const p of postagens) {
      const etiqueta = p.numero_etiqueta?.trim();
      if (!etiqueta || codigosExistentes.has(etiqueta) || etiquetasVistas.has(etiqueta)) {
        continue;
      }
      etiquetasVistas.add(etiqueta);
      novosRegistros.push({
        fields: {
          Canal: p.canal_venda,
          "Numero Pedido": p.numero_pedido_externo,
          Codigo: etiqueta,
          "Data Postagem": formatarDataParaAirtable(p.created_at),
        },
      });
    }

    console.log(`[Sincronizacao] ${novosRegistros.length} registro(s) novo(s) para criar no Airtable`);

    if (novosRegistros.length > 0) {
      await criarRegistros(novosRegistros);
      console.log("[Sincronizacao] Registros criados no Airtable com sucesso.");
    }

    const maxCreatedAt = postagens.reduce((max, p) => {
      const d = p.created_at instanceof Date ? p.created_at : new Date(p.created_at);
      return !Number.isNaN(d.getTime()) && d > max ? d : max;
    }, new Date(0));

    if (maxCreatedAt.getTime() > 0) {
      await gravarUltimoCreatedAt(maxCreatedAt);
      console.log(`[Sincronizacao] Ultimo created_at gravado: ${maxCreatedAt.toISOString()}`);
    }

    console.log("[Sincronizacao] Ciclo encerrado com sucesso.");
  } finally {
    sincronizacaoEmAndamento = false;
  }
}

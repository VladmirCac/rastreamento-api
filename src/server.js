import express from "express";
import cron from "node-cron";
import config from "./config/env.js";
import rastreioController from "./controllers/rastreio.controller.js";
import { executarSincronizacao } from "./services/sincronizacao.service.js";

import { fecharPool } from "./services/mysql.service.js";

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.status(200).json({
    ok: true,
    service: "rastreamento-api",
    timestamp: new Date().toISOString(),
  });
});

app.post("/atualizar-rastreios", rastreioController);

// Middleware global para tratamento de erros não capturados no Express
app.use((err, req, res, next) => {
  console.error("[Express] Erro não tratado na requisição:", err);
  res.status(500).json({ erro: "Erro interno do servidor" });
});

const server = app.listen(config.port, () => {
  console.log(`Servidor rodando na porta ${config.port}`);
});

async function rodarSincronizacao() {
  try {
    await executarSincronizacao();
  } catch (err) {
    console.error("[Sincronizacao] Erro no ciclo:", err.message);
  }
}

// Segunda a sábado às 12:00 e às 18:00
const cronAlmoco = cron.schedule("0 12 * * 1-6", rodarSincronizacao);
const cronTarde = cron.schedule("0 18 * * 1-6", rodarSincronizacao);

console.log("[Sincronizacao] Agendamento ativo: 12:00 e 18:00 (seg-sab)");

// Encerramento gracioso para containers Docker e sinais do SO
let encerramentoIniciado = false;

async function finalizarAplicacao(sinal) {
  if (encerramentoIniciado) return;
  encerramentoIniciado = true;

  console.log(`\n[Shutdown] Recebido sinal ${sinal}. Encerrando aplicação com segurança...`);

  cronAlmoco.stop();
  cronTarde.stop();

  server.close(async () => {
    console.log("[Shutdown] Servidor HTTP encerrado.");
    try {
      await fecharPool();
      console.log("[Shutdown] Pool de conexões do MySQL encerrado.");
    } catch (err) {
      console.error("[Shutdown] Erro ao fechar pool do MySQL:", err.message);
    }
    process.exit(0);
  });

  // Força encerramento se travar por mais de 10 segundos
  setTimeout(() => {
    console.error("[Shutdown] Tempo limite de encerramento excedido. Forçando saída.");
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => finalizarAplicacao("SIGTERM"));
process.on("SIGINT", () => finalizarAplicacao("SIGINT"));
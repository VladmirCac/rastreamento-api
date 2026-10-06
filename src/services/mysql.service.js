import mysql from "mysql2/promise";
import config from "../config/env.js";

let pool = null;

function obterPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: config.dbHost,
      port: config.dbPort || 3306,
      user: config.dbUser,
      password: config.dbPass,
      database: config.dbName,
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 10000,
    });
  }
  return pool;
}

export async function buscarPostagensNovas(lastCreatedAt, limite = 500) {
  const db = obterPool();

  const [rows] = await db.query(
    `SELECT postagens.canal_venda,
            postagens.numero_pedido_externo,
            postagens_numeros_etiquetas.numero_etiqueta,
            postagens.created_at
     FROM postagens
     JOIN postagens_numeros_etiquetas
       ON postagens.numero_etiqueta_id = postagens_numeros_etiquetas.id
     WHERE postagens.canal_venda IN ('E-commerce', 'Loja')
       AND postagens.created_at > ?
     ORDER BY postagens.created_at ASC
     LIMIT ?`,
    [lastCreatedAt, Number(limite)]
  );
  return rows;
}

export async function fecharPool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

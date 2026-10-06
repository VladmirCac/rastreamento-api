import axios from "axios";
import config from "../config/env.js";

let tokenCache = {
  token: null,
  expiresAt: 0,
};

function parseExpiry(expiraEm) {
  if (!expiraEm) return 0;
  const timestamp = new Date(expiraEm).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function tokenAindaValido() {
  if (!tokenCache.token || !tokenCache.expiresAt) return false;
  return Date.now() < tokenCache.expiresAt - config.tokenExpirySafetyMs;
}

let requisicaoEmAndamento = null;

export async function gerarToken() {
  if (tokenAindaValido()) {
    return tokenCache.token;
  }

  if (requisicaoEmAndamento) {
    return requisicaoEmAndamento;
  }

  requisicaoEmAndamento = (async () => {
    try {
      const response = await axios.post(
        `${config.correiosBaseUrl}/token/v1/autentica/cartaopostagem`,
        {
          numero: config.usuarioMeusCorreios,
          contrato: config.contratoCorreios,
          dr: config.correiosDr,
        },
        {
          auth: {
            username: config.usuarioMeusCorreios,
            password: config.wsNovaApi,
          },
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: config.requestTimeoutMs,
        },
      );

      const token = response?.data?.token;
      const expiresAt = parseExpiry(response?.data?.expiraEm);

      if (!token) {
        throw new Error("Token dos Correios não retornado pela API");
      }

      tokenCache = {
        token,
        expiresAt,
      };

      return token;
    } finally {
      requisicaoEmAndamento = null;
    }
  })();

  return requisicaoEmAndamento;
}

export function limparCacheToken() {
  tokenCache = {
    token: null,
    expiresAt: 0,
  };
}
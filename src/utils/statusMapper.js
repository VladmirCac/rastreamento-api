const normalizarTexto = (texto) =>
  (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const contemAlgum = (texto, termos) =>
  termos.some((termo) => texto.includes(termo));

const TERMOS_RETIRADA = [
  "aguardando retirada",
  "disponivel para retirada",
  "encaminhado para retirada",
  "aguarda retirada",
  "retirada em unidade",
  "retirada",
  "retirar",
  "endereco indicado",
];

const TERMOS_TRIBUTADO = [
  "tributado",
  "aguardando pagamento",
  "pagamento do despacho postal",
  "fiscalizacao aduaneira",
  "taxa",
  "objeto sujeito a tributacao",
];

const TERMOS_TENTATIVA = [
  "tentativa de entrega",
  "destinatario ausente",
  "entrega nao realizada",
  "carteiro nao atendido",
  "logradouro com numeracao irregular",
  "mudou-se",
  "recusado",
  "cliente ausente",
  "nao procurado",
];

const TERMOS_DEVOLUCAO_EM_ANDAMENTO = [
  "devolucao autorizada",
  "em devolucao",
  "sera devolvido ao remetente",
  "sera devolvido",
  "retorno ao remetente",
  "encaminhado para devolucao",
];

const TERMOS_DEVOLVIDO = [
  "devolvido ao remetente",
  "entregue ao remetente",
  "objeto devolvido aos correios",
  "devolvido aos correios",
];

const TERMOS_ENDERECAMENTO = [
  "inconsistencias no enderecamento do objeto",
  "inconsistencia no enderecamento do objeto",
  "inconsistencia no endereco",
  "endereco insuficiente",
  "endereco incorreto",
  "numero inexistente",
  "enderecamento do objeto",
  "objeto nao entregue",
];

const TERMOS_ENTREGUE = [
  "objeto entregue ao destinatario",
  "objeto entregue com sucesso",
  "entregue ao destinatario",
];

const TERMOS_SAIU_PARA_ENTREGA = [
  "saiu para entrega",
  "rota de entrega",
  "em rota de entrega",
];

const TERMOS_POSTADO = [
  "objeto postado",
  "postado",
];

const TERMOS_TRANSITO = [
  "transito",
  "transferencia",
  "encaminhado",
  "em rota",
  "objeto em transferencia",
  "objeto encaminhado",
];

export function mapearStatus(evento) {
  if (!evento) return "Desconhecido";

  const codigo = (evento.codigo || "").toUpperCase().trim();
  const descricao = normalizarTexto(evento.descricao);
  const detalhe = normalizarTexto(evento.detalhe);
  const textoCompleto = `${descricao} ${detalhe}`.trim();

  if (contemAlgum(textoCompleto, TERMOS_RETIRADA)) {
    return "Retirada";
  }

  if (contemAlgum(textoCompleto, TERMOS_TRIBUTADO)) {
    return "Tributado";
  }

  if (contemAlgum(textoCompleto, TERMOS_TENTATIVA)) {
    return "Tentativa de entrega";
  }

  if (contemAlgum(textoCompleto, TERMOS_DEVOLUCAO_EM_ANDAMENTO)) {
    return "Em trânsito";
  }

  if (contemAlgum(textoCompleto, TERMOS_DEVOLVIDO)) {
    return "Devolvido";
  }

  if (contemAlgum(textoCompleto, TERMOS_ENDERECAMENTO)) {
    return "Desconhecido";
  }

  if (contemAlgum(textoCompleto, TERMOS_ENTREGUE)) {
    return "Entregue";
  }

  if (
    codigo === "OEC" ||
    contemAlgum(textoCompleto, TERMOS_SAIU_PARA_ENTREGA)
  ) {
    return "Saiu para entrega";
  }

  if (codigo === "PO" || contemAlgum(textoCompleto, TERMOS_POSTADO)) {
    return "Postado";
  }

  switch (codigo) {
    case "RO":
      return "Em trânsito";
    default:
      break;
  }

  if (contemAlgum(textoCompleto, TERMOS_TRANSITO)) {
    return "Em trânsito";
  }

  return "Desconhecido";
}

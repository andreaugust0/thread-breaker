'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');
const { WebSocketServer, WebSocket } = require('ws');

const orchestrators = require('./orchestrators');

const PORT = process.env.PORT || 3001;
const PUBLIC_DIR = path.join(__dirname, 'public');
const MAX_THREADS = os.cpus().length;
const MAX_TAMANHO_SENHA = 6;
const ALFABETO_PADRAO = 'abcdefghijklmnopqrstuvwxyz0123456789';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function servirArquivoEstatico(req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  const caminhoResolvido = path.normalize(path.join(PUBLIC_DIR, urlPath));
  if (!caminhoResolvido.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Proibido');
    return;
  }

  fs.readFile(caminhoResolvido, (err, conteudo) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Não encontrado');
      return;
    }
    const ext = path.extname(caminhoResolvido);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(conteudo);
  });
}

const server = http.createServer(servirArquivoEstatico);
const wss = new WebSocketServer({ server });

const clientes = new Set();
let execucaoAtual = null;

function broadcast(obj) {
  const data = JSON.stringify(obj);
  for (const cliente of clientes) {
    if (cliente.readyState === WebSocket.OPEN) {
      cliente.send(data);
    }
  }
}

function statusServidor() {
  return { tipo: 'status_servidor', ocupado: execucaoAtual !== null, maxThreads: MAX_THREADS };
}

function validarParametros(msg) {
  const estrategiasValidas = new Set(Object.keys(orchestrators));

  if (!estrategiasValidas.has(msg.estrategia)) {
    return 'Estratégia inválida.';
  }
  if (!Number.isInteger(msg.numThreads) || msg.numThreads < 1 || msg.numThreads > MAX_THREADS) {
    return `numThreads deve ser um inteiro entre 1 e ${MAX_THREADS}.`;
  }

  const alfabeto = typeof msg.alfabeto === 'string' && msg.alfabeto.length > 0 ? msg.alfabeto : ALFABETO_PADRAO;
  if (new Set(alfabeto).size < 2) {
    return 'O alfabeto deve ter pelo menos 2 caracteres distintos.';
  }

  const senhaAlvo = typeof msg.senhaAlvo === 'string' ? msg.senhaAlvo : '';
  if (senhaAlvo.length === 0) {
    return 'Informe a senha alvo.';
  }
  if (senhaAlvo.length > MAX_TAMANHO_SENHA) {
    return `A senha alvo deve ter no máximo ${MAX_TAMANHO_SENHA} caracteres nesta demonstração.`;
  }

  const alfabetoSet = new Set(alfabeto);
  if (![...senhaAlvo].every((c) => alfabetoSet.has(c))) {
    return 'A senha alvo contém caracteres fora do alfabeto escolhido.';
  }

  return null;
}

function iniciarExecucao(ws, msg) {
  if (execucaoAtual) {
    ws.send(JSON.stringify({ tipo: 'erro', mensagem: 'Já existe uma execução em andamento. Aguarde terminar ou cancele.' }));
    return;
  }

  const erro = validarParametros(msg);
  if (erro) {
    ws.send(JSON.stringify({ tipo: 'erro', mensagem: erro }));
    return;
  }

  const alfabeto = typeof msg.alfabeto === 'string' && msg.alfabeto.length > 0 ? msg.alfabeto : ALFABETO_PADRAO;
  const senhaAlvo = msg.senhaAlvo;
  const numThreads = msg.numThreads;
  const estrategia = msg.estrategia;
  const tamanhoMax = senhaAlvo.length;

  const emitter = new EventEmitter();

  emitter.on('iniciado', (payload) => {
    broadcast({ tipo: 'iniciado', estrategia, senhaAlvo, alfabeto, tamanhoMax, ...payload });
  });
  emitter.on('rodada', (payload) => broadcast({ tipo: 'rodada', ...payload }));
  emitter.on('progresso', (payload) => broadcast({ tipo: 'progresso', ...payload }));
  emitter.on('thread_estado', (payload) => broadcast({ tipo: 'thread_estado', ...payload }));
  emitter.on('erro_worker', (payload) => broadcast({ tipo: 'erro_worker', ...payload }));
  emitter.on('concluido', (payload) => {
    broadcast({ tipo: 'concluido', ...payload });
    execucaoAtual = null;
    broadcast(statusServidor());
  });

  const { cancelar } = orchestrators[estrategia].iniciar(
    { senhaAlvo, alfabeto, tamanhoMax, numThreads },
    emitter
  );

  execucaoAtual = { cancelar };
  broadcast(statusServidor());
}

function cancelarExecucao() {
  if (execucaoAtual) {
    execucaoAtual.cancelar();
  }
}

wss.on('connection', (ws) => {
  clientes.add(ws);
  ws.send(JSON.stringify(statusServidor()));

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      ws.send(JSON.stringify({ tipo: 'erro', mensagem: 'Mensagem inválida.' }));
      return;
    }

    if (msg.tipo === 'iniciar') {
      iniciarExecucao(ws, msg);
    } else if (msg.tipo === 'cancelar') {
      cancelarExecucao();
    }
  });

  ws.on('close', () => {
    clientes.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`Thread Breaker web rodando em http://localhost:${PORT}`);
});

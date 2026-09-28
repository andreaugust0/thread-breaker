(function () {
  'use strict';

  const AVISOS = {
    single: 'Sem múltiplas threads — a barra mostra o progresso de uma única execução sequencial.',
    static: 'Cada thread reporta progresso fino a cada 50 mil tentativas.',
    dynamic: 'As threads pedem blocos de 100 mil tentativas por vez — o progresso aparece em degraus, conforme cada bloco termina.',
    shared: 'Cada thread só reporta uma vez, ao terminar sua fatia.',
  };

  const TEXTO_ESTADO = {
    aguardando: 'aguardando',
    rodando: 'rodando',
    encontrou: 'encontrou!',
    esgotada: 'concluída',
    interrompida: 'interrompida',
  };

  const form = document.getElementById('form-config');
  const campoSenha = document.getElementById('senha');
  const campoThreads = document.getElementById('threads');
  const campoEstrategia = document.getElementById('estrategia');
  const campoAlfabeto = document.getElementById('alfabeto');
  const avisoEstrategia = document.getElementById('aviso-estrategia');
  const btnIniciar = document.getElementById('btn-iniciar');
  const btnCancelar = document.getElementById('btn-cancelar');
  const statusServidorEl = document.getElementById('status-servidor');
  const gridThreads = document.getElementById('grid-threads');
  const painelResultado = document.getElementById('painel-resultado');
  const statsResultado = document.getElementById('stats-resultado');

  function atualizarAviso() {
    avisoEstrategia.textContent = AVISOS[campoEstrategia.value] || '';
  }
  campoEstrategia.addEventListener('change', atualizarAviso);
  atualizarAviso();

  let graficoBarras = null;
  let graficoLinha = null;
  let tempoInicio = null;
  let threadsAtuais = [];

  function criarGraficos() {
    const ctxBarras = document.getElementById('grafico-barras').getContext('2d');
    const ctxLinha = document.getElementById('grafico-linha').getContext('2d');

    graficoBarras = new Chart(ctxBarras, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [{ label: 'Tentativas', data: [], backgroundColor: '#5b8def', borderRadius: 4 }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          y: { beginAtZero: true, ticks: { color: '#9aa1ad' }, grid: { color: '#272c37' } },
          x: { ticks: { color: '#9aa1ad' }, grid: { display: false } },
        },
        plugins: { legend: { display: false } },
      },
    });

    graficoLinha = new Chart(ctxLinha, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: 'Tentativas totais',
          data: [],
          borderColor: '#e0a458',
          backgroundColor: 'rgba(224,164,88,0.15)',
          fill: true,
          tension: 0.2,
          pointRadius: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          y: { beginAtZero: true, ticks: { color: '#9aa1ad' }, grid: { color: '#272c37' } },
          x: { ticks: { color: '#9aa1ad' }, grid: { display: false } },
        },
        plugins: { legend: { display: false } },
      },
    });
  }

  function montarThreadCards(workers) {
    gridThreads.innerHTML = '';
    threadsAtuais = workers.map((w) => w.workerId);

    for (const workerId of threadsAtuais) {
      const card = document.createElement('div');
      card.className = 'card-thread';
      card.id = `thread-${workerId}`;
      card.innerHTML = `
        <div class="card-thread-topo">
          <span class="card-thread-nome">Thread ${workerId}</span>
          <span class="badge" data-estado="aguardando">aguardando</span>
        </div>
        <div class="card-thread-tentativas">0 tentativas</div>
      `;
      gridThreads.appendChild(card);
    }

    graficoBarras.data.labels = threadsAtuais.map((id) => `T${id}`);
    graficoBarras.data.datasets[0].data = threadsAtuais.map(() => 0);
    graficoBarras.update();

    graficoLinha.data.labels = [];
    graficoLinha.data.datasets[0].data = [];
    graficoLinha.update();
  }

  function atualizarThreadEstado(workerId, estado, tentativas) {
    const card = document.getElementById(`thread-${workerId}`);
    if (!card) return;
    const badge = card.querySelector('.badge');
    badge.dataset.estado = estado;
    badge.textContent = TEXTO_ESTADO[estado] || estado;
    if (typeof tentativas === 'number') {
      card.querySelector('.card-thread-tentativas').textContent =
        `${tentativas.toLocaleString('pt-BR')} tentativas`;
    }
  }

  function atualizarBarraThread(workerId, tentativas) {
    const idx = threadsAtuais.indexOf(workerId);
    if (idx === -1 || !graficoBarras) return;
    graficoBarras.data.datasets[0].data[idx] = tentativas;
    graficoBarras.update('none');

    const card = document.getElementById(`thread-${workerId}`);
    if (card) {
      card.querySelector('.card-thread-tentativas').textContent =
        `${tentativas.toLocaleString('pt-BR')} tentativas`;
    }
  }

  function registrarPontoLinha(tentativasTotais) {
    if (!graficoLinha || tempoInicio === null) return;
    const segundos = ((Date.now() - tempoInicio) / 1000).toFixed(1);
    graficoLinha.data.labels.push(`${segundos}s`);
    graficoLinha.data.datasets[0].data.push(tentativasTotais);
    graficoLinha.update('none');
  }

  function definirOcupado(ocupado) {
    btnIniciar.disabled = ocupado;
    btnCancelar.disabled = !ocupado;
    campoSenha.disabled = ocupado;
    campoThreads.disabled = ocupado;
    campoEstrategia.disabled = ocupado;
    campoAlfabeto.disabled = ocupado;
  }

  let ws;
  function conectar() {
    const protocolo = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(`${protocolo}://${location.host}`);

    ws.addEventListener('open', () => {
      statusServidorEl.textContent = 'Conectado.';
    });

    ws.addEventListener('close', () => {
      statusServidorEl.textContent = 'Desconectado. Tentando reconectar...';
      setTimeout(conectar, 2000);
    });

    ws.addEventListener('error', () => {
      ws.close();
    });

    ws.addEventListener('message', (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      tratarMensagem(msg);
    });
  }

  function tratarMensagem(msg) {
    switch (msg.tipo) {
      case 'status_servidor':
        campoThreads.max = msg.maxThreads;
        definirOcupado(msg.ocupado);
        if (!msg.ocupado) {
          statusServidorEl.textContent = `Pronto. Até ${msg.maxThreads} threads disponíveis.`;
        }
        break;

      case 'erro':
        statusServidorEl.textContent = `Erro: ${msg.mensagem}`;
        break;

      case 'iniciado':
        painelResultado.hidden = true;
        tempoInicio = Date.now();
        montarThreadCards(msg.workers);
        statusServidorEl.textContent =
          `Rodando "${msg.estrategia}" com ${msg.numThreads} thread(s) — buscando "${msg.senhaAlvo}"...`;
        break;

      case 'rodada':
        statusServidorEl.textContent =
          `Testando senhas de comprimento ${msg.comprimento} (${msg.totalRodada.toLocaleString('pt-BR')} combinações)...`;
        break;

      case 'progresso':
        atualizarBarraThread(msg.workerId, msg.tentativas);
        registrarPontoLinha(msg.tentativasTotais);
        break;

      case 'thread_estado':
        atualizarThreadEstado(msg.workerId, msg.estado, msg.tentativas);
        if (typeof msg.tentativas === 'number') {
          atualizarBarraThread(msg.workerId, msg.tentativas);
        }
        break;

      case 'concluido':
        mostrarResultado(msg);
        break;

      case 'erro_worker':
        statusServidorEl.textContent = `Erro em uma thread: ${msg.mensagem}`;
        break;

      default:
        break;
    }
  }

  function mostrarResultado(msg) {
    painelResultado.hidden = false;
    const encontrada = msg.encontrada
      ? `<span class="ok">"${msg.encontrada}"</span>`
      : '<span class="falha">não encontrada</span>';
    statsResultado.innerHTML = `
      <div class="stat"><span class="stat-label">Senha</span><span class="stat-valor">${encontrada}</span></div>
      <div class="stat"><span class="stat-label">Tempo</span><span class="stat-valor">${msg.tempoMs.toLocaleString('pt-BR')} ms</span></div>
      <div class="stat"><span class="stat-label">Tentativas</span><span class="stat-valor">${msg.tentativas.toLocaleString('pt-BR')}</span></div>
      ${msg.cancelado ? '<div class="stat"><span class="stat-label">Status</span><span class="stat-valor">cancelado</span></div>' : ''}
    `;
    statusServidorEl.textContent = msg.cancelado ? 'Cancelado.' : 'Concluído.';
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    ws.send(JSON.stringify({
      tipo: 'iniciar',
      senhaAlvo: campoSenha.value.trim(),
      numThreads: Number(campoThreads.value),
      estrategia: campoEstrategia.value,
      alfabeto: campoAlfabeto.value.trim(),
    }));
  });

  btnCancelar.addEventListener('click', () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ tipo: 'cancelar' }));
    }
  });

  criarGraficos();
  conectar();
})();

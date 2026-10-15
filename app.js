(() => {
  'use strict';
  const config = window.MOONPHASE_CONFIG || {};
  const ready = /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(config.endpoint || '');
  const $ = id => document.getElementById(id);
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), x => x.toString(16).padStart(2, '0')).join('');
  let visitId = uuid();
  let preference = null;
  try { preference = localStorage.getItem('moonphase-measurement-v1'); } catch (_) { /* Navegação sem armazenamento permanece funcional. */ }
  let measured = preference === 'yes';
  let pendingSubmission = null;
  let submitting = false;
  const form = $('interest-form');
  const message = $('form-message');
  const banner = $('analytics-banner');
  const viewport = () => innerWidth < 700 ? 'celular' : innerWidth < 1100 ? 'tablet' : 'desktop';

  async function send(payload) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    try {
      // text/plain avoids a CORS preflight; retain CORS so the receipt can be verified.
      const response = await fetch(config.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload), redirect: 'follow', credentials: 'omit',
        signal: controller.signal, keepalive: payload.kind === 'event'
      });
      if (!response.ok) throw new Error('HTTP');
      const receipt = await response.json();
      if (receipt.ok !== true || receipt.requestId !== payload.requestId) throw new Error('No receipt');
      return receipt;
    } finally { clearTimeout(timeout); }
  }

  function track(event) {
    if (!ready || !measured) return;
    void send({ kind: 'event', requestId: uuid(), visitId, event, viewport: viewport(), analyticsConsent: true, version: '2026-10-14' }).catch(() => {});
  }
  document.addEventListener('click', event => {
    const element = event.target.closest('[data-track]');
    if (element) track(element.dataset.track);
  });
  function setPreference(allow) {
    const wasMeasured = measured;
    measured = allow;
    try { localStorage.setItem('moonphase-measurement-v1', allow ? 'yes' : 'no'); } catch (_) {}
    banner.hidden = true;
    if (!allow) visitId = uuid();
    if (allow && !wasMeasured) track('visita');
  }
  $('analytics-accept').addEventListener('click', () => setPreference(true));
  $('analytics-decline').addEventListener('click', () => setPreference(false));
  banner.hidden = !ready || preference !== null;
  if (ready) {
    track('visita');
  } else {
    message.textContent = 'Os cadastros ainda não estão abertos. Você pode explorar o formulário, mas nenhum dado será enviado nesta prévia.';
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || !form.reportValidity()) return;
    if (!ready) { message.textContent = 'Cadastro ainda não disponível. Nenhum dado foi enviado. Volte quando as inscrições estiverem abertas.'; return; }
    const fields = new FormData(form);
    if (fields.get('website')) { message.textContent = 'Não foi possível enviar. Verifique os campos e tente novamente.'; return; }
    const data = {
      name: fields.get('name').trim(), email: fields.get('email').trim(),
      profile: fields.get('profile'), motivation: fields.get('motivation'),
      suggestion: fields.get('suggestion').trim(), consent: fields.get('consent') === 'on', website: ''
    };
    if (!data.name) { $('name').setCustomValidity('Informe seu nome.'); $('name').reportValidity(); return; }
    // Reuse the request ID after a timeout so a retry cannot duplicate a saved row.
    const signature = JSON.stringify(data);
    if (!pendingSubmission || pendingSubmission.signature !== signature) pendingSubmission = { signature, requestId: uuid() };
    submitting = true;
    $('submit-button').disabled = true;
    form.setAttribute('aria-busy', 'true');
    message.textContent = 'Enviando seu interesse…';
    try {
      await send({ kind: 'lead', requestId: pendingSubmission.requestId, ...data, visitId: measured ? visitId : '', analyticsConsent: measured, version: '2026-10-14' });
      form.reset(); pendingSubmission = null; message.textContent = '';
      form.hidden = true; $('success').hidden = false; $('success').focus();
    } catch (_) {
      message.textContent = 'Não foi possível confirmar o envio. Seus campos foram mantidos. Verifique sua conexão e tente novamente; uma nova tentativa com os mesmos dados não duplica o cadastro.';
    } finally {
      submitting = false; $('submit-button').disabled = false; form.removeAttribute('aria-busy');
    }
  });
  $('name').addEventListener('input', () => $('name').setCustomValidity(''));
  $('reset').addEventListener('click', () => { $('success').hidden = true; form.hidden = false; $('name').focus(); });
  $('professional-link').addEventListener('click', () => { $('profile').value = 'especialista'; $('motivation').value = 'pacientes'; });

  const views = {
    overview: ['assets/Web1.png', 'Interface médica: visão geral', 'Visão geral do painel médico: pacientes, agenda do dia e gráficos de registros', 'Pacientes, agenda e registros em uma visão integrada.'],
    report: ['assets/Web2.png', 'Interface médica: relatório da paciente', 'Relatório individual com cadastro da paciente, notas da consulta e gráfico de sintomas relatados', 'O histórico relatado pela paciente, com espaço para as notas da consulta.']
  };
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
    const [src, title, alt, caption] = views[button.dataset.view];
    $('doctor-image').src = src; $('doctor-image').alt = alt;
    $('doctor-screen').dataset.image = src; $('doctor-screen').dataset.title = title;
    $('doctor-caption').textContent = caption;
    document.querySelectorAll('[data-view]').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button)); });
  }));
  const dialog = $('image-dialog');
  let lastTrigger;
  document.querySelectorAll('[data-image]').forEach(button => button.addEventListener('click', () => {
    lastTrigger = button;
    $('expanded-image').src = button.dataset.image;
    $('expanded-image').alt = button.querySelector('img').alt;
    $('image-title').textContent = button.dataset.title;
    dialog.classList.toggle('mobile-image', button.dataset.image.includes('Tela'));
    dialog.showModal(); dialog.scrollTop = 0;
    document.body.style.overflow = 'hidden';
  }));
  $('close-dialog').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog && event.clientX < dialog.getBoundingClientRect().left) dialog.close(); });
  dialog.addEventListener('close', () => { document.body.style.overflow = ''; lastTrigger?.focus(); });
})();

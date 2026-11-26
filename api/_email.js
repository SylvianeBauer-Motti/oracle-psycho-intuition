// api/_email.js
// Envoi d'emails transactionnels via l'API Brevo — même mécanisme que Psycho-Assistant
// (voir biais-cognitifs-db/psycho-assistant/api/_email.js), adapté ici pour l'oracle
// quotidien. Projet Vercel séparé : ses propres variables d'environnement à configurer
// (BREVO_API_KEY notamment — ne réutilise pas celle de Psycho-Assistant, chaque projet a
// les siennes).
// Ce fichier commence par "_" : Vercel ne le traite donc pas comme une route/API publique.

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'contact@psycho-intuition.fr';
const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Les Oracles Psycho-Intuition';
const REPLY_TO_EMAIL = process.env.BREVO_REPLY_TO_EMAIL || 'sylvianebm@gmail.com';

// Renvoie systématiquement { ok, reason? } — jamais juste "on log et on continue" : l'appelant
// (send-daily-oracle.js) a besoin de savoir si l'email est vraiment parti pour ne marquer un
// abonné comme "notifié aujourd'hui" qu'en cas de succès réel.
async function sendEmail({ to, subject, html }) {
  if (!BREVO_API_KEY) {
    console.log('[email] BREVO_API_KEY manquante, envoi ignoré');
    return { ok: false, reason: 'missing_api_key' };
  }
  if (!to) {
    console.log('[email] destinataire manquant, envoi ignoré');
    return { ok: false, reason: 'missing_recipient' };
  }

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: to }],
        replyTo: { email: REPLY_TO_EMAIL },
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.log('[email] échec envoi Brevo:', res.status, text);
      return { ok: false, reason: 'brevo_status_' + res.status };
    }
    return { ok: true };
  } catch (err) {
    console.log('[email] erreur envoi Brevo:', err.message);
    return { ok: false, reason: 'exception: ' + err.message };
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Carte HTML simple (pas de JS, pas de flip — ce n'est qu'un email) pour une fiche biais ou
// technique du jour. Les couleurs reprennent exactement celles de la page web (index.html,
// règles #oracle-biais/#oracle-techniques sur .oracle-prompt et .mantra) : bleu pour les
// biais, saumon pour les techniques — jamais le fond jaune/brun générique d'avant.
const KIND_STYLE = {
  biais: {
    accent: '#0057a3',
    tagColor: '#8a8a8a',
    promptColor: '#0d3a5c',
    promptBg: '#eaf2fa',
    promptBorder: '#0070C0',
    mantraColor: '#0057a3',
  },
  techniques: {
    accent: '#C77B6F',
    tagColor: '#8a8a8a',
    promptColor: '#6b2b24',
    promptBg: '#fbe9e6',
    promptBorder: '#c4574a',
    mantraColor: '#8a3b32',
  },
};

function ficheEmailBlock({ e, kind }) {
  const style = KIND_STYLE[kind];
  const title = escapeHtml(e.title || '');
  const tag = escapeHtml(kind === 'biais' ? (e.type || '') : (e.category || ''));
  const num = e.num ? `Fiche #${kind === 'biais' ? 'BFC' : 'OPP'}${e.num}#` : '';
  const short = escapeHtml((e.oracle_version || e.definition || e.principe || '').split(/À\s*(?:observer|essayer)\s*aujourd['’]hui\s*:/)[0].trim());
  const promptMatch = (e.oracle_version || '').match(/À\s*(?:observer|essayer)\s*aujourd['’]hui\s*:\s*([\s\S]*)$/);
  const prompt = promptMatch ? escapeHtml(promptMatch[1].trim()) : '';
  const mantra = escapeHtml(e.mantra || '');
  return `
    <div style="border:1px solid #e4ddcb; border-radius:14px; padding:20px 22px; margin:0 0 20px;">
      ${tag ? `<div style="font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:${style.tagColor}; background:#eee7d8; display:inline-block; padding:3px 9px; border-radius:100px; margin-bottom:8px;">${tag}</div>` : ''}
      <h2 style="font-family:Georgia,'Times New Roman',serif; font-size:19px; font-weight:700; color:${style.accent}; margin:6px 0 2px;">${title}</h2>
      ${num ? `<div style="font-size:10px; color:#b5ada0; margin-bottom:10px;">${num}</div>` : ''}
      <p style="font-size:14px; line-height:1.6; color:#333; font-style:italic; margin:0 0 12px;">${short}</p>
      ${prompt ? `<div style="font-size:14px; line-height:1.6; color:${style.promptColor}; background:${style.promptBg}; border-left:3px solid ${style.promptBorder}; border-radius:6px; padding:12px 14px;">${prompt}</div>` : ''}
      ${mantra ? `<div style="margin-top:16px; text-align:center; font-family:Georgia,'Times New Roman',serif; font-style:italic; font-size:19px; color:${style.mantraColor}; padding:12px 8px; border-top:1px solid #e4ddcb; border-bottom:1px solid #e4ddcb;">«&#8239;${mantra}&#8239;»</div>` : ''}
    </div>
  `;
}

function dailyOracleEmailHtml({ biaisEntry, techEntry, unsubscribeUrl }) {
  return `
    <div style="font-family: -apple-system, sans-serif; max-width: 520px; margin: 0 auto; color: #2c2c2c;">
      <h1 style="color: #2a7f7e; font-size: 22px; text-align:center; margin:0 0 20px;">Le biais cognitif du jour</h1>
      ${ficheEmailBlock({ e: biaisEntry, kind: 'biais' })}
      <h1 style="color: #2a7f7e; font-size: 22px; text-align:center; margin:0 0 20px;">Et la technique proposée pour y travailler</h1>
      ${ficheEmailBlock({ e: techEntry, kind: 'techniques' })}
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0; max-width:480px;">
        <tr>
          <td style="vertical-align:top; font-size:14px; line-height:1.6; color:#2c2c2c; padding-right:16px;">
            Une fois les deux cartes tirées, prends le temps de les relier&#160;: qu'est-ce que ce <b style="color:#2a9ba8;">biais</b> et cet <b style="color:#b5574a;">outil</b>, mis ensemble, te disent de ce que tu vis en ce moment&#160;? Laisse-toi un instant pour méditer là-dessus avant de passer à la suite.
          </td>
          <td style="width:110px; vertical-align:top;">
            <img src="https://oracle.psycho-intuition.fr/assets/personnage-clin-doeil.png" width="94" alt="" style="display:block; width:94px; height:auto;">
          </td>
        </tr>
      </table>
      <p style="font-size: 13px; color: #c9a24b; text-align:center; margin-top:28px;">
        Envie d'aller plus loin ? Retrouve les fiches complètes dans <a href="https://psycho-intuition.fr/psycho-assistant/" style="color:#b5934a; font-weight:700;"><b>Psycho-Assistant</b></a>.
      </p>
      <p style="font-size: 11px; color: #999; text-align:center; margin-top:30px;">
        Tu reçois cet email car tu t'es inscrit·e à l'oracle quotidien.
        <a href="${unsubscribeUrl}" style="color:#999;">Se désinscrire</a>
      </p>
    </div>
  `;
}

module.exports = { sendEmail, dailyOracleEmailHtml, escapeHtml };

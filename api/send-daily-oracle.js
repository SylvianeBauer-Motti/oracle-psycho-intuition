// api/send-daily-oracle.js
// Envoie à chaque abonné·e la carte de biais ET la carte de technique "du jour" — LA MÊME
// pour tout le monde le jour donné (c'est le sens usuel d'un "oracle du jour" ; choix fait
// faute de précision de Sylviane sur ce point, facile à changer si elle préfère un tirage
// différent par abonné·e : il suffirait d'ajouter l'email dans le seed ci-dessous).
//
// Pas de Vercel Cron natif ici (même raison que _renewal_reminder_logic.js côté
// Psycho-Assistant : limite de fonctions du plan Hobby, et éviter la dépendance à Vercel
// Cron) : ce endpoint est protégé par CRON_SECRET et doit être appelé une fois par jour par
// un service de cron externe (ex. cron-job.org, gratuit) — voir le README pour la marche à
// suivre.
//
// Idempotence : PAS mise en place ici (contrairement au rappel de renouvellement) — un appel
// en double le même jour renverrait deux fois le même email à chacun·e, puisque le tirage est
// déterministe par date. Le service de cron externe doit donc être configuré pour un seul
// appel par jour, pas une retentative automatique en cas de succès HTTP 200.

const biais = require('./_oracle_biais.json');
const techniques = require('./_oracle_techniques.json');
const { listAllSubscribers, unsubscribeToken } = require('./_db');
const { sendEmail, dailyOracleEmailHtml } = require('./_email');

function todayUtcString() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// Hash simple et stable (pas cryptographique, pas besoin ici) pour transformer la date du
// jour en index de tableau — la même date donne toujours le même index.
function seededIndex(seed, length) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

module.exports = async function handler(req, res) {
  const expectedSecret = process.env.CRON_SECRET;
  const authHeader = req.headers['authorization'] || '';
  // Comparaison insensible à la casse sur "Bearer" et tolérante aux espaces/retours à la ligne
  // parasites qu'un copier-coller depuis Vercel peut introduire en fin de valeur.
  const match = /^bearer\s+(.+?)\s*$/i.exec(authHeader);
  if (!expectedSecret || !match || match[1].trim() !== expectedSecret.trim()) {
    return res.status(401).json({ error: 'Non autorisé' });
  }

  const today = todayUtcString();
  const biaisEntry = biais[seededIndex(today + '|biais', biais.length)];
  const techEntry = techniques[seededIndex(today + '|techniques', techniques.length)];

  const subscribers = await listAllSubscribers();
  let sent = 0;
  let failed = 0;

  for (const { email, firstName } of subscribers) {
    const unsubscribeUrl = `https://${req.headers.host}/api/unsubscribe?email=${encodeURIComponent(email)}&token=${unsubscribeToken(email)}`;
    const result = await sendEmail({
      to: email,
      subject: "L'Oracle Psycho-Cognitif du jour",
      html: dailyOracleEmailHtml({ biaisEntry, techEntry, unsubscribeUrl, firstName }),
    });
    if (result.ok) sent++; else failed++;
  }

  return res.status(200).json({ ok: true, date: today, subscribers: subscribers.length, sent, failed });
};

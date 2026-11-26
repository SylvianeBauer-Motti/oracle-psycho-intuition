// api/_db.js
// Petite couche d'accès à la base (Upstash Redis, via l'intégration "Storage" de Vercel) —
// même mécanisme que Psycho-Assistant (voir biais-cognitifs-db/psycho-assistant/api/_db.js),
// adapté ici pour la seule liste d'inscrit·es à l'oracle quotidien par email. Projet Vercel
// séparé : sa propre intégration Upstash à connecter (KV_REST_API_URL, KV_REST_API_TOKEN),
// ne réutilise pas celle de Psycho-Assistant.
// Ce fichier commence par "_" : Vercel ne le traite donc pas comme une route/API publique.
//
// RGPD a minima : on ne stocke que l'email, un prénom facultatif et la date d'inscription,
// rien d'autre.

const crypto = require('crypto');
const { Redis } = require('@upstash/redis');

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const SUBSCRIBER_PREFIX = 'oracle_subscriber:'; // oracle_subscriber:<email en minuscules> -> { email, firstName, subscribedAt }
const ALL_SUBSCRIBERS_SET = 'oracle_all_subscribers'; // set listant tous les emails inscrits

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function addSubscriber(email, firstName) {
  const key = normalizeEmail(email);
  if (!key) throw new Error('email manquant');
  const name = String(firstName || '').trim().slice(0, 60) || null;
  await redis.set(SUBSCRIBER_PREFIX + key, { email: key, firstName: name, subscribedAt: Date.now() });
  await redis.sadd(ALL_SUBSCRIBERS_SET, key);
}

async function removeSubscriber(email) {
  const key = normalizeEmail(email);
  if (!key) return;
  await redis.del(SUBSCRIBER_PREFIX + key);
  await redis.srem(ALL_SUBSCRIBERS_SET, key);
}

async function isSubscribed(email) {
  const key = normalizeEmail(email);
  if (!key) return false;
  const existing = await redis.get(SUBSCRIBER_PREFIX + key);
  return !!existing;
}

// Renvoie [{ email, firstName }] pour chaque inscrit·e (firstName peut être null — champ
// facultatif, et les inscriptions faites avant son ajout n'en ont pas).
async function listAllSubscribers() {
  const emails = await redis.smembers(ALL_SUBSCRIBERS_SET);
  if (!emails || !emails.length) return [];
  const records = await redis.mget(...emails.map((e) => SUBSCRIBER_PREFIX + e));
  return emails.map((email, i) => ({ email, firstName: (records[i] && records[i].firstName) || null }));
}

// Jeton de désinscription : un simple HMAC de l'email, pour qu'un lien de désinscription
// dans un email ne demande aucun mot de passe tout en empêchant qu'un tiers désinscrive
// quelqu'un d'autre au hasard (il faudrait déjà connaître l'email ET ce secret serveur).
const UNSUB_SECRET = process.env.UNSUB_SECRET || 'change-moi';

function unsubscribeToken(email) {
  return crypto.createHmac('sha256', UNSUB_SECRET).update(normalizeEmail(email)).digest('hex');
}

function verifyUnsubscribeToken(email, token) {
  if (!email || !token) return false;
  const expected = unsubscribeToken(email);
  // Comparaison à temps constant : évite qu'un tiers devine le jeton par les micro-différences
  // de temps de réponse d'une comparaison naïve (===) caractère par caractère.
  const a = Buffer.from(expected);
  const b = Buffer.from(String(token));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = {
  addSubscriber, removeSubscriber, isSubscribed, listAllSubscribers, normalizeEmail,
  unsubscribeToken, verifyUnsubscribeToken,
};

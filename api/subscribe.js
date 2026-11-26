// api/subscribe.js
// Inscription (facultative, gratuite) à l'oracle quotidien par email. Ne stocke que
// l'email, un prénom facultatif et la date d'inscription (voir _db.js) — rien d'autre
// n'est collecté.

const { addSubscriber, normalizeEmail } = require('./_db');

// Validation volontairement simple : on ne cherche pas à être exhaustif sur la RFC email,
// juste à écarter les saisies manifestement invalides avant d'écrire en base.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const email = normalizeEmail((req.body || {}).email);
  const firstName = (req.body || {}).firstName;
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Adresse email invalide' });
  }

  try {
    await addSubscriber(email, firstName);
    return res.status(200).json({ message: "Inscription confirmée — tu recevras l'oracle du jour par email dès demain !" });
  } catch (err) {
    console.log('[subscribe] erreur:', err.message);
    return res.status(500).json({ error: "Inscription impossible pour l'instant, réessaie plus tard" });
  }
};

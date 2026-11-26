// api/unsubscribe.js
// Lien de désinscription cliqué depuis un email : pas de mot de passe, juste le jeton
// généré par _db.js (HMAC de l'email) qui empêche un tiers de désinscrire quelqu'un
// d'autre au hasard. Répond en HTML simple (c'est un navigateur qui ouvre ce lien,
// pas un appel fetch côté page).

const { removeSubscriber, verifyUnsubscribeToken } = require('./_db');

function page(message) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
    <title>Les Oracles Psycho-Intuition</title>
    <style>body{font-family:-apple-system,sans-serif;background:#0d1220;color:#eef0f5;
      display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;}
      .box{max-width:420px;text-align:center;}
      a{color:#40AABE;}</style></head>
    <body><div class="box"><p>${message}</p><p><a href="/">Retour aux Oracles</a></p></div></body></html>`;
}

module.exports = async function handler(req, res) {
  const { email, token } = req.query || {};
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!email || !token || !verifyUnsubscribeToken(email, token)) {
    return res.status(400).send(page('Lien de désinscription invalide.'));
  }

  try {
    await removeSubscriber(email);
    return res.status(200).send(page("Tu ne recevras plus l'oracle quotidien par email. À bientôt peut-être !"));
  } catch (err) {
    console.log('[unsubscribe] erreur:', err.message);
    return res.status(500).send(page("Désinscription impossible pour l'instant, réessaie plus tard."));
  }
};

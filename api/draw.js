// api/draw.js
// Le tirage reste côté serveur. Seuls les champs affichés sont renvoyés au navigateur.

const biais = require('./_oracle_biais.json');
const techniques = require('./_oracle_techniques.json');

function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}

module.exports = async function handler(req, res) {
  const kind = (req.query && req.query.kind) || '';
  const list = kind === 'biais' ? biais : kind === 'techniques' ? techniques : null;
  if (!list) {
    return res.status(400).json({ error: "Paramètre 'kind' invalide (attendu : 'biais' ou 'techniques')" });
  }
  const card = pickRandom(list);
  const { num, title, oracle_version, mantra } = card;
  const entry = { num, title, oracle_version, mantra };

  if (kind === 'biais') {
    entry.type = card.type;
    if (!oracle_version) entry.definition = card.definition;
  } else {
    entry.category = card.category;
    if (!oracle_version) entry.principe = card.principe;
  }

  return res.status(200).json({ entry });
};

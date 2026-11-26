// api/draw.js
// Tire une carte au hasard côté serveur et ne renvoie QUE cette carte — jamais la base
// complète (312 biais + 216 techniques), qui reste privée dans _oracle_biais.json /
// _oracle_techniques.json (préfixés "_", jamais servis par Vercel comme fichier public).
// Tirage gratuit, sans compte, sans limite : identique au comportement précédent, juste
// déplacé côté serveur pour que le navigateur ne reçoive jamais la base entière.

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
  return res.status(200).json({ entry: pickRandom(list) });
};

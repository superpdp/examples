/*
Démarrage rapide avec SUPER PDP
Envoi d'une facture électronique d'un vendeur à un acheteur

Prérequis :

- Se créer un compte gratuit sur <https://www.superpdp.tech>
- Avoir installé nodejs sur sa machine

Commande pour lancer le script :

node quick_start.js

Ce script effectue les actions suivantes :

1. Obtention d'un token oauth2 pour le vendeur
2. Obtention d'un token oauth2 pour l'acheteur
3. Affichage de la dénomination sociale du vendeur
4. Téléchargement d'une facture de test côté vendeur
5. Validation de la facture côté vendeur
6. Envoi de la facture côté vendeur
7. Attente et affichage de la facture reçue côté acheteur
*/

// Configuration à compléter avec identifiants des applications oauth créées sur SUPER PDP
let config = {
  endpoint: process.env.SUPERPDP_ENDPOINT || "https://api.superpdp.tech",
  seller_client_id: process.env.SUPERPDP_BURGERQUEEN_CLIENT_ID,
  seller_client_secret: process.env.SUPERPDP_BURGERQUEEN_CLIENT_SECRET,
  buyer_client_id: process.env.SUPERPDP_TRICATEL_CLIENT_ID,
  buyer_client_secret: process.env.SUPERPDP_TRICATEL_CLIENT_SECRET,
}

// Obtention d'un access token oauth2 pour les appels à l'API du vendeur
const seller_token = await fetch(`${config.endpoint}/oauth2/token`, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.seller_client_id,
    client_secret: config.seller_client_secret,
  }).toString(),
})
  .then((resp) => {
    if (resp.status !== 200) {
      throw new Error(`http ${resp.status}`)
    }
    return resp.json()
  })
  .then((body) => body.access_token)

// Headers HTTP que nous allons réutiliser dans les appels à l'API pour s'authentifier en tant que vendeur
const seller_headers = {
  Authorization: `Bearer ${seller_token}`,
}

console.log("Token oauth2 vendeur obtenu")

// Obtention d'un token oauth2 pour les appels à l'API de l'acheteur
const buyer_token = await fetch(`${config.endpoint}/oauth2/token`, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.buyer_client_id,
    client_secret: config.buyer_client_secret,
  }).toString(),
})
  .then((resp) => {
    if (resp.status !== 200) {
      throw new Error(`http ${resp.status}`)
    }
    return resp.json()
  })
  .then((body) => body.access_token)

// Headers HTTP que nous allons réutiliser dans les appels à l'API pour s'authentifier en tant que vendeur
const buyer_headers = {
  Authorization: `Bearer ${buyer_token}`,
}

console.log("Token oauth2 acheteur obtenu")

// Vérification du nom de l'entreprise associée au token vendeur
const seller_company = await fetch(`${config.endpoint}/v1.beta/companies/me`, {
  headers: seller_headers,
}).then((resp) => {
  if (resp.status !== 200) {
    throw new Error(`http ${resp.status}`)
  }
  return resp.json()
})

console.log(`Dénomination du vendeur : ${seller_company.formal_name}`)

// Téléchargement d'une facture de test qui est prête à être envoyée du vendeur à l'acheteur
const seller_invoice = await fetch(
  `${config.endpoint}/v1.beta/invoices/generate_test_invoice?format=ubl`,
  {
    headers: seller_headers,
  },
).then((resp) => {
  if (resp.status !== 200) {
    throw new Error(`http ${resp.status}`)
  }
  return resp.text()
})

console.log("Facture de test téléchargée")

// Validation de la facture
let form_data = new FormData()
form_data.append("file", seller_invoice)
const validation_report = await fetch(
  `${config.endpoint}/v1.beta/validation_reports`,
  {
    method: "POST",
    body: form_data,
  },
).then((resp) => {
  if (resp.status !== 200) {
    throw new Error(`http ${resp.status}`)
  }
  return resp.json()
})

console.log(`Résultat de la validation : ${validation_report.data[0].is_valid}`)

// Sauvegarde du dernier id de facture acheteur
const list = await fetch(`${config.endpoint}/v1.beta/invoices?order=desc`, {
  headers: buyer_headers,
}).then((resp) => {
  if (resp.status !== 200) {
    throw new Error(`http ${resp.status}`)
  }
  return resp.json()
})
let maxId = 0
if (list.data.length > 0) {
  maxId = list.data[0].id
}

// Envoi de la facture
const uploaded = await fetch(`${config.endpoint}/v1.beta/invoices`, {
  method: "POST",
  headers: seller_headers,
  body: seller_invoice,
}).then((resp) => {
  if (resp.status !== 200) {
    throw new Error(`http ${resp.status}`)
  }
  return resp.json()
})

console.log("Facture envoyée")

// Boucle d'attente de la facture côté acheteur
let i = 0
let intervalId = setInterval(async () => {
  if (i > 10) {
    clearInterval(intervalId)
  }
  i += 1

  // Liste des factures acheteur
  const list = await fetch(
    `${config.endpoint}/v1.beta/invoices?starting_after_id=${maxId}`,
    {
      headers: buyer_headers,
    },
  ).then((resp) => {
    if (resp.status !== 200) {
      throw new Error(`http ${resp.status}`)
    }
    return resp.json()
  })

  if (list.data.length > 0) {
    console.log("Facture reçue !")
    clearInterval(intervalId)
  }
}, 1000)

/*
Exemple de génération d'une Factur-X à partir d'un JSON et d'un PDF

Prérequis :

- Se créer un compte gratuit sur <https://www.superpdp.tech>
- Avoir installé nodejs sur sa machine

Commande pour lancer le script :

node facturx.js

Ce script effectue les actions suivantes :

1. Obtention d'un token oauth2 pour le vendeur
2. Affichage de la dénomination sociale du vendeur
3. Téléchargement d'une facture de test côté vendeur
4. Validation de la facture côté vendeur
5. Conversion de la facture de test en JSON
6. Conversion du JSON + PDF en Factur-X
7. Validation de la Factur-X
*/
import fs from "fs"

// Configuration à compléter avec identifiants des applications oauth créées sur SUPER PDP
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

// Vérification du nom de l'entreprise associée au token vendeur
const seller_company = await fetch(`${config.endpoint}/v1.beta/companies/me`, {
  headers: seller_headers,
}).then((resp) => {
  if (resp.status !== 200) {
    throw new Error(`http ${resp.status}`)
  }
  return resp.json()
})

console.log(`Dénomination du vendeur : ${seller_company.formal_name}`)

// Téléchargement d'une facture de test qui est prête à être envoyée du vendeur à l'acheteur
const seller_invoice = await fetch(
  `${config.endpoint}/v1.beta/invoices/generate_test_invoice?format=cii`,
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
let validation_report = await fetch(
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

console.log(`Résultat de la validation : ${validation_report.data[0].is_valid}`)

// Conversion de la facture en JSON
const enInvoice = await fetch(
  `${config.endpoint}/v1.beta/invoices/convert?from=cii&to=en16931`,
  {
    method: "POST",
    body: seller_invoice,
  },
).then((resp) => {
  if (resp.status !== 200) {
    throw new Error(`http ${resp.status}`)
  }
  return resp.json()
})

console.log("Facture convertie en JSON")

// Conversion du JSON + PDF en Factur-X
const pdf = fs.readFileSync("facturx_blank.pdf")
const body = new FormData()
body.append(
  "invoice",
  new Blob([JSON.stringify(enInvoice)], { type: "application/json" }),
)
body.append("pdf", new Blob([pdf], { type: "application/pdf" }))
const facturX = await fetch(
  `${config.endpoint}/v1.beta/invoices/convert?from=en16931&to=factur-x`,
  {
    method: "POST",
    body,
  },
).then((resp) => {
  if (resp.status !== 200) {
    throw new Error(`http ${resp.status}`)
  }
  return resp.arrayBuffer()
})

console.log("Facture convertie en Factur-X")

form_data = new FormData()
form_data.append("file", new Blob([facturX]))
validation_report = await fetch(
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
console.log(`Résultat de la validation : ${validation_report.data[0].is_valid}`)

fs.writeFileSync("facturx.pdf", Buffer.from(facturX))
console.log("Factur-X sauvegardée sous facturx.pdf")

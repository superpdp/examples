package main

/*
Démarrage rapide avec SUPER PDP

Serveur web de démo qui simule un logiciel ERP de gestion qui se connecte à SUPER PDP
en OAuth 2.0 avec le flow "Authorization Code".

Prérequis :

- Se créer un compte gratuit sur <https://www.superpdp.tech>
- Installer go sur sa machine
- Adapter la configuration ci-dessous avec vos valeurs de ClientId et ClientSecret

Commande à exécuter la première fois uniquement :

go mod init erp
go mod tidy

Puis, pour lancer le script

go run erp

Enfin, dans un navigateur, se connecter au logiciel de gestion de démo :

http://localhost:8081
*/

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"os"

	"golang.org/x/oauth2"
)

func main() {
	var endpoint = "https://api.superpdp.tech"

	oauth2Config := oauth2.Config{
		ClientID:     os.Getenv("SUPER_PDP_ERP_CLIENT_ID"),
		ClientSecret: os.Getenv("SUPER_PDP_ERP_CLIENT_SECRET"),
		Endpoint: oauth2.Endpoint{
			AuthURL:  endpoint + "/oauth2/authorize",
			TokenURL: endpoint + "/oauth2/token",
		},
		RedirectURL: "http://localhost:8081/callback",
		Scopes:      []string{},
	}

	var tokens []oauth2.Token

	// Page d'accueil du logiciel de gestion qui n'affiche qu'un bouton "Se connecter"
	// pour initier le tunnel d'inscription et le flow Authorization Code
	http.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		if len(tokens) == 0 {
			_, err := w.Write([]byte(`Pas connecté.<br/><a href="/connect">Se connecter</a>`))
			if err != nil {
				panic(err)
			}
		} else {
			cli := oauth2Config.Client(r.Context(), &tokens[0])
			resp, err := cli.Get(endpoint + "/v1.beta/companies/me")
			if err != nil {
				panic(err)
			}

			_, err = io.Copy(w, resp.Body)
			if err != nil {
				panic(err)
			}
		}
	})

	// Redirection vers le tunnel d'inscription SUPER PDP
	http.HandleFunc("GET /connect", func(w http.ResponseWriter, r *http.Request) {
		var bytes = make([]byte, 16)
		_, err := rand.Read(bytes)
		if err != nil {
			panic(err)
		}

		state := base64.RawURLEncoding.EncodeToString(bytes)

		http.Redirect(w, r, oauth2Config.AuthCodeURL(state), http.StatusFound)
	})

	// À la fin du tunnel d'inscription, l'utilisateur est redirigé sur cette route
	http.HandleFunc("GET /callback", func(w http.ResponseWriter, r *http.Request) {
		code := r.URL.Query().Get("code")

		token, err := oauth2Config.Exchange(r.Context(), code)
		if err != nil {
			panic(err)
		}

		err = json.NewEncoder(w).Encode(token)
		if err != nil {
			panic(err)
		}

		tokens = append(tokens, *token)
	})

	err := http.ListenAndServe(":8081", nil)
	if err != nil {
		panic(err)
	}
}

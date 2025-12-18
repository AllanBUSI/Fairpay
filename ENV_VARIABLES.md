# Variables d'environnement requises

## Variables Stripe

### Variables obligatoires

```env
# Clés Stripe
STRIPE_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Price IDs Stripe
STRIPE_PRICE_ID_ABONNEMENT=price_xxxxx
STRIPE_PRICE_ID_MISE_EN_DEMEURE_SANS_ABO=price_xxxxx
STRIPE_PRICE_ID_MISE_EN_DEMEURE_AVEC_ABO=price_xxxxx
STRIPE_PRICE_ID_ECHEANCIER=price_xxxxx
STRIPE_PRICE_ID_INJONCTION=price_xxxxx
```

### Description des variables

- **STRIPE_SECRET_KEY** : Clé secrète Stripe (commence par `sk_test_` en test, `sk_live_` en production)
- **NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY** : Clé publique Stripe (commence par `pk_test_` en test, `pk_live_` en production)
- **STRIPE_WEBHOOK_SECRET** : Secret du webhook Stripe (commence par `whsec_`)

- **STRIPE_PRICE_ID_ABONNEMENT** : Price ID de l'abonnement mensuel (29€ HT/mois)
- **STRIPE_PRICE_ID_MISE_EN_DEMEURE_SANS_ABO** : Price ID de la mise en demeure sans abonnement (179€ HT)
- **STRIPE_PRICE_ID_MISE_EN_DEMEURE_AVEC_ABO** : Price ID de la mise en demeure avec abonnement (99€ HT)
- **STRIPE_PRICE_ID_ECHEANCIER** : Price ID de l'écheancier de paiement (49€ HT)
- **STRIPE_PRICE_ID_INJONCTION** : Price ID de l'injonction de payer (pour la saisie du tribunal)

## Comment obtenir les Price IDs Stripe

1. Connectez-vous à votre [tableau de bord Stripe](https://dashboard.stripe.com/)
2. Allez dans **Produits** → **Prix**
3. Cliquez sur le produit souhaité
4. Copiez le **Price ID** (commence par `price_`)

## Ajout de la variable manquante

Pour ajouter `STRIPE_PRICE_ID_INJONCTION` :

1. Ouvrez votre fichier `.env` ou `.env.local` à la racine du projet
2. Ajoutez la ligne suivante :
   ```env
   STRIPE_PRICE_ID_INJONCTION=price_xxxxx
   ```
3. Remplacez `price_xxxxx` par le Price ID réel de votre produit "Injonction de payer" dans Stripe
4. Redémarrez votre serveur de développement (`npm run dev`)

## Vérification

Pour vérifier que toutes les variables sont bien configurées, vous pouvez consulter les logs du serveur. Si une variable manque, vous verrez un message d'erreur indiquant quelle variable n'est pas définie.


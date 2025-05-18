MegaPhone est un SaaS B2B que j'ai mis en production qui permet aux entreprises d'automatiser leurs appels sortants de collection de dettes et d'impayés.

L'utilisateur peut créer un compte, importer une liste de débiteurs, créer une séquence d'appels IA qui se lanceront parallèlement, comprendre la situation de chaque débiteurs au cas par cas, et envoyer un SMS avec le lien de paiement dès que le débiteur montre l'envie qu'il souhaite payer.

J'ai dû tester plusieurs technologies et infrastructures de Text-to-Speech et de Speech-to-text pour optimiser au maximum la latence et le réalisme humain de l'aspect conversationnel vocal.

La Stack technique:
- Google Speech-to-text (Faible latence)
- Groq Llama 70b (Infrastructure de LLM ultra-rapide)
- Eleven Labs (Voix ultra-réaliste)
- Twilio / Twilio Media Stream (Streaming)
- Websockets / Heroku (Serverless)
- Postgresql / Supabase / Supabase Auth
- React.js (Next.js)
- Node.js (Moteur conversationnel)
- Stripe (Paiement)

Voici la landing page: https://autoph.one/
Voici l'app: https://app.autoph.one/

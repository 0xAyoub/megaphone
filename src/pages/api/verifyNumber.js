import twilio from 'twilio';

const twilioClient = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Méthode non autorisée' });
    }

    const { phoneNumber } = req.body;

    try {
        const validationRequest = await twilioClient.validationRequests
            .create({ friendlyName: "Autocall", phoneNumber: phoneNumber });


            res.status(200).json({ message: 'Appel de vérification initié avec succès.', validationCode: validationRequest.validationCode });
        } catch (error) {
            console.error('Erreur lors de l’initiation de l’appel de vérification:', error);
            res.status(500).json({ error: 'Erreur lors de l’initiation de l’appel de vérification' });
        }
    }
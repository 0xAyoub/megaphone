import twilio from 'twilio';

const TWILIO_ACCOUNT_SID = process.env.ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.AUTH_TOKEN;
const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

export default async function handler(req, res) {
    const { region } = req.query;

    try {
        let availableNumbers = await client.availablePhoneNumbers('US').local.list({
            areaCode: region,
            limit: 20
        });
    
        const filteredNumbers = availableNumbers.map(number => ({
            friendlyName: number.friendlyName,
            phoneNumber: number.phoneNumber,
            countryCode: '+1'  // Assurez-vous que le code pays est correctement défini
        }));
        res.status(200).json(filteredNumbers);
    } catch (error) {
        console.error('Erreur lors de la récupération des numéros:', error);
        res.status(500).json({ error: 'Erreur lors de la récupération des numéros' });
    }
}
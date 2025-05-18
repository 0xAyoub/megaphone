export default function handler(req, res) {
    const { CallStatus, CallSid } = req.body;
    console.log(`Received status ${CallStatus} for call ${CallSid}`);
  
    // Vous pouvez ajouter ici la logique pour gérer différents statuts
    switch (CallStatus) {
      case 'completed':
        console.log('Completed')
        break;
      case 'no-answer':
        console.log('No answer')
        break;
      // Ajoutez d'autres cas au besoin
    }
  
    res.status(200).send('Status received');
  }
// import twilio from 'twilio';
// import { WebSocketServer } from 'ws';
// import { RealtimeTranscriber } from 'assemblyai';
// import axios from 'axios';
// import * as PlayHT from 'playht';

// const client = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);

// let callActive = false;
// let wss = null;
// let transcriber = null;
// let streamSid = null;

// export default function handler(req, res) {
//   if (req.method === 'POST') {
//     const { to, from } = req.body;

//     client.calls.create({
//       twiml: `<Response><Connect><Stream url="wss://${req.headers.host}/api" /></Connect></Response>`,
//       to: "+33627339557",
//       from: "(909) 992-0176"
//     }).then(call => {
//       callActive = true;
//       startWebSocketServer(req, res);
//       res.status(200).json({ sid: call.sid });
//     }).catch(err => {
//       console.error('Erreur lors de la création de l\'appel:', err);
//       res.status(500).json({ error: 'Erreur lors de la création de l\'appel' });
//     });
//   } else {
//     res.status(405).json({ message: 'Méthode non autorisée' });
//   }
// }

// let conversationContext = [];

// async function sendTranscriptionToOpenAI(transcription) {
//   try {
//     const apiKey = process.env.OPENAI_API_KEY;
//     const url = 'https://api.openai.com/v1/chat/completions';

//     const headers = {
//       'Content-Type': 'application/json',
//       'Authorization': `Bearer ${apiKey}`
//     };

//     const data = {
//       model: 'gpt-3.5-turbo', 
//       messages: [
//         {
//           role: 'system',
//           content: 'Tu dois parler uniquement en anglais aux clients, tu es au téléphone et tu dois parler très court en répondant en une seule phrase courte et poser une question pour en savoir plus sur la personne.'
//         },
//         ...conversationContext,
//         {
//           role: 'user',
//           content: transcription
//         }
//       ]
//     };

//     const response = await axios.post(url, data, { headers });

//     const aiResponse = response.data.choices[0].message.content;
//     conversationContext.push(
//       { role: 'user', content: transcription },
//       { role: 'assistant', content: aiResponse }
//     );

//     // Générer la réponse vocale avec PlayHT
//     // await generateAndStreamPlayHTResponse(aiResponse);

//     return aiResponse;
//   } catch (error) {
//     console.error('Erreur lors de l\'appel à l\'API d\'OpenAI:', error);
//     throw error;
//   }
// }

// // async function generateAndStreamPlayHTResponse(text) {
// //   console.log(text)
// //   console.log(streamSid)

// //   console.log("To String : ", streamSid.toString())
// //   PlayHT.init({
// //     apiKey: process.env.PLAYHT_API_KEY,
// //     userId: process.env.PLAYHT_USER_ID,
// //   });

// //   console.log("Le texte : " + text)

// //   const streamFromStream = await PlayHT.stream(text, {
// //     voiceEngine: 'PlayHT2.0-turbo',
// //     voiceId: 's3://peregrine-voices/oliver_narrative2_parrot_saad/manifest.json',
// //     outputFormat: 'mulaw',
// //     sampleRate: 8000,
// //   });

// //   console.log("Le stream : " + streamFromStream)

// //   streamFromStream.on('data', (data) => {
// //     const message = JSON.stringify({
// //       event: 'media',
// //       streamSid: streamSid.toString(),
// //       media: {
// //         payload: data.toString('base64'),
// //       },
// //     });

// //     // console.log(message)
    
// //     if (wss && wss.clients.size > 0) {
// //       wss.clients.forEach(client => {
// //         if (client.readyState === WebSocket.OPEN) {
// //           client.send(message);
// //           console.log('Audio stream sent to Twilio'); // Log pour le suivi
// //         }
// //       });
// //     } else {
// //       console.error('No WebSocket clients connected to send audio stream.');
// //     }

// //   });

// //   streamFromStream.on('error', (error) => {
// //     console.error('Error streaming from PlayHT:', error);
// //   });
// // }


// async function generateAndStreamPlayHTResponse(text, streamSid) {
//   console.log('Génération de la réponse audio avec PlayHT. Texte :', text);
//   console.log('Stream SID :', streamSid);

//   PlayHT.init({
//     apiKey: process.env.PLAYHT_API_KEY,
//     userId: process.env.PLAYHT_USER_ID,
//   });

//   const streamFromStream = await PlayHT.stream(text, {
//     voiceEngine: 'PlayHT2.0-turbo',
//     voiceId: 's3://voice-cloning-zero-shot/1afba232-fae0-4b69-9675-7f1aac69349f/delilahsaad/manifest.json', 
//     outputFormat: 'mulaw',
//     sampleRate: 8000,
//   });

//   console.log('Flux audio PlayHT créé');

//   streamFromStream.on('data', (data) => {
//     const message = JSON.stringify({
//       event: 'media',
//       streamSid,
//       media: {
//         payload: data.toString('base64'),
//       },
//     });
//     if (wss && wss.clients.size > 0) {
//       wss.clients.forEach(client => {
//         if (client.readyState === WebSocket.OPEN) {
//           client.send(message);
//           console.log('Données audio envoyées via WebSocket');
//         } else {
//           console.warn('WebSocket client non prêt. État :', client.readyState);
//         }
//       });
//     } else {
//       console.error('Aucun client WebSocket connecté pour envoyer les données audio');
//     }
//   });

//   streamFromStream.on('error', (error) => {
//     console.error('Erreur lors de la diffusion depuis PlayHT:', error);
//   });

//   streamFromStream.on('end', () => {
//     console.log('Fin de la diffusion audio PlayHT');
//   });
// }

// function startWebSocketServer(req, res) {
//   if (!wss) {
//     console.log('Configuration du serveur WebSocket');
//     wss = new WebSocketServer({ noServer: true });
//     req.socket.server.ws = wss;

//     req.socket.server.on('upgrade', (request, socket, head) => {
//       if (authenticateWebSocket(request) && callActive) {
//         wss.handleUpgrade(request, socket, head, (ws) => {
//           wss.emit('connection', ws, request);
//         });
//       } else {
//         socket.destroy();
//       }
//     });

//     wss.on('connection', async (ws) => {
//       console.log('WebSocket connecté');

//       try {
//         if (!transcriber) {
//           transcriber = new RealtimeTranscriber({
//             apiKey: process.env.ASSEMBLYAI_API_KEY,
//             encoding: 'pcm_mulaw',
//             sampleRate: 8000
//           });
//           await transcriber.connect();
//           console.log('Transcripteur connecté');
//         }

//         ws.on('message', async (message) => {
//           const msg = JSON.parse(message);
//           streamSid = msg.streamSid; // Récupérer le streamSid depuis le message 'start'
//           // console.log('Stream SID reçu :', streamSid);
//           if (msg.event === 'start') {
//           } else if (msg.event === 'media' && callActive) {
//             // console.log('Réception des données audio. Envoi au transcripteur');
//             transcriber.sendAudio(Buffer.from(msg.media.payload, 'base64'));
//           } else {
//             console.warn('Message WebSocket inattendu reçu :', msg);
//           }
//         });

//         transcriber.on('transcript.partial', (data) => {
//           console.log('Transcription partielle :', data.text);
//         });

//         transcriber.on('transcript.final', async (data) => {
//           console.log('Transcription finale :', data.text);
//           try {
//             const openAIResponse = await sendTranscriptionToOpenAI(data.text);
//             console.log('Réponse d\'OpenAI:', openAIResponse);

//             await generateAndStreamPlayHTResponse(openAIResponse, streamSid);

//           } catch (error) {
//             console.error('Erreur lors de l\'obtention de la réponse d\'OpenAI:', error);
//           }
//         });


//         ws.on('close', async () => {
//           console.log('WebSocket déconnecté');
//           callActive = false;
//           if (transcriber) {
//             await transcriber.close();
//             transcriber = null;
//             console.log('Transcripteur déconnecté');
//           }
//         });
//       } catch (error) {
//         console.error('Erreur lors de la gestion de la connexion WebSocket:', error);
//         ws.close(1011);
//       }
//     });
//   }
// }

// function authenticateWebSocket(req) {
//   // Ajoutez ici votre logique d'authentification WebSocket
//   return true;
// }


// //////////////////////////////////////////////////////////////////////////////





// MakeCall 2

// import twilio from 'twilio';
// import { WebSocketServer } from 'ws';
// import axios from 'axios';
// import * as PlayHT from 'playht';
// import speech from '@google-cloud/speech';

// const client = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);
// const speechClient = new speech.SpeechClient();

// let callActive = false;
// let wss = null;
// let recognizeStream = null;
// let streamSid = null;

// export default function handler(req, res) {
//   if (req.method === 'POST') {
//     const { to, from } = req.body;

//     client.calls.create({
//       twiml: `<Response><Connect><Stream url="wss://${req.headers.host}/api" /></Connect></Response>`,
//       to: "+33627339557",
//       from: "(909) 992-0176"
//     }).then(call => {
//       callActive = true;
//       startWebSocketServer(req, res);
//       res.status(200).json({ sid: call.sid });
//     }).catch(err => {
//       console.error('Erreur lors de la création de l\'appel:', err);
//       res.status(500).json({ error: 'Erreur lors de la création de l\'appel' });
//     });
//   } else {
//     res.status(405).json({ message: 'Méthode non autorisée' });
//   }
// }

// let conversationContext = [];

// async function sendTranscriptionToOpenAI(transcription) {
//   try {
//     const apiKey = process.env.OPENAI_API_KEY;
//     const url = 'https://api.openai.com/v1/chat/completions';

//     const headers = {
//       'Content-Type': 'application/json',
//       'Authorization': `Bearer ${apiKey}`
//     };

//     const data = {
//       model: 'gpt-3.5-turbo', 
//       messages: [
//         {
//           role: 'system',
//           content: 'Tu dois parler uniquement en anglais aux clients, tu es au téléphone et tu dois parler très court en répondant en une seule phrase courte et poser une question pour en savoir plus sur la personne.'
//         },
//         ...conversationContext,
//         {
//           role: 'user',
//           content: transcription
//         }
//       ]
//     };

//     const response = await axios.post(url, data, { headers });

//     const aiResponse = response.data.choices[0].message.content;
//     conversationContext.push(
//       { role: 'user', content: transcription },
//       { role: 'assistant', content: aiResponse }
//     );

//     return aiResponse;
//   } catch (error) {
//     console.error('Erreur lors de l\'appel à l\'API d\'OpenAI:', error);
//     throw error;
//   }
// }

// async function generateAndStreamPlayHTResponse(text, streamSid) {
//   console.log('Génération de la réponse audio avec PlayHT. Texte :', text);
//   console.log('Stream SID :', streamSid);

//   PlayHT.init({
//     apiKey: process.env.PLAYHT_API_KEY,
//     userId: process.env.PLAYHT_USER_ID,
//   });

//   const streamFromStream = await PlayHT.stream(text, {
//     voiceEngine: 'PlayHT2.0-turbo',
//     voiceId: 's3://peregrine-voices/a10/manifest.json', 
//     outputFormat: 'mulaw',
//     sampleRate: 8000,
//   });

//   console.log('Flux audio PlayHT créé');

//   streamFromStream.on('data', (data) => {
//     const message = JSON.stringify({
//       event: 'media',
//       streamSid,
//       media: {
//         payload: data.toString('base64'),
//       },
//     });
//     if (wss && wss.clients.size > 0) {
//       wss.clients.forEach(client => {
//         if (client.readyState === WebSocket.OPEN) {
//           client.send(message);
//           console.log('Données audio envoyées via WebSocket');
//         } else {
//           console.warn('WebSocket client non prêt. État :', client.readyState);
//         }
//       });
//     } else {
//       console.error('Aucun client WebSocket connecté pour envoyer les données audio');
//     }
//   });

//   streamFromStream.on('error', (error) => {
//     console.error('Erreur lors de la diffusion depuis PlayHT:', error);
//   });

//   streamFromStream.on('end', () => {
//     console.log('Fin de la diffusion audio PlayHT');
//   });
// }

// function startWebSocketServer(req, res) {
//   if (!wss) {
//     console.log('Configuration du serveur WebSocket');
//     wss = new WebSocketServer({ noServer: true });
//     req.socket.server.ws = wss;

//     req.socket.server.on('upgrade', (request, socket, head) => {
//       if (authenticateWebSocket(request) && callActive) {
//         wss.handleUpgrade(request, socket, head, (ws) => {
//           wss.emit('connection', ws, request);
//         });
//       } else {
//         socket.destroy();
//       }
//     });

//     wss.on('connection', async (ws) => {
//       console.log('WebSocket connecté');

//       if (!recognizeStream) {
//         const request = {
//           config: {
//             encoding: 'MULAW',
//             sampleRateHertz: 8000,
//             languageCode: 'fr-FR',
//             model: 'phone_call',
//           },
//           interimResults: true, // Modifier pour ne pas recevoir de résultats intermédiaires
//           single_utterance: true // Arrêter automatiquement la reconnaissance après une pause
//         };

//         recognizeStream = speechClient
//           .streamingRecognize(request)
//           .on('error', console.error)
//           .on('data', async (data) => {
//             console.log(data.results[0])
//             if (data.results[0] && data.results[0].isFinal) {
//               const transcription = data.results[0].alternatives[0].transcript;
//               console.log('Transcription finale :', transcription);

//               try {
//                 const openAIResponse = await sendTranscriptionToOpenAI(transcription);
//                 console.log('Réponse d\'OpenAI:', openAIResponse);

//                 await generateAndStreamPlayHTResponse(openAIResponse, streamSid);
//               } catch (error) {
//                 console.error('Erreur lors de l\'obtention de la réponse d\'OpenAI:', error);
//               }
//             } else {
//               // console.log('Transcription intermédiaire:', data.results[0].alternatives[0].transcript);
//             }
//           });

//         console.log('Client Google Speech-to-Text connecté');
//       }

//       ws.on('message', async (message) => {
//         const msg = JSON.parse(message);
//         streamSid = msg.streamSid;
//         if (msg.event === 'media' && callActive) {
//           recognizeStream.write(msg.media.payload);
//         }
//       });

//       ws.on('close', async () => {
//         console.log('WebSocket déconnecté');
//         callActive = false;
//         if (recognizeStream) {
//           recognizeStream.destroy();
//           recognizeStream = null;
//           console.log('Client Google Speech-to-Text déconnecté');
//         }
//       });
//     });
//   }
// }

// function authenticateWebSocket(req) {
//   // Ajoutez ici votre logique d'authentification WebSocket
//   return true;
// }



// //////////////////////////////////////////////////////////////////////////////////////////////




// import twilio from 'twilio';
// import { WebSocketServer } from 'ws';
// import axios from 'axios';
// import * as PlayHT from 'playht';
// import { ElevenLabsClient } from 'elevenlabs';
// import speech from '@google-cloud/speech';

// const client = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);
// const speechClient = new speech.SpeechClient();

// const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// if (!ELEVENLABS_API_KEY) {
//   throw new Error("Missing ELEVENLABS_API_KEY in environment variables");
// }

// const elevenlabs = new ElevenLabsClient({
//   apiKey: ELEVENLABS_API_KEY,
// });

// // const voiceId = 'GgV5QStPLpmkN7FOHJtY'; // French
// const voiceId = "g6fJBFvZZp41FerGMMx7" // English eleven_turbo_v2
// const outputFormat = 'ulaw_8000';

// let callActive = false;
// let wss = null;
// let recognizeStream = null;
// let streamSid = null;

// export default function handler(req, res) {
//   if (req.method === 'POST') {
//     const { to, from } = req.body;

//     client.calls.create({
//       twiml: `<Response><Connect><Stream url="wss://${req.headers.host}/api" /></Connect></Response>`,
//       to: "++33627339557",
//       from: "(909) 992-0176"
//     }).then(call => {
//       callActive = true;
//       startWebSocketServer(req, res);
//       res.status(200).json({ sid: call.sid });
//     }).catch(err => {
//       console.error('Erreur lors de la création de l\'appel:', err);
//       res.status(500).json({ error: 'Erreur lors de la création de l\'appel' });
//     });
//   } else {
//     res.status(405).json({ message: 'Méthode non autorisée' });
//   }
// }

// let conversationContext = [];

// async function sendTranscriptionToOpenAI(transcription) {
//   try {
//     const apiKey = process.env.OPENAI_API_KEY;
//     const url = 'https://api.openai.com/v1/chat/completions';

//     const headers = {
//       'Content-Type': 'application/json',
//       'Authorization': `Bearer ${apiKey}`
//     };

//     const data = {
//       model: 'gpt-3.5-turbo', 
//       messages: [
//         {
//           role: 'system',
//           content: "Tu es un agent téléphonique IA qui s'appelle Nicolas, tu dois parler en anglais et tu es un vendeur de voiture chez mercedes et tu dois amené vers un rendez-vous en concession et guider le client en parlant français, en répondant en une seule phrase courte et poser une question pour en savoir plus sur le client."
//         },
//         ...conversationContext,
//         {
//           role: 'user',
//           content: transcription
//         }
//       ]
//     };

//     const response = await axios.post(url, data, { headers });

//     const aiResponse = response.data.choices[0].message.content;
//     conversationContext.push(
//       { role: 'user', content: transcription },
//       { role: 'assistant', content: aiResponse }
//     );

//     return aiResponse;
//   } catch (error) {
//     console.error('Erreur lors de l\'appel à l\'API d\'OpenAI:', error);
//     throw error;
//   }
// }



// async function generateAndStreamPlayHTResponse(text, streamSid) {
//   console.log('Génération de la réponse audio avec ElevenLabs. Texte :', text);
//   console.log('Stream SID :', streamSid);

//   try {
//     const response = await elevenlabs.textToSpeech.convert(voiceId, {
//       model_id: 'eleven_turbo_v2',
//       output_format: outputFormat,
//       optimize_streaming_latency: 4,
//       text,
//       voice_settings: {
//         stability: 0.0,
//         similarity_boost: 1.0,
//         style: 0.0,
//         use_speaker_boost: true,
//       }
//     });

//     response.on('data', (chunk) => {
//       const message = JSON.stringify({
//         event: 'media',
//         streamSid,
//         media: {
//           payload: chunk.toString('base64'),
//         },
//       });
//       if (wss && wss.clients.size > 0) {
//         wss.clients.forEach(client => {
//           if (client.readyState === WebSocket.OPEN) {
//             client.send(message);
//             console.log('Données audio envoyées via WebSocket');
//           } else {
//             console.warn('WebSocket client non prêt. État :', client.readyState);
//           }
//         });
//       } else {
//         console.error('Aucun client WebSocket connecté pour envoyer les données audio');
//       }
//     });

//     response.on('end', () => {
//       console.log('Fin de la diffusion audio ElevenLabs');
//     });
//   } catch (error) {
//     console.error('Erreur lors de la synthèse vocale avec ElevenLabs:', error);
//   }
// }




// function startWebSocketServer(req, res) {
//   if (!wss) {
//     wss = new WebSocketServer({ noServer: true });
//     req.socket.server.ws = wss;

//     req.socket.server.on('upgrade', (request, socket, head) => {
//       if (authenticateWebSocket(request) && callActive) {
//         wss.handleUpgrade(request, socket, head, (ws) => {
//           wss.emit('connection', ws, request);
//         });
//       } else {
//         socket.destroy();
//       }
//     });

//     wss.on('connection', async (ws) => {
//       if (!recognizeStream) {
//         const deepgramUrl = `wss://api.deepgram.com/v1/listen?model=nova-2-phonecall&encoding=mulaw&sample_rate=8000`;
//         recognizeStream = new WebSocket(deepgramUrl, {
//           headers: {
//             'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`
//           }
//         });

//         recognizeStream.onopen = () => {
//           console.log('Connexion WebSocket à Deepgram établie');
//         };

//         recognizeStream.onmessage = async (event) => {
//           const result = JSON.parse(event.data);
//           if (result.type === 'Results' && result.is_final) {
//             const transcription = result.channel.alternatives[0].transcript;
//             if (transcription.trim() !== "") {
//               console.log('Transcription finale :', transcription);
//               try {
//                 const openAIResponse = await sendTranscriptionToOpenAI(transcription);
//                 console.log('Réponse d\'OpenAI:', openAIResponse);
//                 await generateAndStreamPlayHTResponse(openAIResponse, streamSid);
//               } catch (error) {
//                 console.error('Erreur lors de l\'obtention de la réponse d\'OpenAI:', error);
//               }
//             }
//           }
//         };

//         recognizeStream.onclose = () => {
//           console.log('Connexion WebSocket à Deepgram fermée');
//           recognizeStream = null;
//         };

//         recognizeStream.onerror = (error) => {
//           console.error('Erreur de la connexion WebSocket à Deepgram:', error);
//           recognizeStream = null;
//         };
//       }

//       ws.on('message', async (message) => {
//         const msg = JSON.parse(message);
//         streamSid = msg.streamSid;
//         if (msg.event === 'media' && callActive) {
//           if (recognizeStream && recognizeStream.readyState === WebSocket.OPEN) {
//             recognizeStream.send(Buffer.from(msg.media.payload, 'base64'));
//           }
//         }
//       });

//       ws.on('close', async () => {
//         callActive = false;
//         if (recognizeStream) {
//           recognizeStream.send(JSON.stringify({ type: 'CloseStream' }));
//         }
//       });
//     });
//   }
// }

// function authenticateWebSocket(req) {
//   return true;
// }



// //////////////////////////////////////////////////////////////////////////////////////////////////////////

// import twilio from 'twilio';
// import { WebSocketServer } from 'ws';
// import axios from 'axios';
// import * as PlayHT from 'playht';
// import Groq from "groq-sdk";
// import { ElevenLabsClient } from 'elevenlabs';
// import speech from '@google-cloud/speech';

// const client = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);
// const speechClient = new speech.SpeechClient();
// const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
// const elevenlabs = new ElevenLabsClient({
//   apiKey: process.env.ELEVENLABS_API_KEY,
// });


// // ElevenLabs
// // const voiceId = 'GgV5QStPLpmkN7FOHJtY'; // French eleven_multilingual_v2
// const voiceId = "g6fJBFvZZp41FerGMMx7" // English eleven_turbo_v2
// const outputFormat = 'ulaw_8000';

// let callActive = false;
// let wss = null;
// let streamSid = null;

// // Speech to Text
// let recognizeStream = null;

// export default function handler(req, res) {
//   if (req.method === 'POST') {
//     const { to, from } = req.body;

//     client.calls.create({
//       twiml: `<Response><Connect><Stream url="wss://${req.headers.host}/api" /></Connect></Response>`,
//       to: "++33627339557",
//       from: "(909) 992-0176"
//     }).then(call => {
//       callActive = true;
//       startWebSocketServer(req, res);
//       res.status(200).json({ sid: call.sid });
//     }).catch(err => {
//       console.error('Erreur lors de la création de l\'appel:', err);
//       res.status(500).json({ error: 'Erreur lors de la création de l\'appel' });
//     });
//   } else {
//     res.status(405).json({ message: 'Méthode non autorisée' });
//   }
// }

// let conversationContext = [];

// async function answerGeneration(transcription) {
//   try {
//     const chatCompletion = await groq.chat.completions.create({
//       messages: [
//         {
//           role: 'system',
//           content: "Tu dois faire des phrases extrêmement courte et aller droit au but en anglais. Tu es un agent téléphonique IA qui s'appelle Nicolas et tu travaille pour un concessionnaire Mercedes et tu dois amener le client à faire son choix, le qualifier, poser des questions sur son budget et enfin l'amener à planifier un rendez-vous."
//         },
//         ...conversationContext,
//         {
//           role: 'user',
//           content: transcription
//         }
//       ],
//       model: "llama3-70b-8192",
//     });

//     const aiResponse = chatCompletion.choices[0]?.message?.content || "";
//     conversationContext.push(
//       { role: 'user', content: transcription },
//       { role: 'assistant', content: aiResponse }
//     );

//     return aiResponse;
//   } catch (error) {
//     console.error('Erreur lors de l\'appel à l\'API Groq:', error);
//     throw error;
//   }
// }



// async function textToSpeech(text, streamSid) {
//     console.log('Génération de la réponse audio avec PlayHT. Texte :', text);
//     console.log('Stream SID :', streamSid);
  
//     PlayHT.init({
//       apiKey: process.env.PLAYHT_API_KEY,
//       userId: process.env.PLAYHT_USER_ID,
//     });
  
//     const streamFromStream = await PlayHT.stream(text, {
//       voiceEngine: 'PlayHT2.0-turbo',
//       voiceId: 's3://peregrine-voices/a10/manifest.json', 
//       outputFormat: 'mulaw',
//       sampleRate: 8000,
//     });
  
//     console.log('Flux Text to Speech créé');
  
//     streamFromStream.on('data', (data) => {
//       const message = JSON.stringify({
//         event: 'media',
//         streamSid,
//         media: {
//           payload: data.toString('base64'),
//         },
//       });
//       if (wss && wss.clients.size > 0) {
//         wss.clients.forEach(client => {
//           if (client.readyState === WebSocket.OPEN) {
//             client.send(message);
//             console.log('Données audio envoyées via WebSocket');
//           } else {
//             console.warn('WebSocket client non prêt. État :', client.readyState);
//           }
//         });
//       } else {
//         console.error('Aucun client WebSocket connecté pour envoyer les données audio');
//       }
//     });
  
//     streamFromStream.on('error', (error) => {
//       console.error('Erreur lors du Text to Speech:', error);
//     });
  
//     streamFromStream.on('end', () => {
//       console.log('Fin du Text to Speech');
//     });
//   }



//   async function generateTemporaryKey() {
//     try {
//       const response = await axios.post('https://mp.speechmatics.com/v1/api_keys?type=rt', {
//         ttl: 60
//       }, {
//         headers: {
//           'Content-Type': 'application/json',
//           'Authorization': `Bearer ${process.env.SPEECHMATICS_API_KEY}`
//         }
//       });
  
//       // console.log(response)
//       return response.data.key_value;
//     } catch (error) {
//       console.error('Erreur lors de la génération de la clé temporaire:', error);
//       throw error;
//     }
//   }


//   async function startWebSocketServer(req, res) {
//     if (!wss) {
//       wss = new WebSocketServer({ noServer: true });
//       req.socket.server.ws = wss;
  
//       req.socket.server.on('upgrade', (request, socket, head) => {
//         if (authenticateWebSocket(request) && callActive) {
//           wss.handleUpgrade(request, socket, head, (ws) => {
//             wss.emit('connection', ws, request);
//           });
//         } else {
//           socket.destroy();
//         }
//       });
  
//       wss.on('connection', async (ws) => {
//         try {
//           const temporaryKey = await generateTemporaryKey();
//           console.log(temporaryKey)
//           const speechmaticsUrl = `wss://eu2.rt.speechmatics.com/v2?jwt=${temporaryKey}`;
//           recognizeStream = new WebSocket(speechmaticsUrl);
  
//           recognizeStream.onopen = () => {
//             console.log('Connexion WebSocket à Speechmatics établie');
//             recognizeStream.send(JSON.stringify({
//               message: "StartRecognition",
//               audio_format: {
//                 type: "raw",
//                 encoding: "mulaw",
//                 sample_rate: 8000
//               },
//               transcription_config: {
//                 language: "en",
//                 enable_partials: true
//               }
//             }));
//           };
  
//           recognizeStream.onmessage = async (event) => {
//             const result = JSON.parse(event.data);
//             if (result.message === 'AddTranscript') {
//               const transcription = result.metadata.transcript;
//               if (transcription.trim() !== "") {
//                 console.log('Transcription finale :', transcription);
//                 try {
//                   const openAIResponse = await answerGeneration(transcription);
//                   console.log('Réponse d\'OpenAI:', openAIResponse);
//                   await textToSpeech(openAIResponse, streamSid);
//                 } catch (error) {
//                   console.error('Erreur lors de l\'obtention de la réponse d\'OpenAI:', error);
//                 }
//               }
//             }
//           };
  
//           recognizeStream.onclose = (event) => {
//             console.log('Connexion WebSocket à Speechmatics fermée');
//             console.log('Code de fermeture :', event.code);
//             console.log('Raison de fermeture :', event.reason);
//             recognizeStream = null;
//           };
          
//           recognizeStream.onerror = (error) => {
//             console.error('Erreur de la connexion WebSocket à Speechmatics:', error);
//             recognizeStream = null;
//           };
  
//           ws.on('message', async (message) => {
//             const msg = JSON.parse(message);
//             streamSid = msg.streamSid;
//             if (msg.event === 'media' && callActive) {
//               if (recognizeStream && recognizeStream.readyState === WebSocket.OPEN) {
//                 recognizeStream.send(Buffer.from(msg.media.payload, 'base64'));
//               }
//             }
//           });
  
//           ws.on('close', async () => {
//             callActive = false;
//             if (recognizeStream) {
//               recognizeStream.send(JSON.stringify({ message: 'EndOfStream' }));
//             }
//           });
  
//         } catch (error) {
//           console.error('Erreur lors de la génération de la clé temporaire:', error);
//           ws.close();
//         }
//       });
//     }
//   }


// function authenticateWebSocket(req) {
//   return true;
// }
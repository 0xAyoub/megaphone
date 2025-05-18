import twilio from 'twilio';
import { WebSocketServer } from 'ws';
import axios from 'axios';
import * as PlayHT from 'playht';
import Groq from "groq-sdk";
import { ElevenLabsClient } from 'elevenlabs';
import speech from '@google-cloud/speech';

const client = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);
const speechClient = new speech.SpeechClient();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const voiceId = "ZEBslWM12xCQWILoQtiP"; // English eleven_turbo_v2_5
const outputFormat = 'ulaw_8000';

let callActive = false;
let wss = null;
let streamSid = null;
let callSid = null;
let transferNumberVariable = null;

let recognizeStream = null;
let thisInstruction = null;
let thisSmsText = null;
let fromNumber = null;
let thisTone = null;
let thisContactDetails = null;

let isSpeechDetected = false; // Variable pour suivre la détection de la parole

export default function handler(req, res) {
  if (req.method === 'POST') {
    const { to, sequenceDetails, contactDetails } = req.body;
    thisInstruction = sequenceDetails.instructions;
    thisSmsText = sequenceDetails.sms_text;
    thisTone = sequenceDetails.tone;
    thisContactDetails = contactDetails;
    fromNumber = "+1(909)992-0176"; // This seems to be a constant, consider setting it directly in the environment or config

    return client.calls.create({
      twiml: `<Response><Connect><Stream url="wss://${req.headers.host}/api" /></Connect></Response>`,
      to: to,
      from: fromNumber
    }).then(call => {
      callActive = true;
      callSid = call.sid;
      startWebSocketServer(req, res);
      res.status(200).json({ sid: call.sid });
    }).catch(err => {
      console.error('Error creating the call:', err);
      res.status(500).json({ error: 'Error creating the call' });
    });
  }

  res.status(405).json({ message: 'Method not allowed' });
}

let conversationContext = [];

async function answerGeneration(transcription) {
  try {
    const textCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a virtual debt collection agent. Your task is to engage in a conversation with the debtor according to the following instructions: ${thisInstruction.replace(/'/g, "\\'")}. 
          You must speak in English and adhere to the Fair Debt Collection Practices Act (FDCPA). Your responses should be short, conversational, and respectful. 
          Here are the details of the debtor:
          - Name: ${thisContactDetails.first_name} ${thisContactDetails.last_name}
          - Amount Due: ${thisContactDetails.amount_due} ${thisContactDetails.currency}
          - Due Date: ${thisContactDetails.due_date}
          - Context: ${thisContactDetails.context}
          - Notes: ${thisContactDetails.notes}

          You should to make quick response with ${thisTone}
          
          Your objective is to discuss the debt and explore options for payment while ensuring compliance with the FDCPA.`
        },
        ...conversationContext,
        {
          role: 'user',
          content: transcription.replace(/'/g, "\\'")
        }
      ],
      model: "llama3-70b-8192"
    });

    const responseText = textCompletion.choices[0]?.message?.content || "";

    conversationContext.push(
      { role: 'user', content: transcription },
      { role: 'assistant', content: responseText }
    );

    console.log(responseText);

    await textToSpeech(responseText);

    return {
      response: responseText,
      transfer: false
    };

  } catch (error) {
    console.error('Erreur lors de l\'appel aux API:', error);
    throw error;
  }
}

// async function transferCallToNumber(transferNumber) {
//   try {
//     await client.calls(callSid).update({
//       twiml: `<Response><Dial>${transferNumber}</Dial></Response>`,
//     });

//     console.log(`Appel transféré vers ${transferNumber}`);
//     resetCallState();
//   } catch (error) {
//     console.error('Erreur lors du transfert d\'appel:', error);
//   }
// }

async function textToSpeech(text) {
  try {
    const elevenlabs = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });

    const response = await elevenlabs.textToSpeech.convertAsStream(voiceId, {
      model_id: 'eleven_turbo_v2_5',
      output_format: outputFormat,
      optimize_streaming_latency: 4,
      text,
      voice_settings: {
        stability: 0.0,
        similarity_boost: 1.0,
        style: 0.0,
        use_speaker_boost: true,
      }
    });

    response.on('data', (chunk) => {
      const message = JSON.stringify({
        event: 'media',
        streamSid,
        media: {
          payload: chunk.toString('base64'),
        },
      });

      if (wss && wss.clients.size > 0) {
        wss.clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
            console.log('Données audio envoyées via WebSocket');
          } else {
            console.warn('WebSocket client non prêt. État :', client.readyState);
          }
        });
      } else {
        console.error('Aucun client WebSocket connecté pour envoyer les données audio');
      }
    });

    response.on('error', (error) => {
      console.error('Erreur lors du Text to Speech:', error);
    });

    response.on('end', () => {
      console.log('Fin du Text to Speech');
    });
  } catch (error) {
    console.error('Erreur lors de la synthèse vocale avec ElevenLabs:', error);
  }
}

function sendClearMessage(streamSid) {
  const clearMessage = JSON.stringify({
    event: 'clear',
    streamSid: streamSid
  });

  if (wss && wss.clients.size > 0) {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(clearMessage);
      }
    });
  } else {
    console.error('Aucun client WebSocket connecté pour envoyer le message clear');
  }
}

function resetCallState() {
  callActive = false;
  callSid = null;
  streamSid = null;
  recognizeStream = null;
  conversationContext = []; // Réinitialiser le contexte de la conversation
  console.log('État de l\'appel et contexte de la conversation réinitialisés');
}

function startWebSocketServer(req, res) {
  if (!wss) {
    wss = new WebSocketServer({ noServer: true });
    req.socket.server.ws = wss;

    req.socket.server.on('upgrade', (request, socket, head) => {
      if (authenticateWebSocket(request) && callActive) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    wss.on('connection', async (ws) => {
      console.log('WebSocket connecté');
      
      if (!recognizeStream && callActive) {
        const request = {
          config: {
            encoding: 'MULAW',
            sampleRateHertz: 8000,
            languageCode: 'en-US',
            model: 'phone_call',
          },
          interimResults: true,
          single_utterance: false
        };

        recognizeStream = speechClient
          .streamingRecognize(request)
          .on('error', error => {
            console.error('Error in recognition stream:', error);
            recognizeStream = null; // Reset stream on error
          })
          .on('data', async (data) => {
            if (data.results[0] && data.results[0].alternatives[0].transcript != '') {
              isSpeechDetected = true;
              sendClearMessage(streamSid);
              
              if (data.results[0].isFinal) {
                const transcription = data.results[0].alternatives[0].transcript;
                console.log('Transcription finale :', transcription);
                isSpeechDetected = false;
                try {
                  if (transcription !== "") {
                    await answerGeneration(transcription);
                  }
                } catch (error) {
                  console.error('Erreur lors de l\'obtention de la réponse de l\'IA:', error);
                }
              } 
            } else {
              isSpeechDetected = false;
            }
          });
      }

      ws.on('message', async (message) => {
        const msg = JSON.parse(message);
        streamSid = msg.streamSid;
        if (msg.event === 'media' && callActive && recognizeStream) {
          if (recognizeStream.writable) {
            recognizeStream.write(msg.media.payload);
          } else {
            console.log('Stream is not writable.');
          }
        }
      });

      ws.on('close', async () => {
        console.log("WebSocket déconnecté");
        resetCallState();
      });
    });
  }
}

function authenticateWebSocket(req) {
  return true;
}

// import twilio from 'twilio';
// import { WebSocketServer } from 'ws';
// import axios from 'axios';
// import { ElevenLabsClient } from 'elevenlabs';
// import speech from '@google-cloud/speech';

// // const client = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);
// const speechClient = new speech.SpeechClient();
// const elevenlabs = new ElevenLabsClient({
//   apiKey: process.env.ELEVENLABS_API_KEY,
// });

// const voiceId = "ZEBslWM12xCQWILoQtiP"; // English eleven_turbo_v2_5
// const outputFormat = 'ulaw_8000';

// let callActive = false;
// let wss = null;
// let streamSid = null;
// let callSid = null;

// let recognizeStream = null;
// let thisInstruction = null;
// let thisTarget = null;

// let isSpeechDetected = false; // Track speech detection
// let conversationContext = [];

// export default async function handler(req, res) {
//   if (req.method === 'POST') {
//     const { CallSid, DialCallStatus } = req.body;
    
//     if (!DialCallStatus) {
//       // Initial incoming call
//       callSid = CallSid;
//       callActive = true;

//       // Respond with TwiML to dial the specified number with a 5-second timeout
//       const twiml = new twilio.twiml.VoiceResponse();
//       const dial = twiml.dial({
//         action: `/api/receiveCall`,
//         method: 'POST',
//         timeout: 5
//       });
//       dial.number('+33627339557');

//       res.writeHead(200, { 'Content-Type': 'text/xml' });
//       res.end(twiml.toString());

//       // Optionally, you can start the WebSocket server here if you want to prepare for AI connection
//       // startWebSocketServer(req.socket.server);
//     } else {
//       // Handling Dial action callback
//       if (DialCallStatus !== 'completed') {
//         // If the dialed number did not answer, connect to AI agent
//         callActive = true;

//         const twiml = new twilio.twiml.VoiceResponse();
//         twiml.connect().stream({
//           url: `wss://${req.headers.host}/api`
//         });

//         res.writeHead(200, { 'Content-Type': 'text/xml' });
//         res.end(twiml.toString());

//         // Start the WebSocket server
//         startWebSocketServer(req.socket.server);
//       } else {
//         // Call was answered by the dialed number
//         // You can handle any post-call logic here if needed
//         res.writeHead(200, { 'Content-Type': 'text/xml' });
//         res.end('<Response></Response>');
//       }
//     }
//   } else {
//     res.status(405).json({ message: 'Method not allowed' });
//   }
// }

// function startWebSocketServer(server) {
//   if (!wss) {
//     wss = new WebSocketServer({ noServer: true });
//     server.on('upgrade', (request, socket, head) => {
//       if (authenticateWebSocket(request) && callActive) {
//         wss.handleUpgrade(request, socket, head, (ws) => {
//           wss.emit('connection', ws, request);
//         });
//       } else {
//         socket.destroy();
//       }
//     });

//     wss.on('connection', async (ws) => {
//       console.log('WebSocket connected');

//       // Send a welcome message via Text to Speech
//       await textToSpeech("Hello! How can I assist you today?");

//       if (!recognizeStream && callActive) {
//         const request = {
//           config: {
//             encoding: 'MULAW',
//             sampleRateHertz: 8000,
//             languageCode: 'en-US',
//             model: 'phone_call',
//           },
//           interimResults: true,
//           single_utterance: false
//         };

//         recognizeStream = speechClient
//           .streamingRecognize(request)
//           .on('error', error => {
//             console.error('Error in recognition stream:', error);
//             recognizeStream = null; // Reset stream on error
//           })
//           .on('data', async (data) => {
//             if (data.results[0] && data.results[0].alternatives[0].transcript != '') {
//               isSpeechDetected = true;
//               sendClearMessage(streamSid);

//               if (data.results[0].isFinal) {
//                 const transcription = data.results[0].alternatives[0].transcript;
//                 console.log('Final transcription:', transcription);
//                 isSpeechDetected = false;
//                 try {
//                   if (transcription !== "") {
//                     await answerGeneration(transcription);
//                   }
//                 } catch (error) {
//                   console.error('Error while getting AI response:', error);
//                 }
//               }
//             } else {
//               isSpeechDetected = false;
//             }
//           });
//       }

//       ws.on('message', async (message) => {
//         const msg = JSON.parse(message);
//         streamSid = msg.streamSid;
//         if (msg.event === 'media' && callActive && recognizeStream) {
//           if (recognizeStream.writable) {
//             recognizeStream.write(msg.media.payload);
//           } else {
//             console.log('Stream is not writable.');
//           }
//         }
//       });

//       ws.on('close', async () => {
//         console.log("WebSocket disconnected");
//         resetCallState();
//       });
//     });
//   }
// }

// function authenticateWebSocket(req) {
//   // Implement authentication logic here
//   return true;
// }

// async function answerGeneration(transcription) {
//   try {
//     // Generate AI response using OpenAI GPT
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
//           content: `You are a telephone agent who has to make a call according to precise instructions. You must speak in English. 
//           You must follow these instructions exactly: ${thisInstruction ? thisInstruction.replace(/'/g, "\\'") : ''}. During this call, your objective is to ${thisTarget ? thisTarget.replace(/'/g, "\\'") : ''}. 
//           It's essential that you keep your answers very short.`
//         },
//         {
//           role: 'user',
//           content: transcription
//         },
//         ...conversationContext
//       ],
//       temperature: 0.7,
//       max_tokens: 256,
//       top_p: 1,
//       frequency_penalty: 0,
//       presence_penalty: 0,
//     };

//     const response = await axios.post(url, data, { headers });
//     const responseText = response.data.choices[0].message.content;

//     conversationContext.push(
//       { role: 'user', content: transcription },
//       { role: 'assistant', content: responseText }
//     );

//     console.log('AI response:', responseText);

//     // Send response directly to Text to Speech
//     await textToSpeech(responseText);

//     return {
//       response: responseText
//     };
//   } catch (error) {
//     console.error('Error while calling APIs:', error);
//     throw error;
//   }
// }

// async function textToSpeech(text) {
//   try {
//     const response = await elevenlabs.textToSpeech.convertAsStream(voiceId, {
//       model_id: 'eleven_turbo_v2_5',
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
//             console.log('Audio data sent via WebSocket');
//           } else {
//             console.warn('WebSocket client not ready. State:', client.readyState);
//           }
//         });
//       } else {
//         console.error('No WebSocket clients connected to send audio data');
//       }
//     });

//     response.on('error', (error) => {
//       console.error('Error during Text to Speech:', error);
//     });

//     response.on('end', () => {
//       console.log('End of Text to Speech');
//     });
//   } catch (error) {
//     console.error('Error during speech synthesis with ElevenLabs:', error);
//   }
// }

// function sendClearMessage(streamSid) {
//   const clearMessage = JSON.stringify({
//     event: 'clear',
//     streamSid: streamSid
//   });

//   if (wss && wss.clients.size > 0) {
//     wss.clients.forEach(client => {
//       if (client.readyState === WebSocket.OPEN) {
//         client.send(clearMessage);
//       }
//     });
//   } else {
//     console.error('No WebSocket clients connected to send clear message');
//   }
// }

// function resetCallState() {
//   callActive = false;
//   callSid = null;
//   streamSid = null;
//   recognizeStream = null;
//   conversationContext = []; // Reset conversation context
//   console.log('Call state and conversation context reset');
// }

import twilio from 'twilio';
import { WebSocketServer } from 'ws';
import axios from 'axios';
import { ElevenLabsClient } from 'elevenlabs';
import speech from '@google-cloud/speech';
import { supabase } from '../../utils/supabaseClient'; // Ensure the path is correct

const speechClient = new speech.SpeechClient();
const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

const voiceId = "ZEBslWM12xCQWILoQtiP"; // English eleven_turbo_v2_5
const outputFormat = 'ulaw_8000';

let callActive = false;
let wss = null;
let streamSid = null;
let callSid = null;

let recognizeStream = null;
let thisInstruction = null;
let thisTarget = null;
let thisRingSeconds = 0;
let thisAgentName = null;

let isSpeechDetected = false; // Track speech detection
let conversationContext = [];

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { CallSid, DialCallStatus, From } = req.body;
    
    if (!DialCallStatus) {
      // Initial incoming call
      callSid = CallSid;
      callActive = true;

      const { data: agentData, error } = await supabase
        .from('agents')
        .select('*')
        .eq('phone_number', From)
        .single();

      if (error) {
        console.error('Failed to fetch agent data:', error);
        res.status(500).json({ error: 'Failed to fetch agent data' });
        return;
      }

      // Set agent-specific parameters
      thisInstruction = agentData.instructionforagent;
      thisTarget = agentData.conditionsofjobplanning;
      thisRingSeconds = agentData.ringseconds;
      thisAgentName = agentData.agentname;

      // Respond with TwiML to dial the specified company number with agent-specific timeout
      const twiml = new twilio.twiml.VoiceResponse();
      const dial = twiml.dial({
        action: `/api/receiveCall`,
        method: 'POST',
        timeout: thisRingSeconds
      });
      dial.number(agentData.compagnynumber);

      res.writeHead(200, { 'Content-Type': 'text/xml' });
      res.end(twiml.toString());
    } else {
      // Handling Dial action callback
      if (DialCallStatus !== 'completed') {
        // If the dialed number did not answer, connect to AI agent
        callActive = true;

        const twiml = new twilio.twiml.VoiceResponse();
        twiml.connect().stream({
          url: `wss://${req.headers.host}/api`
        });

        res.writeHead(200, { 'Content-Type': 'text/xml' });
        res.end(twiml.toString());

        // Start the WebSocket server
        startWebSocketServer(req.socket.server);
      } else {
        // Call was answered by the dialed number
        res.writeHead(200, { 'Content-Type': 'text/xml' });
        res.end('<Response></Response>');
      }
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}

function startWebSocketServer(server) {
  if (!wss) {
    wss = new WebSocketServer({ noServer: true });
    server.on('upgrade', (request, socket, head) => {
      if (authenticateWebSocket(request) && callActive) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    wss.on('connection', async (ws) => {
      console.log('WebSocket connected');

      // Send a welcome message via Text to Speech
      await new Promise(resolve => setTimeout(resolve, 2000));
      const welcomeMessage = "Hello! How can I assist you today?";
      await textToSpeech(welcomeMessage);

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
                console.log('Final transcription:', transcription);
                isSpeechDetected = false;
                try {
                  if (transcription !== "") {
                    await answerGeneration(transcription);
                  }
                } catch (error) {
                  console.error('Error while getting AI response:', error);
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
        console.log("WebSocket disconnected");
        resetCallState();
      });
    });
  }
}

function authenticateWebSocket(req) {
  // Implement authentication logic here
  return true;
}

async function answerGeneration(transcription) {
  try {
    // Generate AI response using OpenAI GPT
    const apiKey = process.env.OPENAI_API_KEY;
    const url = 'https://api.openai.com/v1/chat/completions';
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };

    const data = {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a telephone agent who has to make a call according to precise instructions. You must speak in English. 
          You must follow these instructions exactly: ${thisInstruction ? thisInstruction.replace(/'/g, "\\'") : ''}. During this call, your objective is to ${thisTarget ? thisTarget.replace(/'/g, "\\'") : ''}. 
          It's essential that you keep your answers very short.`
        },
        {
          role: 'user',
          content: transcription
        },
        ...conversationContext
      ],
      temperature: 0.7,
      max_tokens: 256,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    };

    const response = await axios.post(url, data, { headers });
    const responseText = response.data.choices[0].message.content;

    conversationContext.push(
      { role: 'user', content: transcription },
      { role: 'assistant', content: responseText }
    );

    console.log('AI response:', responseText);

    // Send response directly to Text to Speech
    await textToSpeech(responseText);

    return {
      response: responseText
    };
  } catch (error) {
    console.error('Error while calling APIs:', error);
    throw error;
  }
}

async function textToSpeech(text) {
  try {
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
            console.log('Audio data sent via WebSocket');
          } else {
            console.warn('WebSocket client not ready. State:', client.readyState);
          }
        });
      } else {
        console.error('No WebSocket clients connected to send audio data');
      }
    });

    response.on('error', (error) => {
      console.error('Error during Text to Speech:', error);
    });

    response.on('end', () => {
      console.log('End of Text to Speech');
    });
  } catch (error) {
    console.error('Error during speech synthesis with ElevenLabs:', error);
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
    console.error('No WebSocket clients connected to send clear message');
  }
}

function resetCallState() {
  callActive = false;
  callSid = null;
  streamSid = null;
  recognizeStream = null;
  conversationContext = []; // Reset conversation context
  console.log('Call state and conversation context reset');
}
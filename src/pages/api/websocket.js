// import { WebSocketServer } from 'ws';
// import { RealtimeTranscriber } from 'assemblyai';

// export default function handler(req, res) {
//   if (!res.socket.server.ws) {
//     console.log('Configuration du WebSocket');
//     const wss = new WebSocketServer({ noServer: true });
//     res.socket.server.ws = wss;

//     res.socket.server.on('upgrade', (request, socket, head) => {
//       if (authenticateWebSocket(request)) {
//         wss.handleUpgrade(request, socket, head, (ws) => {
//           wss.emit('connection', ws, request);
//         });
//       } else {
//         socket.destroy();
//       }
//     });

//     let transcriber = null;

//     wss.on('connection', async (ws) => {
//       console.log('WebSocket connecté');

//       if (!transcriber) {
//         transcriber = new RealtimeTranscriber({
//           apiKey: process.env.ASSEMBLYAI_API_KEY,
//           encoding: 'pcm_mulaw',
//           sampleRate: 8000
//         });

//         await transcriber.connect();
//       }

//       ws.on('message', (message) => {
//         const msg = JSON.parse(message);

//         if (msg.event === 'media') {
//           transcriber.sendAudio(Buffer.from(msg.media.payload, 'base64'));
//         }
//       });

//       transcriber.on('transcript.partial', (data) => {
//         console.log('Transcription partielle :', data.text);
//         if(data.text != ""){
//           console.log("Stop")
//         }
//       });

//       transcriber.on('transcript.final', (data) => {
//         console.log('Transcription finale :', data.text);
//       });

//       ws.on('close', async () => {
//         console.log('WebSocket déconnecté');
//         if (transcriber) {
//           await transcriber.close();
//           transcriber = null; // Réinitialiser le transcriber après la fermeture
//         }
//       });
//     });
//   }

//   res.end();
// }

// function authenticateWebSocket(req) {
//   // Implémentez votre propre mécanisme d'authentification ici
//   return true;
// }
import { WebSocketServer } from 'ws';
import { RealtimeTranscriber } from 'assemblyai';
import fs from 'fs';
import path from 'path';

let callActive = false;

export default function handler(req, res) {
  if (!res.socket.server.ws) {
    console.log('Configuration du WebSocket');
    const wss = new WebSocketServer({ noServer: true });
    res.socket.server.ws = wss;

    res.socket.server.on('upgrade', (request, socket, head) => {
      if (authenticateWebSocket(request)) {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    let transcriber = null;
    // Chargement et préparation de l'audio en base64
    const audioPath = path.resolve('./voice.ulaw'); 
    const audioBuffer = fs.readFileSync(audioPath);
    const encodedAudio = audioBuffer.toString('base64');
    let streamSid = null

    wss.on('connection', async (ws) => {
      console.log('WebSocket connecté');
      if (!transcriber) {
        transcriber = new RealtimeTranscriber({
          apiKey: process.env.ASSEMBLYAI_API_KEY,
          encoding: 'pcm_mulaw',
          sampleRate: 8000
        });

        await transcriber.connect();
      }

      ws.on('message', (message) => {
        const msg = JSON.parse(message);
      // console.log(msg.streamSid)
        streamSid = msg.streamSid
      // ws.send(JSON.stringify({
      //   event: 'media',
      //   streamSid: msg.streamSid, // Remplacez par votre Stream SID réel
      //   media: {
      //     payload: encodedAudio
      //   }
      // }));
        
        if (msg.event === 'media') {
          transcriber.sendAudio(Buffer.from(msg.media.payload, 'base64'));
        }
      });

      transcriber.on('transcript.partial', (data) => {
        console.log('Transcription partielle :', data.text);
        if (data.text != "") {
          console.log("Déclenchement du fichier audio");
          // Envoyer le fichier audio si la transcription partielle n'est pas vide
          ws.send(JSON.stringify({
            event: 'media',
            streamSid: streamSid, // Remplacez par votre Stream SID réel
            media: {
              payload: encodedAudio
            }
          }));
        }
      });

      transcriber.on('transcript.final', (data) => {
        console.log('Transcription finale :', data.text);
      });

      ws.on('close', async () => {
        console.log('WebSocket déconnecté');
        ws.close(1000, 'fermeture du socket')
        if (transcriber) {
          await transcriber.close();
          transcriber = null; // Réinitialiser le transcriber après la fermeture
        }
      });
    });
  }

  res.end();
}

function authenticateWebSocket(req) {
  // Implémentez votre propre mécanisme d'authentification ici
  return true;
}

function startCall() {
  callActive = true;
}

function endCall() {
  callActive = false;
  if (res.socket.server.ws) {
    res.socket.server.ws.close(); // Fermer le serveur WebSocket
    res.socket.server.ws = null;
  }
}
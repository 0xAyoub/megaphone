import twilio from 'twilio';
import { WebSocketServer } from 'ws';
import * as PlayHT from 'playht';
import Groq from "groq-sdk";
import { ElevenLabsClient } from 'elevenlabs';
import speech from '@google-cloud/speech';
import { createClient } from '@supabase/supabase-js';
import https from 'https';
import OpenAI from "openai";

// Créer un client Supabase avec le service role
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Store WebSocket servers by call SID
const wsServers = new Map();

// Modifier la structure pour stocker les sessions par numéro de téléphone
const activeSessions = new Map();

class CallSession {
  constructor(req, res) {
    // Initialize Twilio client per session
    this.twilioClient = twilio(process.env.ACCOUNT_SID, process.env.AUTH_TOKEN);
    
    // Initialize speech client per session  
    this.speechClient = new speech.SpeechClient();
    
    // Initialize Groq client per session
    this.groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    // Initialize ElevenLabs client per session
    this.elevenlabs = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });

    this.voiceId = "ZEBslWM12xCQWILoQtiP"; // English eleven_turbo_v2_5
    this.outputFormat = 'ulaw_8000';
    
    this.req = req;
    this.res = res;
    this.isSpeechDetected = false;
    this.smsSent = false; // Track if payment SMS has been sent
    this.isSpeaking = false;
    this.lastSpeechEndTime = null;
    this.shouldEndCall = false;
    this.averageWordsPerSecond = 2.5;
    this.lastResponseLength = 0; // Pour stocker la longueur de la dernière réponse
    this.endCallTimeout = null; // Pour gérer le timeout de fin d'appel

    this.callState = {
      callActive: false,
      wss: null,
      streamSid: null, 
      callSid: null,
      recognizeStream: null,
      conversationContext: [],
      thisInstruction: req.body.sequenceDetails?.instructions,
      thisSmsText: req.body.sequenceDetails?.sms_text,
      thisTone: req.body.sequenceDetails?.tone,
      thisContactDetails: req.body.contactDetails,
      fromNumber: req.body.sequenceDetails?.phone_number,
      paymentIntent: false, // Track payment intent
      isProcessingResponse: false // Flag to track if response is being processed
    };

    console.log(this.req.body.sequenceDetails?.phone_number);

    this.conversationId = null;
    this.startTime = null;

    this.pendingTranscriptions = []; // Ajouter pour stocker les transcriptions en attente
    this.processingTimeout = null; // Pour gérer le délai entre les messages
  }

  async processCall() {
    try {
      const { contactDetails, sequenceDetails } = this.req.body;
      
      // 1. Vérifier les données requises
      if (!contactDetails?.phone_number || !sequenceDetails?.phone_number) {
        throw new Error('Missing required phone numbers');
      }

      const to = contactDetails.phone_number;
      
      // 2. Vérifier le format des numéros de téléphone
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      if (!phoneRegex.test(to) || !phoneRegex.test(this.callState.fromNumber)) {
        throw new Error('Invalid phone number format');
      }

      // 3. Vérifier le numéro Twilio - Version simplifiée
      try {
        const incomingNumbers = await this.twilioClient.incomingPhoneNumbers.list();
        const phoneNumberExists = incomingNumbers.some(number => {
          // Normaliser les numéros pour la comparaison
          const normalizedNumber1 = number.phoneNumber.replace(/[- )(]/g, '');
          const normalizedNumber2 = this.callState.fromNumber.replace(/[- )(]/g, '');
          return normalizedNumber1 === normalizedNumber2;
        });
        
        if (!phoneNumberExists) {
          throw new Error('This phone number is not registered in your Twilio account');
        }
      } catch (twilioError) {
        console.log('Twilio verification error:', JSON.stringify(twilioError));
        // Ne pas bloquer l'appel si la vérification échoue
        console.log('Proceeding with call despite Twilio verification error');
      }

      // Récupérer l'ID de l'utilisateur depuis les détails de la séquence
      const userId = sequenceDetails.user_id;

      // Vérifier l'abonnement actif et les minutes restantes
      const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (subscriptionsError) {
        console.error('Error fetching subscriptions:', subscriptionsError);
        return this.res.status(500).json({ 
          error: 'Database error',
          message: 'Error fetching subscription details',
          type: 'system'
        });
      }

      const activeSubscription = subscriptions.find(sub => sub.status === 'active');

      if (!activeSubscription) {
        return this.res.status(400).json({ 
          error: 'No active subscription',
          message: 'You need an active subscription to make calls. Please subscribe to continue.',
          type: 'subscription'
        });
      }

      // Vérifier si le numéro de téléphone est configuré dans l'abonnement
      if (!activeSubscription.phone_number) {
        return this.res.status(400).json({
          error: 'No phone number configured',
          message: 'You need to configure a phone number in your subscription before making calls.',
          type: 'phone_number'
        });
      }

      // Vérifier les minutes restantes
      if (activeSubscription.remaining_minutes <= 0) {
        return this.res.status(400).json({
          error: 'No minutes remaining in your subscription. Please upgrade your plan.'
        });
      }

      const { data: conversation, error } = await supabaseAdmin
        .from('conversations')
        .insert({
          contact_id: contactDetails.id,
          sequence_id: sequenceDetails.id,
          conversation_data: [],
          status: 'not_started',
          start_time: new Date(),
          call_record: ''
        })
        .select()
        .single();

      if (error) throw error;
      
      this.conversationId = conversation.id;
      this.startTime = new Date();

      // Stocker la session avec le bon numéro de téléphone
      activeSessions.set(to, this);

      await this.initWebSocket();

      const call = await this.twilioClient.calls.create({
        twiml: `<Response>
          <Connect>
            <Stream url="wss://${this.req.headers.host}/api/ws/${encodeURIComponent(to)}"/>
          </Connect>
        </Response>`,
        to: to,
        from: this.callState.fromNumber
      });

      this.callState.callActive = true;
      this.callState.callSid = call.sid;
      wsServers.set(to, this.callState.wss);

      console.log('Call started with SID:', call.sid);
      this.res.status(200).json({ sid: call.sid });

      // Mettre à jour le statut et le call_sid de la conversation
      try {
        const { error: updateError } = await supabaseAdmin
          .from('conversations')
          .update({ 
            status: 'in_progress',
            call_sid: call.sid.toString() // Assurer que c'est bien un string
          })
          .eq('id', this.conversationId); // Utiliser l'ID de conversation qu'on a déjà

        if (updateError) {
          console.error('Error updating conversation:', updateError);
        } else {
          console.log('Successfully updated conversation status and call_sid for conversation:', this.conversationId);
        }
      } catch (error) {
        console.error('Error updating conversation:', error);
      }

    } catch (error) {
      console.error('Failed to process call:', error);
      
      // Vérifier si c'est une erreur d'authentification Twilio
      if (error.code === 20003 || error.status === 401) {
        this.res.status(500).json({
          error: 'Authentication Error',
          message: 'Technical error with our call system. Please contact technical support.',
          type: 'auth_error'
        });
        return;
      }

      this.res.status(500).json({ 
        error: 'Failed to process call',
        message: error.message,
        type: 'error'
      });
    }
  }

  async initWebSocket() {
    if (!this.callState.wss) {
      try {
        this.callState.wss = new WebSocketServer({ noServer: true });

        // Add upgrade handler if not already present
        if (!this.req.socket.server._webSocketUpgradeHandlerAdded) {
          this.req.socket.server.on('upgrade', (request, socket, head) => {
            const pathname = new URL(request.url, `wss://${request.headers.host}`).pathname;
            const phoneNumber = pathname.split('/').pop(); // Extraire le numéro de téléphone de l'URL
            
            // Trouver la session correspondante
            const session = activeSessions.get(decodeURIComponent(phoneNumber));
            
            if (session && session.callState.wss) {
              console.log('WebSocket connection established');
              session.callState.wss.handleUpgrade(request, socket, head, (ws) => {
                session.callState.wss.emit('connection', ws, request);
              });
            } else {
              socket.destroy();
            }
          });
          
          this.req.socket.server._webSocketUpgradeHandlerAdded = true;
        }

        this.callState.wss.on('connection', (ws) => {
          this.handleWebSocketConnection(ws);
        });
      } catch (error) {
        console.error('Error initializing WebSocket:', error);
        throw error;
      }
    }
  }

  handleWebSocketConnection(ws) {
    if (!this.callState.recognizeStream && this.callState.callActive) {
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

      this.callState.recognizeStream = this.speechClient
        .streamingRecognize(request)
        .on('error', error => {
          console.error('Speech recognition error:', error);
          this.callState.recognizeStream = null;
        })
        .on('data', async (data) => {
          if (data.results[0] && data.results[0].alternatives[0].transcript) {
            this.isSpeechDetected = true;
            this.sendClearMessage();
            
            if (data.results[0].isFinal) {
              const transcription = data.results[0].alternatives[0].transcript;
              console.log('Speech-to-text (human):', transcription);
              this.isSpeechDetected = false;
              
              // Ajouter la transcription au tableau des messages en attente
              this.pendingTranscriptions.push(transcription);

              // Réinitialiser le timeout
              if (this.processingTimeout) {
                clearTimeout(this.processingTimeout);
              }

              // Attendre un court instant pour d'autres messages potentiels
              this.processingTimeout = setTimeout(() => {
                if (!this.callState.isProcessingResponse && this.pendingTranscriptions.length > 0) {
                  const fullTranscription = this.pendingTranscriptions.join(' ');
                  this.pendingTranscriptions = []; // Vider le tableau
                  this.processResponse(fullTranscription);
                }
              }, 1000); // Attendre 1 seconde pour d'autres messages
            }
          }
        });
    }

    ws.on('message', async (message) => {
      try {
        if (!message) {
            console.log('Received null message');
            return;
        }

        let msg;
        try {
            msg = JSON.parse(message);
        } catch (parseError) {
            console.log('Failed to parse WebSocket message:', JSON.stringify(parseError));
            return;
        }
        
        if (!msg || !msg.streamSid || !msg.event) {
            console.log('Invalid message format:', JSON.stringify(msg));
            return;
        }
        
        this.callState.streamSid = msg.streamSid;
        
        if (msg.event === 'media' && this.callState.callActive && this.callState.recognizeStream) {
            if (this.callState.recognizeStream.writable && msg.media && msg.media.payload) {
                this.callState.recognizeStream.write(msg.media.payload);
            }
        }
      } catch (error) {
        console.log('Error processing WebSocket message:', JSON.stringify(error));
      }
    });

    ws.on('close', () => {
      console.log('WebSocket disconnected');
      this.resetCallState();
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  async processResponse(transcription) {
    this.callState.isProcessingResponse = true;
    try {
        // Attendre la réponse de l'IA avant d'analyser
        const answerResult = await this.answerGeneration(transcription);
        // Analyser l'échange avec la réponse de l'IA
        await this.analyzeLastExchange(transcription, answerResult.response);
        return answerResult;
    } catch (error) {
        console.error('Error processing response:', error);
    } finally {
        this.callState.isProcessingResponse = false;
    }
  }

  async analyzeLastExchange(userMessage, aiResponse) {
    try {
        // Première analyse pour le SMS de paiement (inchangée)
        const paymentAnalysis = await this.groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You are analyzing a debt collection conversation to determine if a payment SMS should be sent.
                    Return ONLY "true" if ANY of these conditions are met:
                    1. The debtor explicitly says they want to pay or receive payment instructions
                    2. The debtor asks about payment methods or how to pay
                    3. The agent mentions they will send an SMS with payment details
                    4. The debtor shows clear willingness to pay (phrases like "I can pay", "I will pay", "send me the details", etc.)
                    
                    Return "false" for all other cases.
                    IMPORTANT: Respond ONLY with "true" or "false", no other text.`
                },
                {
                    role: 'user',
                    content: `Latest exchange:
                    Debtor: "${userMessage}"
                    Agent: "${aiResponse}"
                    
                    Previous context:
                    ${this.callState.conversationContext.map(msg => 
                        `${msg.role === 'user' ? 'Debtor' : 'Agent'}: ${msg.content}`
                    ).join('\n')}`
                }
            ],
            model: "llama-3.3-70b-versatile",
            temperature: 0,
            max_tokens: 10
        });

        // Deuxième analyse pour la fin de conversation
        const shouldEndCallPrompt = `You are a conversation analyzer focused on detecting when a conversation should naturally end. You must be particularly attentive to farewell signals and polite conversation endings.

        Context: This is a debt collection call. The AI agent is trying to collect payment or arrange a payment plan.

        Analyze the conversation and return ONLY true or false:
        - Return true if ANY of these conditions are met:
          * The debtor uses ANY farewell phrases like "goodbye", "bye", "have a good day", "thanks, bye", etc.
          * The debtor indicates they need to go or leave ("I have to go", "I need to leave", "I'm busy", etc.)
          * The debtor shows signs of wanting to end the conversation ("that's all", "okay thanks", "alright then", etc.)
          * A payment arrangement has been successfully made and the debtor starts concluding
          * The debtor has clearly refused to pay and starts disengaging
          * The conversation has become circular or unproductive
          * The debtor has become hostile or uncooperative
          * The debtor has explicitly asked to end the call
          * There's a long pause or silence after a conclusive statement

        - Return false if:
          * The conversation is still actively ongoing
          * The debtor is still asking questions or seeking information
          * There's active negotiation happening
          * The debtor is engaged and responsive without any ending signals
          * Important points are still being discussed
          * No farewell or ending phrases have been used

        Previous conversation context: ${JSON.stringify(this.callState.conversationContext)}
        Last human message: ${userMessage}
        Last AI response: ${aiResponse}

        Return ONLY true or false without any explanation.`;

        const shouldEndCall = async () => {
            try {
                const completion = await this.groq.chat.completions.create({
                    messages: [
                        {
                            role: "system",
                            content: shouldEndCallPrompt
                        }
                    ],
                    model: "mixtral-8x7b-32768",
                    temperature: 0.1,
                    max_tokens: 5,
                });

                const response = completion.choices[0]?.message?.content?.toLowerCase().trim();
                console.log('Should end call?', response);
                return response === 'true';
            } catch (error) {
                console.error('Error in shouldEndCall:', error);
                return false;
            }
        };

        const shouldSendSMS = paymentAnalysis.choices[0]?.message?.content.toLowerCase().includes('true');
        const shouldEndCallResult = await shouldEndCall();

        console.log('Analysis Results:', {
            paymentIntent: shouldSendSMS,
            endCall: shouldEndCallResult
        });

        // Gérer l'envoi du SMS
        if (shouldSendSMS && !this.smsSent) {
            console.log('Preparing to send payment SMS...');
            const contactPhone = this.callState.thisContactDetails?.phone_number;
            
            if (!contactPhone) {
                console.error('No phone number found for contact');
                return false;
            }

            console.log('Sending SMS to:', contactPhone);
            
            try {
                await this.twilioClient.messages.create({
                    body: this.callState.thisSmsText,
                    from: this.callState.fromNumber,
                    to: contactPhone
                });
                this.smsSent = true;
                console.log('Payment SMS sent successfully to:', contactPhone);
            } catch (smsError) {
                console.error('Error sending SMS:', smsError);
            }
        }

        // Gérer la fin de l'appel
        if (shouldEndCallResult) {
            console.log('Conversation naturally concluded, preparing to end call...');
            this.shouldEndCall = true;

            if (!this.isSpeaking) {
                setTimeout(async () => {
                    try {
                        const call = await this.twilioClient.calls(this.callState.callSid)
                            .update({ status: 'completed' });
                        console.log('Call ended gracefully (no speech in progress)');
                    } catch (error) {
                        console.error('Error ending call:', error);
                    }
                }, 1000);
            }
        }

        return shouldSendSMS;
    } catch (error) {
        console.error('Error in conversation analysis:', error);
        return false;
    }
  }

  async answerGeneration(transcription) {
    try {
        // Sauvegarder le message utilisateur
        await this.saveConversationMessage({
            user: transcription,
            timestamp: new Date().toISOString()
        });

        // Générer la réponse AI
        const textCompletion = await this.groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `You are a virtual debt collection agent. Your task is to engage in a conversation with the debtor according to the following instructions: ${this.callState.thisInstruction.replace(/'/g, "\\'")}. 
                    You must speak in English and adhere to the Fair Debt Collection Practices Act (FDCPA). Your responses should be short, conversational, and respectful. 
                    Here are the details of the debtor:
                    - Name: ${this.callState.thisContactDetails.first_name} ${this.callState.thisContactDetails.last_name}
                    - Amount Due: ${this.callState.thisContactDetails.amount_due} ${this.callState.thisContactDetails.currency}
                    - Due Date: ${this.callState.thisContactDetails.due_date}
                    - Context: ${this.callState.thisContactDetails.context}
                    - Notes: ${this.callState.thisContactDetails.notes}

                    You should to make quick response with ${this.callState.thisTone}
                    
                    Your objective is to discuss the debt and explore options for payment while ensuring compliance with the FDCPA. You can't make a payment plan. When user are ready to pay, tell immediately to user you send a SMS (don't quote the SMS text just say a SMS will be sent). You should to write all amount number in letter.`
                },
                ...this.callState.conversationContext,
                {
                    role: 'user',
                    content: transcription.replace(/'/g, "\\'")
                }
            ],
            model: "llama-3.3-70b-versatile"
        });

        const responseText = textCompletion.choices[0]?.message?.content || "";
        console.log('AI Response:', responseText);

        // Sauvegarder la réponse AI
        await this.saveConversationMessage({
            assistant: responseText,
            timestamp: new Date().toISOString()
        });

        // Mettre à jour le contexte
        this.callState.conversationContext.push(
            { role: 'user', content: transcription },
            { role: 'assistant', content: responseText }
        );

        // Lancer la synthèse vocale
        await this.textToSpeech(responseText);

        return {
            response: responseText,
            transfer: false
        };
    } catch (error) {
        console.error('Error in answerGeneration:', error);
        throw error;
    }
  }

  estimateSpeechDuration(text) {
    const charactersPerSecond = 15;
    const characterCount = text.length;
    return (characterCount / charactersPerSecond) * 1000 + 2000;
  }

  async textToSpeech(text) {
    if (!text) {
        console.error('Empty text provided to textToSpeech');
        return;
    }

    this.isSpeaking = true;
    this.lastResponseLength = text.length;

    // Lancer l'estimation de durée en parallèle
    if (this.shouldEndCall) {
        this.scheduleCallEnd(text);
    }

    try {
        const response = await this.elevenlabs.textToSpeech.convertAsStream(this.voiceId, {
            model_id: 'eleven_turbo_v2_5',
            output_format: this.outputFormat,
            optimize_streaming_latency: 4,
            text,
            voice_settings: {
                stability: 0.0,
                similarity_boost: 1.0,
                style: 0.0,
                use_speaker_boost: true,
            }
        });

        if (!response) {
            console.error('No response from ElevenLabs');
            this.isSpeaking = false;
            return;
        }

        let chunkCount = 0;
        return new Promise((resolve, reject) => {
            response.on('data', (chunk) => {
                if (!chunk) return;
                chunkCount++;
                if (!chunk) {
                    console.log('Received empty chunk in textToSpeech');
                    return;
                }

                try {
                    const payload = chunk.toString('base64');
                    if (!payload) {
                        console.log('Failed to convert chunk to base64');
                        return;
                    }

                    const message = {
                        event: 'media',
                        streamSid: this.callState.streamSid,
                        media: {
                            payload: payload,
                        },
                    };

                    if (this.callState.wss && this.callState.wss.clients.size > 0) {
                        const messageString = JSON.stringify(message);
                        this.callState.wss.clients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN) {
                                client.send(messageString);
                            }
                        });
                    }
                } catch (error) {
                    console.log('Error processing text-to-speech chunk:', JSON.stringify(error));
                }
            });

            response.on('end', () => {
                this.isSpeaking = false;
                this.lastSpeechEndTime = Date.now();
                console.log(`Speech ended after ${chunkCount} chunks`);
                resolve();
            });

            response.on('error', (error) => {
                console.error('Error in Text to Speech:', error);
                this.isSpeaking = false;
                reject(error);
            });
        });
    } catch (error) {
        console.error('Error in voice synthesis with ElevenLabs:', error);
        this.isSpeaking = false;
    }
  }

  // Nouvelle fonction pour gérer la fin d'appel de manière asynchrone
  scheduleCallEnd(text) {
    // Annuler tout timeout précédent
    if (this.endCallTimeout) {
        clearTimeout(this.endCallTimeout);
    }

    const estimatedDuration = this.estimateSpeechDuration(text);
    console.log(`Estimated speech duration: ${estimatedDuration}ms (${text.length} characters)`);

    this.endCallTimeout = setTimeout(async () => {
        try {
            const call = await this.twilioClient.calls(this.callState.callSid)
                .update({ status: 'completed' });
            console.log('Call ended gracefully after estimated speech duration');
        } catch (error) {
            console.error('Error ending call:', error);
        }
    }, estimatedDuration);
  }

  sendClearMessage() {
    const clearMessage = JSON.stringify({
      event: 'clear',
      streamSid: this.callState.streamSid
    });

    if (this.callState.wss && this.callState.wss.clients.size > 0) {
      this.callState.wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(clearMessage);
        }
      });
    }
  }

  authenticateWebSocket(req) {
    return true;
  }

  async saveConversationMessage(message) {
    if (!this.conversationId) return;

    try {
      const { data: currentConversation } = await supabaseAdmin
        .from('conversations')
        .select('conversation_data')
        .eq('id', this.conversationId)
        .single();

      const updatedMessages = [
        ...(currentConversation.conversation_data || []),
        message
      ];

      await supabaseAdmin
        .from('conversations')
        .update({
          conversation_data: updatedMessages
        })
        .eq('id', this.conversationId);

    } catch (error) {
      console.error('Error saving conversation message:', error);
    }
  }

  async resetCallState() {
    const currentCallSid = this.callState.callSid;
    
    if (this.conversationId && currentCallSid) {
        try {
            // 1. Mettre à jour le statut de la conversation actuelle en 'completed'
            await supabaseAdmin
                .from('conversations')
                .update({
                    call_sid: currentCallSid,
                    end_time: new Date(),
                    status: 'completed'
                })
                .eq('id', this.conversationId);

            console.log(`Conversation ${this.conversationId} marked as completed`);

            // 2. Vérifier toutes les conversations de la séquence
            const { data: conversations, error: convError } = await supabaseAdmin
                .from('conversations')
                .select('status')
                .eq('sequence_id', this.req.body.sequenceDetails.id);

            if (!convError && conversations?.length > 0) {
                const allFinished = conversations.every(conv => 
                    ['completed', 'failed', 'no_answer', 'canceled'].includes(conv.status)
                );

                if (allFinished) {
                    const allSuccessful = conversations.every(conv => conv.status === 'completed');
                    
                    // 3. Mettre à jour le statut de la séquence si toutes les conversations sont terminées
                    await supabaseAdmin
                        .from('sequences')
                        .update({
                            status: allSuccessful ? 'completed' : 'failed',
                            completed_at: new Date().toISOString()
                        })
                        .eq('id', this.req.body.sequenceDetails.id);

                    console.log(`All conversations finished for sequence ${this.req.body.sequenceDetails.id}`);
                    console.log(`Sequence marked as ${allSuccessful ? 'completed' : 'failed'}`);
                }
            }

            // 4. Mettre à jour les statistiques d'utilisation
            const callDetails = await this.twilioClient.calls(currentCallSid).fetch();
            const actualDurationInSeconds = parseInt(callDetails.duration || 0);
            
            const { data: subscription, error: fetchError } = await supabaseAdmin
                .from('subscriptions')
                .select('*')
                .eq('user_id', this.req.body.sequenceDetails.user_id)
                .eq('status', 'active')
                .single();

            if (fetchError) throw fetchError;

            const newUsedSeconds = subscription.used_seconds + actualDurationInSeconds;
            const totalMinutesUsed = Math.floor(newUsedSeconds / 60);
            const newRemainingMinutes = subscription.minutes - totalMinutesUsed;

            await supabaseAdmin
                .from('subscriptions')
                .update({
                    used_seconds: newUsedSeconds,
                    remaining_minutes: Math.max(0, newRemainingMinutes),
                    updated_at: new Date().toISOString()
                })
                .eq('id', subscription.id)
                .eq('status', 'active');

            console.log("Call ended");
            console.log(`Call duration: ${actualDurationInSeconds}s`);
            console.log(`Total used seconds: ${newUsedSeconds}`);
            console.log(`Remaining minutes: ${newRemainingMinutes}`);

        } catch (error) {
            console.error('Error in resetCallState:', error);
        }
    }

    // 5. Nettoyer l'état
    this.callState.callActive = false;
    this.callState.recognizeStream = null;
    this.callState.wss = null;
    this.callState.streamSid = null;
    this.callState.callSid = null;
    this.callState.conversationContext = [];

    if (this.req.body.to) {
        activeSessions.delete(this.req.body.to);
        wsServers.delete(this.req.body.to);
    }
  }
}

export default function handler(req, res) {
  if (req.method === 'POST') {
    const session = new CallSession(req, res);
    
    try {
      session.processCall();
    } catch (error) {
      console.error('Error processing call:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}
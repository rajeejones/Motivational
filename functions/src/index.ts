// Cloud Functions for Firebase SDK 
import * as functions from 'firebase-functions';

// Firebase Admin SDK to access Firebase Realtime Database
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

// Configure twilio
const twilio = require('twilio');
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const accountSid = functions.config().twilio.sid
const authToken  = functions.config().twilio.token
const client = new twilio(accountSid, authToken);

const twilioNumber = '+14697784483';

// Uses Cron to send messages everyday
//const cronJob = require('cron').CronJob;

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
export const helloWorld = functions.https.onRequest((request, response) => {
 response.send("Hello from Firebase!");
});

// Read all numbers that are subscribed
// export const messageSubscribers = new cronJob('45 15 * * *', () => {
export const messageSubscribers = functions.https.onRequest((request, response) => {    
    // Get the message of the day
    admin.database().ref('/messageOfTheDay').once('value')
    .then(snapshot => {
        
        const messageToday = snapshot.val();

        // Get all the subscribed numbers for the day
        admin.database().ref('/subscribedNumbers').once('value')
        .then( snap => {
                
            const numbers = snap.val();
            console.log('Numbers for the day: ' + numbers);
            // For each number, send the message of the day
            for(const number of numbers) {
                
                const textMessage = {
                    body: `${messageToday}`,
                    to: number,  // Text to this number
                    from: twilioNumber // From a valid Twilio number
                };
                
                console.log('Sending: ' + textMessage);
                
                // Send the message
                client.messages.create(textMessage)
                .then(message => console.log(message.sid, 'successfully sent'))
                .catch(err => {
                    console.log(err)
                })
            }
            console.log('Done sending all messages for the day');
            response.redirect(303, snapshot.ref);
        }, error => {
            console.log('The read failed today with message: ' + error);
            response.end();
        });

    }, error => {
        console.log('Error reading messageOfTheDay. ' + error);
    });
});

// Respond to Incoming Twilio messages
export const reply = functions.https.onRequest((request, response) => {

    const twiml = new MessagingResponse();
    const message = twiml.message();

    console.log('Request body: ' + JSON.stringify(request.body));

    if(request.body.Body.trim() === 'Subscribe' || request.body.Body.trim() === 'subscribe') {
        console.log('Received a subscription text');
        const fromNum = request.body.From;
    
        admin.database().ref('/subscribedNumbers').once('value')
          .then( snap => {
            const twiml2 = new MessagingResponse();
            const message2 = twiml2.message();

            const numbers = snap.val();
            console.log('Subscription numbers so far: ' + numbers);
            
            if(numbers.indexOf(fromNum) !== -1) {
                message2.body('You already subscribed!');
                console.log('User already subscribed');
                //response.writeHead(200, {'Content-Type': 'text/xml'});
                response.end(twiml2.toString());
                return
            } else {
                message2.body('Thank you, you are now subscribed. Reply "STOP" to stop receiving updates.');
                console.log('New user subscribed!');
                
                admin.database().ref('/subscribedNumbers').push({fromNum}).then(snapshot => {
                    console.log('Added new subscriber to db');
                    //response.writeHead(200, {'Content-Type': 'text/xml'});
                    //response.end(twiml2.toString());
                    return
                });
                response.end(twiml2.toString());
            }
        });
    } else {
        message.body('Welcome to Daily Motivation. Text "Subscribe" receive updates.');
        console.log('Sent intro text');
    }

    response.writeHead(200, {'Content-Type': 'text/xml'});
    response.end(twiml.toString());
});

// // Take the text parameter passed to this HTTP endpoint and insert it into the
// // Realtime Database under the path /messages/:pushId/original
// export const addMessage = functions.https.onRequest((req, res) => {
//     // Grab the text parameter.
//     const original = req.query.text;
//     // Push the new message into the Realtime Database using the Firebase Admin SDK.
//     admin.database().ref('/messages').push({original: original}).then(snapshot => {
//       // Redirect with 303 SEE OTHER to the URL of the pushed object in the Firebase console.
//       res.redirect(303, snapshot.ref);
//     });
// });

// // Listens for new messages added to /messages/:pushId/original and creates an
// // uppercase version of the message to /messages/:pushId/uppercase
// export const makeUppercase = functions.database.ref('/messages/{pushId}/original')
// .onWrite(event => {
//   // Grab the current value of what was written to the Realtime Database.
//   const original = event.data.val();
//   console.log('Uppercasing', event.params.pushId, original);
//   const uppercase = original.toUpperCase();
//   // You must return a Promise when performing asynchronous tasks inside a Functions such as
//   // writing to the Firebase Realtime Database.
//   // Setting an "uppercase" sibling in the Realtime Database returns a Promise.
//   return event.data.ref.parent.child('uppercase').set(uppercase)
// });

// export const textMe = functions.database.ref('/messages/{pushId}/original')
// .onWrite( event => {
//     const original = event.data.val();
//     console.log('Texting with message', event.params.pushId, original);

//     const textMessage = {
//         body: `Just sending you this ${original} using Firebase and Twilio!`,
//         to: '+12149062468',  // Text to this number
//         from: twilioNumber // From a valid Twilio number
//     };

//     return client.messages.create(textMessage)
//     .then(message => console.log(message.sid, 'success'))
//     .catch(err => console.log(err))
    
// });

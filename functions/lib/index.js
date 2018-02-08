"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Cloud Functions for Firebase SDK 
const functions = require("firebase-functions");
// Configure Express
const express = require('express');
// Allow CORS
const cors = require('cors')({ origin: true });
const cookieParser = require('cookie-parser')();
const app = express();
// Firebase Admin SDK to access Firebase Realtime Database
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
// Configure twilio
const twilio = require('twilio');
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const accountSid = functions.config().twilio.sid;
const authToken = functions.config().twilio.token;
const client = new twilio(accountSid, authToken);
const twilioNumber = '+14697784483';
// Uses Cron to send messages everyday
//const cronJob = require('cron').CronJob;
const validateFirebaseIdToken = (req, res, next) => {
    console.log('Check if request is authorized with Firebase ID token');
    if ((!req.headers.authorization || !req.headers.authorization.startsWith('Bearer ')) &&
        !req.cookies.__session) {
        console.error('No Firebase ID token was passed as a Bearer token in the Authorization header.', 'Make sure you authorize your request by providing the following HTTP header:', 'Authorization: Bearer <Firebase ID Token>', 'or by passing a "__session" cookie.');
        res.status(403).send('Unauthorized');
        return;
    }
    let idToken;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        console.log('Found "Authorization" header');
        // Read the ID Token from the Authorization header.
        idToken = req.headers.authorization.split('Bearer ')[1];
    }
    else {
        console.log('Found "__session" cookie');
        // Read the ID Token from cookie.
        idToken = req.cookies.__session;
    }
    admin.auth().verifyIdToken(idToken).then(decodedIdToken => {
        console.log('ID Token correctly decoded', decodedIdToken);
        req.user = decodedIdToken;
        next();
    }).catch(error => {
        console.error('Error while verifying Firebase ID token:', error);
        res.status(403).send('Unauthorized');
    });
};
app.use(cors);
app.use(cookieParser);
app.use(validateFirebaseIdToken);
// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
exports.helloWorld = functions.https.onRequest((request, response) => {
    response.send("Hello from Firebase!");
});
// Read all numbers that are subscribed
// export const messageSubscribers = new cronJob('45 15 * * *', () => {
exports.messageSubscribers = functions.https.onRequest((request, response) => {
    // Get the message of the day
    admin.database().ref('/messageOfTheDay').once('value')
        .then(snapshot => {
        const messageToday = snapshot.val();
        // Get all the subscribed numbers for the day
        admin.database().ref('/subscribedNumbers').once('value')
            .then(snap => {
            const numbers = snap.val();
            console.log('Numbers for the day: ' + numbers);
            // For each number, send the message of the day
            for (const number of numbers) {
                const textMessage = {
                    body: `${messageToday}`,
                    to: number,
                    from: twilioNumber // From a valid Twilio number
                };
                console.log('Sending: ' + textMessage);
                // Send the message
                client.messages.create(textMessage)
                    .then(message => console.log(message.sid, 'successfully sent'))
                    .catch(err => {
                    console.log(err);
                });
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
exports.reply = functions.https.onRequest((request, response) => {
    // app.post('/reply', (request, response) => {
    const twiml = new MessagingResponse();
    const message = twiml.message();
    // message.body('Hello from Firebase in XML!');
    console.log('Request body: ' + JSON.stringify(request.body));
    if (request.body.Body.trim() === 'Subscribe' || request.body.Body.trim() === 'subscribe') {
        console.log('Received a subscription text');
        const fromNum = request.body.From;
        admin.database().ref('/subscribedNumbers').once('value')
            .then(snap => {
            const twiml2 = new MessagingResponse();
            const message2 = twiml2.message();
            const numbers = snap.val();
            console.log('Subscription numbers so far: ' + numbers);
            if (numbers.indexOf(fromNum) !== -1) {
                message2.body('You already subscribed!');
                console.log('User already subscribed');
                //response.writeHead(200, {'Content-Type': 'text/xml'});
                response.end(twiml2.toString());
                return;
            }
            else {
                message2.body('Thank you, you are now subscribed. Reply "STOP" to stop receiving updates.');
                console.log('New user subscribed!');
                admin.database().ref('/subscribedNumbers').push({ fromNum }).then(snapshot => {
                    console.log('Added new subscriber to db');
                    //response.writeHead(200, {'Content-Type': 'text/xml'});
                    //response.end(twiml2.toString());
                    return;
                });
                response.end(twiml2.toString());
            }
        });
    }
    else {
        message.body('Welcome to Daily Motivation. Text "Subscribe" receive updates.');
        console.log('Sent intro text');
    }
    // if (request.body.Body.toLowerCase() === 'subscribe' ) {
    //     message.body('Hello from Firebase in XML!');
    // } else {
    //     message.body('Welcome to Daily Motivation. Text "Subscribe" receive updates.');
    // }
    response.writeHead(200, { 'Content-Type': 'text/xml' });
    response.end(twiml.toString());
    // if( request.body.Body.trim().toLowerCase() === 'subscribe' ) {
    //     console.log('Received a subscription text');
    //     const fromNum = request.body.From;
    //   admin.database().ref('/subscribedNumbers').once('value')
    //   .then( snap => {
    //       const numbers = snap.val();
    //       console.log('Subscription numbers so far: ' + numbers);
    //       if(numbers.indexOf(fromNum) !== -1) {
    //         messResponse.message('You already subscribed!');
    //         console.log('User already subscribed');
    //         response.status(200).type('text/xml').end(response.toString());
    //         return
    //       } else {
    //         messResponse.message('Thank you, you are now subscribed. Reply "STOP" to stop receiving updates.');
    //         console.log('New user subscribed!');
    //         admin.database().ref('/subscribedNumbers').push({fromNum}).then(snapshot => {
    //             console.log('Added new subscriber to db');
    //             response.status(200).type('text/xml').end(response.toString());
    //             return
    //         });
    //       }
    //     });
    // } else {
    //     messResponse.message('Welcome to Daily Motivation. Text "Subscribe" receive updates.');
    //     console.log('Sent intro text');
    // }
    // response.writeHead(200, {
    //   'Content-Type':'text/xml'
    // });
    // response.end(response.toString());
    //exports.reply = (request, response) => {
    // console.log('Someone hit the reply url');
    // let isValid = true;
    // isValid = twilio.validateExpressRequest(request, authToken, {
    //     //`https://${region}-${projectId}.cloudfunctions.net/reply`
    //     url: 'https://us-central1-motivational-54422.cloudfunctions.net/reply'
    // });
    // if (!isValid) {
    //     console.log('Not valid request');
    //     response
    //     .type('text/plain')
    //     .status(403)
    //     .send('Twilio Request Validation Failed.')
    //     .end();
    //     return;
    // }
    //console.log('Created message object');
    // Prepare a response to the SMS message
    // const twiml = new MessagingResponse();
    // const message = twiml.message();
    // message.body('Hello from Firebase!');
    // response.writeHead(200, {'Content-Type': 'text/xml'});
    // response.end(twiml.toString());
    //smsResponse.message('Hello from Firebase!');
    // send the response
    // response.status(200)
    // .type('text/xml')
    // .end(response.toString());
    //};
    // if( request.body.Body.trim().toLowerCase() === 'subscribe' ) {
    //     console.log('Received a subscription text');
    //     const fromNum = request.body.From;
    //   admin.database().ref('/subscribedNumbers').once('value')
    //   .then( snap => {
    //       const numbers = snap.val();
    //       console.log('Subscription numbers so far: ' + numbers);
    //       if(numbers.indexOf(fromNum) !== -1) {
    //         messResponse.message('You already subscribed!');
    //         console.log('User already subscribed');
    //         response.status(200).type('text/xml').end(response.toString());
    //         return
    //       } else {
    //         messResponse.message('Thank you, you are now subscribed. Reply "STOP" to stop receiving updates.');
    //         console.log('New user subscribed!');
    //         admin.database().ref('/subscribedNumbers').push({fromNum}).then(snapshot => {
    //             console.log('Added new subscriber to db');
    //             response.status(200).type('text/xml').end(response.toString());
    //             return
    //         });
    //       }
    //     });
    // } else {
    //     messResponse.message('Welcome to Daily Motivation. Text "Subscribe" receive updates.');
    //     console.log('Sent intro text');
    // }
    // response.writeHead(200, {
    //   'Content-Type':'text/xml'
    // });
    // response.end(response.toString());
});
//exports.app = functions.https.onRequest(app);
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
//# sourceMappingURL=index.js.map
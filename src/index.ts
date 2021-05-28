//const escapeHtml = require('escape-html');

/**
 * HTTP Cloud Function.
 *
 * @param {Object} req Cloud Function request context.
 *                     More info: https://expressjs.com/en/api.html#req
 * @param {Object} res Cloud Function response context.
 *                     More info: https://expressjs.com/en/api.html#res
 */

//const { Readable } = require("stream")
import { Firestore } from '@google-cloud/firestore'
import { Storage } from '@google-cloud/storage'
//onst { PubSub } = require('@google-cloud/pubsub');
import { PubSub, Attributes } from '@google-cloud/pubsub'
//import {  } from '@google-cloud/functions'
// Create a new client
const firestore = new Firestore();
const storage = new Storage();
const pubsub = new PubSub();

// Destination
let bucket = storage.bucket('test_bucket_prequel');
let file = bucket.file('test_file.json');
const writestream = file.createWriteStream();

let batchSize = 1000;
let batchNumber = 0;
let offset = 0;
const maxSize = 20000;
const maxTime = 30000; // In milliseconds

//
const publish = async (req:{topic:{name:string }, attributes?:Attributes}) : Promise<string | void> => {
  console.log(req)
  if (!req.topic?.name || !req.attributes) {
    return Promise.reject('Missing data');
  }

  console.log(`Publishing message to topic ${req.topic.name}`);

  // References an existing topic
  const topic = pubsub.topic(req.topic.name);

  const messageObject = {
    data: {
      message: 'Recursive topic publish from script.',
    },
  };
  const messageBuffer = Buffer.from(JSON.stringify(messageObject), 'utf8');

  // Publishes a message
  try {
    await topic.publish(messageBuffer, req.attributes);
    //res.status(200).send('Message published.');
    return Promise.resolve('Message published');

  } catch (err) {
    console.error(err);
    //res.status(500).send(err);
    return Promise.reject(err);
  }
};

async function extractByBatch(e: any, context: any, callback: any) {
  // Start timer and start batching when near max runtime
  const startTime = Date.now();
  console.log(typeof e)
  console.log(typeof context)
  console.log(typeof callback)

  if ( e.attributes?.test === 'true' ) callback(null, 'Entered recursion!');

  if ( e.attributes?.batchSize ) batchSize = parseInt( e.attributes.batchSize )
  if ( e.attributes?.batchNumber ) batchNumber = parseInt( e.attributes.batchNumber )
  console.log(batchNumber)
  if ( e.attributes?.offset ) offset = parseInt( e.attributes.offset )


  const collectionQuery = firestore.collection('testCollectionImport');

  writestream.write('[');

  let complete = true;
  let i;
  for (i = offset; i < maxSize; i = i + batchSize) {
    console.log("loop:", i);
    if ( i !== 0 ) writestream.write(',');
    const collectionDocuments = await collectionQuery.limit(batchSize).offset(i).get();
    if ( !collectionDocuments || collectionDocuments.size === 0 ) { break; }
    //const checkpointOne = Date.now();
    //console.log("loading time: ", checkpointOne - start);
    collectionDocuments.forEach(documentSnapshot => {
      writestream.write(JSON.stringify(documentSnapshot.data(), null, 2));
    })
    offset = i;
    const runTime = Date.now() - startTime;
    //console.log("writing time: ", checkpointTwo - checkpointOne);
    if (runTime > maxTime) {
      complete = false
      break;
    }
  }

  writestream.write(']');
  writestream.end();

  if ( complete === false ) {
    console.log("Run new process, pick up at: ", offset)
    await publish({
      topic: {name: context.resource.name},
      attributes: {
        batchNumber: '25',
        test: 'true'
      }
    })
  }

  callback(null, 'Success!');
}

export const firestoreExtract = (e: any, context: any, callback: any) => extractByBatch(e, context, callback);

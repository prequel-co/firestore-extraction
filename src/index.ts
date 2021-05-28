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



let batchSize = 1000;
let batchNumber = 0;
let offset = 0;
const maxSize = 1000000; // Arbitrary limit to prevent accidental overrun
const maxTime = 480000; // In milliseconds

// Publish function to kick off a new cloud function if approaching timeout
const publish = async ( req: { topic: { name:string }, attributes?:Attributes }) : Promise<string | void> => {
  if (!req.topic?.name || !req.attributes) {
    return Promise.reject(new Error('Missing data'));
  }

  console.log(`Publishing message to topic ${req.topic.name}`);

  // References an existing topic
  const topic = pubsub.topic(req.topic.name);

  const messageObject = {
    data: {
      message: 'Recursive topic publish from script',
    },
  };
  const messageBuffer = Buffer.from(JSON.stringify(messageObject), 'utf8');

  // Publishes a message
  try {
    await topic.publish(messageBuffer, req.attributes);
    return Promise.resolve('Message published');

  } catch (err) {
    console.error(err);
    return Promise.reject(err);
  }
};

const extractByBatch = async (e: any, context: any, callback: any) => {
  // Start timer and start batching when near max runtime
  const startTime = Date.now()

  if ( e.attributes?.batchSize ) batchSize = parseInt( e.attributes.batchSize )
  if ( e.attributes?.batchNumber ) batchNumber = parseInt( e.attributes.batchNumber )
  console.log(batchNumber)
  if ( e.attributes?.offset ) offset = parseInt( e.attributes.offset )

  let bucketName = 'test_bucket_prequel'
  if ( e.attributes?.bucketName ) bucketName = e.attributes.bucketName

  let fileName = 'test_file'
  if ( e.attributes?.fileName ) fileName = e.attributes.fileName

  let collectionName = 'testCollectionImport'
  if ( e.attributes?.collectionName ) collectionName = e.attributes.collectionName

  let numberedFileName = fileName;
  if ( batchNumber ) numberedFileName = fileName + "_" + batchNumber

  // Destination
  let bucket = storage.bucket(bucketName)
  let file = bucket.file(numberedFileName + '.json')
  const writestream = file.createWriteStream()


  const collectionQuery = firestore.collection(collectionName)

  // Manually begin the JSON array
  writestream.write('[')

  let isFirstBatch = true
  let isComplete = true // Start by assuming full db is read
  for (let i = offset; i <= maxSize; i = i + batchSize) {

    // Check current runtime
    const runTime = Date.now() - startTime

    // If the current runtime is over the alloted limit, stop processing
    if (runTime > maxTime) {
      offset = i // Record the latest offset
      isComplete = false // If time is out, break out of loop and continue in new function
      break
    }

    // Fetch the next batch of documents
    const collectionDocuments = await collectionQuery.limit(batchSize).offset(i).get()

    // If the batch of documents is empty or does not exist, leave the batch loop
    if ( !collectionDocuments || collectionDocuments.size === 0 ) break

    // Write each of the JSON objects to the output file
    collectionDocuments.docs.forEach((doc, index) => {
      if (index !== 0 || !isFirstBatch) writestream.write(',') // Manually comma separate objects
      writestream.write(JSON.stringify(doc.data(), null, 2))
    })

    isFirstBatch = false
  }

  // Wrap up manual JSON array 
  writestream.write(']')
  writestream.end()

  // If the entire set of documents did not complete, recursively start a new function
  if ( !isComplete ) {
    try {
      await publish({
        topic: {name: context.resource.name},
        attributes: {
          ...(batchSize ? { batchSize: String(batchSize) } : undefined),
          batchNumber: String(batchNumber + 1), // Increment the batch counter
          offset: String(offset), // Pass on the starting offset
          bucketName: bucketName,
          fileName: fileName,
          collectionName: collectionName
        }
      })
    } catch (err) {
      console.error(err);
      callback(err);
    }
  }

  callback(null, 'Success!');
}

export const firestoreExtract = (e: any, context: any, callback: any) => extractByBatch(e, context, callback);

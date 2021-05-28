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


// Publish function to kick off a new cloud function if approaching timeout
const publish = async ( req: { topic: { name:string }, attributes?:Attributes }) : Promise<string | void> => {
  if (!req.topic?.name || !req.attributes) {
    return Promise.reject(new Error('Missing data'))
  }

  console.log(`Publishing message to topic ${req.topic.name}`)

  // References an existing topic
  const topic = pubsub.topic(req.topic.name)

  const messageObject = {
    data: {
      message: 'Recursive topic publish from script',
    },
  };
  const messageBuffer = Buffer.from(JSON.stringify(messageObject), 'utf8')

  // Publishes a message
  try {
    await topic.publish(messageBuffer, req.attributes)
    return Promise.resolve('Message published')

  } catch (err) {
    console.error(err)
    return Promise.reject(err)
  }
};


 interface CustomAttributes {
   collectionName: string,
   bucketName: string,
   batchSize?: string, // Optional, defaults to 1000
   maxDepth?: string, // Optional, defaults to 100
   maxTime?: string, // Optional, defaults to 540 sec
   maxSize?: string, // Optional, defaults to 1m
   batchNumber?: string, // Ignore, only used in recursion
   depth?: string, // Ignore, only used in recursion
   offset?: string, // Ignore, only used in recursion
 }


 // Set defaults
 let batchSize = 1000
 const maxDepth = 100
 const maxTime = 480000 // In milliseconds
 const maxSize = 1000000 // Arbitrary limit to prevent accidental overrun
 let batchNumber = 0
 let depth = 0
 let offset = 0



const extractByBatch = async (e: any, context: any, callback: any) => {
  // Start timer and start batching when near max runtime
  const startTime = Date.now()

  console.log(e)

  const attributes : CustomAttributes = e?.attributes
  if ( !attributes || !attributes.collectionName || !attributes.bucketName ){
    const err = new Error("Missing required attributes (collectionName, bucketName)")
    console.error(err)
    callback(err)
    return
  }

  if ( attributes.depth ) depth = parseInt(attributes.depth)
  if ( depth > maxDepth ) {
    const err = new Error("Max depth exceeded")
    console.error(err)
    callback(err)
    return
  }

  //let collectionName = 'testCollectionImport'
  const collectionNameRaw = attributes.collectionName
  const collectionNameArray = collectionNameRaw.split(",")
  if ( collectionNameArray && collectionNameArray.length > 1 ){
    for ( let collection in collectionNameArray ){
      try {
        await publish({
          topic: {name: context.resource.name},
          attributes: {
            ...(e.attributes),
            fileName: collection,
            collectionName: collection,
            depth: String(depth + 1)
          }
        })
      } catch (err) {
        console.error(err)
        callback(err)
        return
      }
    }
    console.log('Array of collections found')
    callback(null, 'Array of collectons found')
    return
  }
  const collectionName = collectionNameArray[0]

  const bucketName = attributes.bucketName


  if ( attributes.batchSize ) batchSize = parseInt( attributes.batchSize )
  if ( attributes.batchNumber ) batchNumber = parseInt( attributes.batchNumber )
  if ( attributes.offset ) offset = parseInt( e.attributes.offset )

  const fileName = collectionName
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
          collectionName: collectionName,
          depth: String(depth + 1)
        }
      })
    } catch (err) {
      console.error(err)
      callback(err)
    }
  }

  callback(null, 'Success!')
  return
}

export const firestoreExtract = (e: any, context: any, callback: any) => extractByBatch(e, context, callback);

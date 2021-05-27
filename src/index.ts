//const escapeHtml = require('escape-html');

/**
 * HTTP Cloud Function.
 *
 * @param {Object} req Cloud Function request context.
 *                     More info: https://expressjs.com/en/api.html#req
 * @param {Object} res Cloud Function response context.
 *                     More info: https://expressjs.com/en/api.html#res
 */

const { Readable } = require("stream")
const { Firestore } = require('@google-cloud/firestore');
const { Storage } = require('@google-cloud/storage');
const { PubSub } = require('@google-cloud/pubsub');


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
const maxSize = 20000;
const maxTime = 30000; // In milliseconds

// Extract function
async function extract(event, context, callback) {
  console.log("hmm weird...");

  // const collectionList = firestore.listCollections();
  // collectionList.forEach((col, index) => {
  //   console.log(col)
  // })
  // const collectionReference = firestore.collection('testCollectionImport');
  // const testDocuments = await collectionReference.get();
  // const testDocumentData = testDocuments.docs.map(d => d.data());

  const collectionQuery = firestore.collection('testCollectionImport');

  let count = 0;

  writestream.write('[');

  collectionQuery.stream().on('data', (doc) => {
    //console.log(`Found document with name '${doc.id}'`);
      if (count > 0) writestream.write(',');
      writestream.write(JSON.stringify(doc, null, 2));
      ++count;

  }).on('end', () => {
    if ((count % 1000) === 0) console.log(`Total count is ${count}`);
  });

  writestream.write(']');
  writestream.end();

  callback(null, 'Success!');
}


const publish = async (req, res) => {
  if (!req.body.topic || !req.body.message) {
    res
      .status(400)
      .send(
        'Missing parameter(s); include "topic" and "message" properties in your request.'
      );
    return;
  }

  console.log(`Publishing message to topic ${req.body.topic}`);

  // References an existing topic
  const topic = pubsub.topic(req.body.topic);

  const messageObject = {
    data: {
      message: req.body.message,
    },
  };
  const messageBuffer = Buffer.from(JSON.stringify(messageObject), 'utf8');

  // Publishes a message
  try {
    await topic.publish(messageBuffer);
    res.status(200).send('Message published.');
  } catch (err) {
    console.error(err);
    res.status(500).send(err);
    return Promise.reject(err);
  }
};

async function extractByBatch(e, context, callback) {
  // Start timer and start batching when near max runtime
  const startTime = Date.now();

  if ( !!e.attributes.batchSize ) batchSize = parseInt( e.attributes.batchSize )
  if ( !!e.attributes.batchNumber ) batchNumber = parseInt( e.attributes.batchNumber )
  let offset = 0;
  if ( !!e.attributes.offset ) offset = parseInt( e.attributes.offset )


  const collectionQuery = firestore.collection('testCollectionImport');

  writestream.write('[');
  console.log("TESTING data DUMP");

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
  }

  callback(null, 'Success!');
}

exports.firestoreExtract = (e, context, callback) => extractByBatch(e, context, callback);

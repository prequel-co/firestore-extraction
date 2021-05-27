const escapeHtml = require('escape-html');

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

// Create a new client
const firestore = new Firestore();
const storage = new Storage();

// Destination
const bucket = storage.bucket('test_bucket_prequel');
const file = bucket.file('test_file.json');
const writestream = file.createWriteStream();

const batchSize = 10000;
const maxSize = 100000;

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


const writeBatch = async (collectionQ, batchStart) => {
  console.log("writing batch");

  //console.log(`Waiting: ${milliseconds / 1000} seconds.`);
  return new Promise((resolve) => {
    //console.log("cq", collectionQ);
    const collectionDocuments = collectionQ.limit(batchSize).offset(batchStart).get();
    //console.log("cd", collectionDocuments);
    if (collectionDocuments && collectionDocuments.length > 0) {
      collectionDocuments.forEach(documentSnapshot => {
        writestream.write(JSON.stringify(doc, null, 2));
      })
      resolve(batchStart)
    } else {
      resolve(undefined)
    }
  })
}

const writeNextBatch = async (collectionQ, batchStart) => {
  console.log("writing next batch");
  return new Promise((resolve) => {
    writeBatch(collectionQ, batchStart).then(lastBatchStart => {
      if( lastBatchStart ) {
        writeNextBatch( lastBatchStart + 1000 )
      }
      resolve()
    })
  })

}

async function extractByBatch(event, context, callback) {

  const collectionQuery = firestore.collection('testCollectionImport');

  let count = 0;

  writestream.write('[');
  console.log("TESTING data DUMP");

  //await writeNextBatch(collectionQuery, 0);
  let i;
  for (i = 0; i < maxSize; i = i + batchSize) {
    console.log("loop:", i);
    if ( i !== 0 ) writestream.write(',');
    const start = Date.now();
    const collectionDocuments = await collectionQuery.limit(batchSize).offset(i).get();
    const checkpointOne = Date.now();
    console.log("loading time: ", checkpointOne - start);
    collectionDocuments.forEach(documentSnapshot => {
        writestream.write(JSON.stringify(documentSnapshot.data(), null, 2));
      })
    )
    const checkpointTwo = Date.now();
    console.log("writing time: ", checkpointTwo - checkpointOne);
  }

  // collectionQuery.limit(batchSize).get().then(querySnapshot => {
  //   querySnapshot.forEach(documentSnapshot => {
  //     writestream.write(JSON.stringify(doc, null, 2));
  //   })
  // })
  //
  // collectionQuery.stream().on('data', (doc) => {
  //   //console.log(`Found document with name '${doc.id}'`);
  //     if (count > 0) writestream.write(',');
  //     writestream.write(JSON.stringify(doc, null, 2));
  //     ++count;
  //
  // }).on('end', () => {
  //   if ((count % 1000) === 0) console.log(`Total count is ${count}`);
  // });

  writestream.write(']');
  writestream.end();

  callback(null, 'Success!');
}

exports.firestoreExtract = (e, context, callback) => extractByBatch(e, context, callback);

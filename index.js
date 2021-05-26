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

// Extract function
async function extract(event, context, callback) {
  // const collectionList = firestore.listCollections();
  // collectionList.forEach((col, index) => {
  //   console.log(col)
  // })
  const collectionReference = firestore.collection('testCollection');
  const testDocuments = await collectionReference.get();
  const testDocumentData = testDocuments.docs.map(d => d.data());

  writestream.write('[');
  testDocumentData.forEach((doc, index) => {
    if (index > 0) writestream.write(',');
    writestream.write(JSON.stringify(doc, null, 2));
  });
  writestream.write(']');
  writestream.end();

  callback(null, 'Success!');
}

exports.firestoreExtract = (e, context, callback) => extract(e, context, callback);

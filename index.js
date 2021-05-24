const escapeHtml = require('escape-html');

/**
 * HTTP Cloud Function.
 *
 * @param {Object} req Cloud Function request context.
 *                     More info: https://expressjs.com/en/api.html#req
 * @param {Object} res Cloud Function response context.
 *                     More info: https://expressjs.com/en/api.html#res
 */
// exports.firestoreExtract = (req, res) => {
//   res.send(`Hello ${escapeHtml(req.query.name || req.body.name || 'World')}!`);
// };

// const { Firestore } = require('@google-cloud/firestore');
//
// // Create a new client
// const firestore = new Firestore();
//
// //const client = new firestore.v1.FirestoreAdminClient();
// // Replace BUCKET_NAME
// const bucket = 'gs://test_bucket_prequel/test_replica'
//
//
// // async function limitToLastQuery() {
// //   const collectionReference = firestore.collection('cities');
// //   const cityDocuments = await collectionReference
// //     .orderBy('name')
// //     .limitToLast(2)
// //     .get();
// //   const cityDocumentData = cityDocuments.docs.map(d => d.data());
// //   cityDocumentData.forEach(doc => {
// //     console.log(doc.name);
// //   });
// // }
// // limitToLastQuery();
//
// exports.firestoreExtract = async (event, context) => {
//   // const databaseName = client.databasePath(
//   //   'prequel-dev',
//   //   '(default)'
//   // );
//   const collectionReference = firestore.collection('testCollection');
//   const collectionDocuments = await collectionReference
//     .get();
//   const collectionDocumentData = collectionDocuments.docs.map(d => d.data());
//   cityDocumentData.forEach(doc => {
//     console.log(doc.name);
//   })
// }
//
//
//
// exports.firestoreExtract2 = (event, context) => {
//   const databaseName = client.databasePath(
//     'prequel-dev',
//     '(default)'
//   );
//
//   return client
//     .exportDocuments({
//       name: databaseName,
//       outputUriPrefix: bucket,
//       // Leave collectionIds empty to export all collections
//       // or define a list of collection IDs:
//       // collectionIds: ['users', 'posts']
//       collectionIds: [],
//     })
//     .then(responses => {
//       const response = responses[0];
//       console.log(`Operation Name: ${response['name']}`);
//       return response;
//     })
//     .catch(err => {
//       console.error(err);
//     });
// };

//const fs = require('fs');
const { Readable } = require("stream")
const {Firestore} = require('@google-cloud/firestore');
const {Storage} = require('@google-cloud/storage');

// Create a new client
const firestore = new Firestore();
const storage = new Storage();
const s = new Readable();
s._read = () => {};

const myBucket = storage.bucket('test_bucket_prequel');
const file = myBucket.file('test_replica/testFile.json');
//const ws = file.createWriteStream();

//const bucket = 'gs://test_bucket_prequel/test_replica'

async function extract() {
  const collectionReference = firestore.collection('testCollection');
  const testDocuments = await collectionReference
    .get();
  const testDocumentData = testDocuments.docs.map(d => d.data());
  s.push('[');
  testDocumentData.forEach((doc, index) => {
    if (index > 0) s.push(',');
    s.push(JSON.stringify(doc, null, 2));
  });
  s.push(']');

  s.push(null);
  s.pipe(file.createWriteStream())
  .on('error', function(err) {})
  .on('finish', function() {
    // The file upload is complete.
  });
}

exports.firestoreExtract = (event, context) => extract();

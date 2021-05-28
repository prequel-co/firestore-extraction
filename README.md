# firestore-extraction

npm run build

gcloud functions deploy firestoreExtract --runtime nodejs12 --trigger-topic initiateFirestoreExport

gcloud pubsub topics publish initiateFirestoreExport --attribute=collectionName=testCollectionImport,bucketName=test_bucket_prequel

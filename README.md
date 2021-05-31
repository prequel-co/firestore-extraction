# Firestore Extraction Tool

This Firestore Extraction Tool is a node module built to extract JSON data from a Firestore db and write it to .json files in a GCP bucket. This is useful for non-proprietary filetype backups and other use cases in which non-proprietary or non-encoded data types are important. 

## How It Works

1. firestore-extraction contains a short script that reads a Firestore db and writes the query contents to a write stream in a GCP bucket in batches. 
2. This script is designed to run via cloud functions. Due to the maximum cloud function runtime of 9 minutes, the script batches Firestore queries and will write a file and recursively kickoff a new query when approaching the time limit.
3. The cloud functions can be triggered via a scheduled PubSub Trigger and configured (source Firestore collections, destination bucket name) via Trigger attributes. 

## Usage

## Config 

There are two required attributes needed to run the cloud function

1. Bucket name = "gs://SOME_BUCKET_NAME"
2. Collection(s) = "collectionName collectionName2" (space delimited)
3. GCP Project ID 

### Build and Deploy Cloud Function

1. Install dependencies and compile the module:
  
  ```sh
  npm install
  npm run build
  ```
  
2. Deploy the function 

  ```sh
  gcloud functions deploy firestoreExtract \
      --runtime nodejs12 \
      --timeout 540 \
      --trigger-topic initiateFirestoreExport 
  ```
  
3. (Optional: Test the function)
  
  ```sh
  gcloud pubsub topics publish initiateFirestoreExport \
      --attribute=collectionName=testCollection,bucketName=test_bucket
  ```
  
### Schedule Cloud Function

  ```sh
  gcloud scheduler jobs create pubsub myjob \
      --schedule "0 1 * * 0" \
      --topic initiateFirestoreExport \
      --attribute=collectionName=testCollection,bucketName=test_bucket
  ```

### Grant Permissions

1. Assign the Cloud Datastore Import Export Admin role. Replace PROJECT_ID, and run the following command:

```sh
 gcloud projects add-iam-policy-binding PROJECT_ID \
    --member serviceAccount:PROJECT_ID@appspot.gserviceaccount.com \
    --role roles/datastore.importExportAdmin
```
2. Assign the Storage Admin role on your bucket. Replace PROJECT_ID and BUCKET_NAME, and run the following command:

```sh
gsutil iam ch serviceAccount:PROJECT_ID@appspot.gserviceaccount.com:admin \
    gs://BUCKET_NAME
```
    



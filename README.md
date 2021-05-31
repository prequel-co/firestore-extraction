# Firestore Extraction Tool

This Firestore Extraction Tool is a node module built to extract JSON data from a Firestore db and write it to .json files in a GCP bucket. This is useful for non-proprietary backups and other use cases in which non-proprietary or encoded data types are important. 

## How It Works

1. firestore-extraction contains a short script that reads a Firestore db and writes the query contents to a write stream in a GCP bucket in batches. 
2. This script is designed to run via cloud functions. Due to the maximum cloud function runtime of 9 minutes, the script batches Firestore queries and will write a file and recursively kickoff a new query when approaching the time limit.
3. The cloud functions can be triggered via a scheduled PubSub Trigger and configured (source Firestore collections, destination bucket name) via Trigger attributes. 

## Usage

### Build and Deploy Cloud Function

<details><summary><b>Show instructions</b></summary>

1. Install dependencies and compile the module:
  
  ```sh
  $ npm install
  $ npm run build
  ```
  
2. Deploy the function 

  ```sh
  $ gcloud functions deploy firestoreExtract --runtime nodejs12 --timeout 540 --trigger-topic initiateFirestoreExport 
  ```
  
3. (Optional: Test the function)
  
  ```sh
  $ gcloud pubsub topics publish initiateFirestoreExport --attribute=collectionName=testCollection,bucketName=test_bucket
  ```
  
</details>

### Schedule Cloud Function

### Grant Permissions

## Config 

There are two required attributes needed to run the cloud function

1. Bucket name
2. Collection(s)

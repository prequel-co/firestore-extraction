# Firestore Extraction Tool

This Firestore Extraction Tool is a node module built to extract JSON data from a Firestore db and write it to .json files in a GCP bucket. This is useful for non-proprietary filetype backups and other use cases in which non-proprietary or non-encoded data types are important. 

## How It Works

1. firestore-extraction contains a short script that reads a Firestore db and writes the query contents to a write stream in a GCP bucket in batches. 
2. This script is designed to run via cloud functions. Due to the maximum cloud function runtime of 9 minutes, the script batches Firestore queries and will write a file and recursively kickoff a new query when approaching the time limit.
3. The cloud functions can be triggered via a scheduled PubSub Trigger and configured (source Firestore collections, destination bucket name) via Trigger attributes. 

## Usage

## Config 

There are a few required parameters needed to configure the cloud function

1. Bucket name = "gs://YOUR_BUCKET_NAME"
2. Collection name(s) = "collectionName collectionName2" (space delimited)
3. GCP Project ID 
4. Function name = "firestoreExtract" (needs to match function exported in cloud function source)
5. Topic name (can use your own name or the suggested name)

To set these variables once for the following instructions, use these env vars

```sh
BUCKET_NAME="your_bucket_name" 
COLLECTION_NAME="your_firestore_collection_name" 
PROJECT_ID="your_gcp_project_id"
FUNCTION_NAME="firestoreExtract"
TOPIC_NAME="initiateFirestoreExtract"

```

> ***Note:***
>- *BUCKET_NAME should not include the leading 'gs:'*
>- *COLLECTION_NAME can include multiple collections if separated by spaces e.g. "collection_1 collection_2"*



### Prerequisites

1. [Install gcloud](https://cloud.google.com/sdk/docs/install)

### Build and Deploy Cloud Function

1. Clone this repo

```sh
git clone https://github.com/prequel-co/firestore-extraction.git
```
 
2. Navigate into the parent folder, install dependencies, and compile the module:
  
  ```sh
  cd firestore-extraction
  npm install
  npm run build
  ```
  
3. Deploy the function 

  ```sh
  gcloud functions deploy $FUNCTION_NAME \
      --runtime nodejs12 \
      --timeout 540 \
      --trigger-topic $TOPIC_NAME
  ```
  
4. (Optional: Test the function)
  
  ```sh
  gcloud pubsub topics publish $TOPIC_NAME \
      --attribute=collectionName=$COLLECTION_NAME,bucketName=$BUCKET_NAME
  ```
  
### Schedule Cloud Function

  ```sh
  gcloud scheduler jobs create pubsub myjob \
      --schedule "0 2 * * *" \
      --topic $TOPIC_NAME \
      --attribute=collectionName=$COLLECTION_NAME,bucketName=$BUCKET_NAME
  ```

### Grant Permissions

1. Assign the Cloud Datastore Import Export Admin role. Replace PROJECT_ID, and run the following command:

```sh
 gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com \
    --role roles/datastore.importExportAdmin
```
2. Assign the Storage Admin role on your bucket. Replace PROJECT_ID and BUCKET_NAME, and run the following command:

```sh
gsutil iam ch serviceAccount:$PROJECT_ID@appspot.gserviceaccount.com:admin \
    gs://$BUCKET_NAME
```
    



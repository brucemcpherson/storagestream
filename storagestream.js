
const Storage = require('@google-cloud/storage').Storage;
const secrets = require('./private/visecrets');
var sts = require('string-to-stream');
const request = require('request');
const fs = require('fs');
/**
 * create the cloud storage stream
 * the credentials/bucket name and filename are in the secrets file
 * @param {string} name the filename to stream from
 */
const createStorageStream = async ({ name }) => {
  console.log('creating stream', name);
  // get storage params
  const creds = secrets.getGcpCreds();
  const { credentials, bucketName } = creds;
  const { projectId } = credentials;
	const storage = new Storage({
		projectId,
    credentials
	});

  const bucket = storage.bucket(bucketName);

  // we'll actually be streaming to/from  this blob
	return bucket.file(name);
};
/**
 * convert a string or objects to a stream
 */
const streamContent = async ({ name, content }) => {
  let mimeType = "";
  if(typeof content === 'object') {
    content = JSON.stringify(content);
    mimeType = "application/json";
  }
  const writeStream = await createWriteStream({ name, mimeType });
  return new Promise ((resolve, reject) => {
    console.log('streaming ', mimeType, ' to ', name);
    sts(content).pipe(writeStream).on('finish', () => {
      resolve(name);
      console.log(name, 'uploaded to storage');
    });
  });

};

/**
 * get content from storage
 * @param {string} name the file to get
 */
const getContent = async ({ name }) => {
  const readStream = await createReadStream({ name });
  return new Promise ((resolve, reject) => {
    let str = '';
    readStream.on('end', () => {
      try {
        resolve(JSON.parse(str));
      } catch (err) {
        resolve(content);
      }
    });
    readStream.on('error', err => reject(err));
    readStream.on('data', buf => str += buf.toString());
  });
};
/**
 * create the cloud storage stream
 * the credentials/bucket name and filename are in the secrets file
 * @param {string} name the filename to stream from
 */
const createWriteStream = async ({ name, mimeType }) => {
  const blob = await createStorageStream({ name });
  const options = {
		contentType: mimeType
  };
  console.log('writestream options', options);
  return blob.createWriteStream(options);
};
/**
 * create the cloud storage stream
 * the credentials/bucket name and filename are in the secrets file
 * @param {string} name the filename on cloud storage
 */
const createReadStream = async ({ name }) => {
  const blob = await createStorageStream({ name });
  const stream = blob.createReadStream();
  // this stream will be piped from
  return stream;
};


/**
 * stream video file direct from vimeo storage to google cloud storage
 * @param {string} url the file to stream
 * @param {stream} stream the stream to pipe it to
 * @param {stream} [mimeType] validate exprected mimeType
 */
const downloadFile = async ({ url, stream, mimeType }) => {

  return new Promise (( resolve, reject) => {
    // request the video files
    console.log('requesting download from', url);

    // request(url)
    request.get(url)
    .on('error', err => reject(err))
    .on('response', response => {
      if (response.statusCode !== 200) {
        reject('unexpected status code:' + response.statusCode);
      }
      // if required, check mimetype is what was expected
      if (mimeType && response.headers['content-type'] !== mimeType) {
        reject('expected:' + mimeType + ' got:'  + response.headers['content-type']);
      }
    })
    .pipe(stream)
    .on('error', err => reject(err))
    .on('finish', () => resolve(url));
  });
};
module.exports = {
  createStorageStream,
  createWriteStream,
  streamContent,
  getContent,
  downloadFile
};

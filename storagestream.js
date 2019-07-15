
const Storage = require('@google-cloud/storage').Storage;
// make your own one of these for credentials
const secrets = require('../private/visecrets'); 
var sts = require('string-to-stream');
const request = require('request');
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
  const writeStream = await createWriteStream({ name });
  return new Promise ((resolve, reject) => {
    const str = typeof content === 'object' ? JSON.stringify(content) : content;
    sts(str).pipe(writeStream).on('finish', () => {
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
  const stream = blob.createWriteStream({
		resumable: true,
		contentType: mimeType || blob.type
	});
  // this stream will be piped to
  return stream;
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
 */
const downloadFile = async ({ url, stream }) => {

  return new Promise (( resolve, reject) => {
    // request the video files
    const sendReq = request.get(url);
    sendReq.on('response', (response) => {
      if (response.statusCode !== 200) {
        reject('Response status was ' + response.statusCode);
      } else {
        // and pipe the output to the blob stream for cloud storage
        sendReq.pipe(stream);
      }
    });
    // close when done
    sendReq.on('end', () => {
      stream.end();
      resolve(url);
    });

    // need to report any errors
    sendReq.on('error', err => {
        reject(err.message);
    });
  });
};
module.exports = {
  createStorageStream,
  createWriteStream,
  streamContent,
  getContent,
  downloadFile
};

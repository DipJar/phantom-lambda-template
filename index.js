var AWS = require('aws-sdk');
var phantomjs = require('phantomjs-prebuilt');
const moment = require('moment');
const fs = require('fs');

exports.handler = function(event, context, callback) {
    console.log('webrender', event);
    var url = decodeURIComponent(event.queryStringParameters.url);
    var key = decodeURIComponent(event.queryStringParameters.key);
    var id = event.queryStringParameters.ownerId || 0;
    var output = id + '-' + key + '-' + moment().format('YYYYMMDDHHmmss') + '-snapshot.png';
    var outputPath = '/tmp/' + output;
    var size = event.size || '1200px';
    var bucket = event.bucket || 'dipjar-kyc-repo';
    var phantom = phantomjs.exec('rasterize.js', url , outputPath, size);

    phantom.stdout.on('data', function(buf) {
        console.log('[STR] stdout "%s"', String(buf));
    });
    phantom.stderr.on('data', function(buf) {
        console.log('[STR] stderr "%s"', String(buf));
    });
    phantom.on('close', function(code) {
        console.log('[END] code', code);
    });

    phantom.on('exit', code => {
        var readStream = fs.createReadStream(outputPath);
        readStream.on('open', function() {
            var s3obj = new AWS.S3({params: {Bucket: bucket}});
            s3obj.upload({Body: readStream, Key: output}, function (err, data) {
                console.log('AWS S3 Upload:', data);
                callback(null, {
                    key: key,
                    id: id,
                    inputURL: url,
                    resultURL: data.Location,
                    status: 'success'
                });
            });
        });

        readStream.on('error', function(e) {
            console.log('Error reading rasterize output', e);
            callback('Failed', {
                key: key,
                id: id,
                url: url,
                status: 'error'
            });
        });
    });

};

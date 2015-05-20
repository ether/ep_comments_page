var fs = require("fs");
var padManager = require("ep_etherpad-lite/node/db/PadManager");
var settings = require("ep_etherpad-lite/node/utils/Settings");

//ensure we have an apiKey
var apiKey = "";
try {
  apiKey = fs.readFileSync("./APIKEY.txt","utf8").trim();
}
catch(e){
  console.warn('Could not find APIKEY');
}

// Checks if api key is correct and prepare response if it is not.
// Returns true if valid, false otherwise.
var validateApiKey = function(fields, res) {
  var valid = true;

  var apiKeyReceived = fields.apikey || fields.api_key;
  if(apiKeyReceived !== apiKey) {
    res.statusCode = 401;
    res.json({code: 4, message: "no or wrong API Key", data: null});
    valid = false;
  }

  return valid;
}

var validateRequiredField = function(originalFields, fieldName) {
  return (typeof originalFields[fieldName] !== 'undefined');
}

// Checks if required fields are present, and prepare response if any of them
// is not. Returns true if valid, false otherwise.
var validateRequiredFields = function(originalFields, requiredFields, res) {
  for(var i in requiredFields) {
    var requiredField = requiredFields[i];
    if (!validateRequiredField(originalFields, requiredField)) {
      var errorMessage = requiredField + " is required";
      res.json({code: 1, message: errorMessage, data: null});
      return false;
    }
  }
  return true;
}

// Sanitizes pad id and returns it:
var sanitizePadId = function(req) {
  var padIdReceived = req.params.pad;
  padManager.sanitizePadId(padIdReceived, function(padId) {
    padIdReceived = padId;
  });

  return padIdReceived;
}

// Builds url for message broadcasting, based on settings.json and on the
// given endPoint:
var broadcastUrlFor = function(endPoint) {
  var url = "";
  if(settings.ssl) {
    url += "https://";
  } else {
    url += "http://";
  }
  url += settings.ip + ":" + settings.port + endPoint;

  return url;
}

/* ********** Available functions/values: ********** */

exports.validateApiKey = validateApiKey;
exports.validateRequiredFields = validateRequiredFields;
exports.sanitizePadId = sanitizePadId;
exports.broadcastUrlFor = broadcastUrlFor;

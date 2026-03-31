'use strict';

const padManager = require('ep_etherpad-lite/node/db/PadManager');
const settings = require('ep_etherpad-lite/node/utils/Settings');

const validateRequiredField =
  (originalFields, fieldName) => typeof originalFields[fieldName] !== 'undefined';

// Checks if required fields are present, and prepare response if any of them
// is not. Returns true if valid, false otherwise.
const validateRequiredFields = (originalFields, requiredFields, res) => {
  for (const requiredField of requiredFields) {
    if (!validateRequiredField(originalFields, requiredField)) {
      const errorMessage = `${requiredField} is required`;
      res.json({code: 1, message: errorMessage, data: null});
      return false;
    }
  }
  return true;
};

// Sanitizes pad id and returns it:
const sanitizePadId = (req) => {
  let padIdReceived = req.params.pad;
  padManager.sanitizePadId(padIdReceived, (padId) => {
    padIdReceived = padId;
  });

  return padIdReceived;
};

// Builds url for message broadcasting, based on settings.json and on the
// given endPoint:
const broadcastUrlFor = (endPoint) => {
  let url = '';
  if (settings.ssl) {
    url += 'https://';
  } else {
    url += 'http://';
  }
  url += `${settings.ip}:${settings.port}${endPoint}`;

  return url;
};

/* ********** Available functions/values: ********** */

exports.validateRequiredFields = validateRequiredFields;
exports.sanitizePadId = sanitizePadId;
exports.broadcastUrlFor = broadcastUrlFor;

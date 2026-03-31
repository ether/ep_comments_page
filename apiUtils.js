'use strict';

const padManager = require('ep_etherpad-lite/node/db/PadManager');
const settings = require('ep_etherpad-lite/node/utils/Settings');

// Validate authorization - checks API key or JWT token depending on auth method
const validateAuth = async (req, res) => {
  try {
    // If API key auth is configured
    const apiKeyHandler = require('ep_etherpad-lite/node/handler/APIKeyHandler');
    const apikey = apiKeyHandler.apikey;
    if (apikey !== null && apikey.trim().length > 0) {
      const fields = Object.assign({}, req.query, req.body);
      const receivedKey = fields.apikey || fields.api_key || req.headers.authorization;
      if (receivedKey !== apikey.trim()) {
        res.statusCode = 401;
        res.json({code: 4, message: 'no or wrong API Key', data: null});
        return false;
      }
      return true;
    }

    // SSO/JWT auth
    if (!req.headers.authorization) {
      res.statusCode = 401;
      res.json({code: 4, message: 'no or wrong API Key', data: null});
      return false;
    }
    const {jwtVerify} = require('jose');
    const {jwtDecode} = require('jwt-decode');
    const {publicKeyExported} = require('ep_etherpad-lite/node/security/OAuth2Provider');
    const clientIds = settings.sso?.clients?.map((client) => client.client_id) ?? [];
    const jwtToCheck = req.headers.authorization.replace('Bearer ', '');
    const payload = jwtDecode(jwtToCheck);
    if (clientIds.includes(payload.sub)) {
      await jwtVerify(jwtToCheck, publicKeyExported, {algorithms: ['RS256']});
    } else {
      await jwtVerify(jwtToCheck, publicKeyExported, {algorithms: ['RS256'], requiredClaims: ['admin']});
    }
    return true;
  } catch (e) {
    res.statusCode = 401;
    res.json({code: 4, message: 'no or wrong API Key', data: null});
    return false;
  }
};

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

exports.validateAuth = validateAuth;
exports.validateRequiredFields = validateRequiredFields;
exports.sanitizePadId = sanitizePadId;
exports.broadcastUrlFor = broadcastUrlFor;

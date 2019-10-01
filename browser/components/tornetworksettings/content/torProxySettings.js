"use strict";

XPCOMUtils.defineLazyScriptGetter(
  this,
  ["TorConfigKeys"],
  "chrome://browser/content/torstrings/torStrings.js"
);

const TorProxyType = {
  NONE: "NONE",
  SOCKS4: "SOCKS4",
  SOCKS5: "SOCKS5",
  HTTPS: "HTTPS",
};

function TorProxySettings() {
  this._proxyType = TorProxyType.NONE;
  this._proxyAddress = undefined;
  this._proxyPort = undefined;
  this._proxyUsername = undefined;
  this._proxyPassword = undefined;
}

TorProxySettings.prototype = {
  get Type() {
    return this._proxyType;
  },
  get Address() {
    return this._proxyAddress;
  },
  get Port() {
    return this._proxyPort;
  },
  get Username() {
    return this._proxyUsername;
  },
  get Password() {
    return this._proxyPassword;
  },
  get ProxyURI() {
    switch (this._proxyType) {
      case TorProxyType.SOCKS4:
        return `socks4a://${this._proxyAddress}:${this._proxyPort}`;
      case TorProxyType.SOCKS5:
        if (this._proxyUsername) {
          return `socks5://${this._proxyUsername}:${this._proxyPassword}@${
            this._proxyAddress
          }:${this._proxyPort}`;
        }
        return `socks5://${this._proxyAddress}:${this._proxyPort}`;
      case TorProxyType.HTTPS:
        if (this._proxyUsername) {
          return `http://${this._proxyUsername}:${this._proxyPassword}@${
            this._proxyAddress
          }:${this._proxyPort}`;
        }
        return `http://${this._proxyAddress}:${this._proxyPort}`;
    }
    return undefined;
  },
};

// attempts to read proxy settings from Tor daemon
// throws on error
// returns true if populated, false if empty
// analog to tor-launcher's initProxySettings() function
TorProxySettings.prototype.ReadSettings = function() {
  let tlps = Cc["@torproject.org/torlauncher-protocol-service;1"].getService(
    Ci.nsISupports
  ).wrappedJSObject;
  let reply;

  // SOCKS4
  {
    reply = tlps.TorGetConfStr(TorConfigKeys.Socks4Proxy, null);
    if (!tlps.TorCommandSucceeded(reply)) {
      return false;
    }

    if (reply.retVal) {
      // address+port
      let [proxyAddress, proxyPort] = parseAddrPort(reply.retVal);

      this._proxyType = TorProxyType.SOCKS4;
      this._proxyAddress = proxyAddress;
      this._proxyPort = proxyPort;
      this._proxyUsername = "";
      this._proxyPassword = "";

      return true;
    }
  }

  // SOCKS5
  {
    reply = tlps.TorGetConfStr(TorConfigKeys.Socks5Proxy, null);
    if (!tlps.TorCommandSucceeded(reply)) {
      return false;
    }

    if (reply.retVal) {
      // address+port
      let [proxyAddress, proxyPort] = parseAddrPort(reply.retVal);
      // username
      reply = tlps.TorGetConfStr(TorConfigKeys.Socks5ProxyUsername, null);
      if (!tlps.TorCommandSucceeded(reply)) {
        return false;
      }
      let proxyUsername = reply.retVal;
      // password
      reply = tlps.TorGetConfStr(TorConfigKeys.Socks5ProxyPassword, null);
      if (!tlps.TorCommandSucceeded(reply)) {
        return false;
      }
      let proxyPassword = reply.retVal;

      this._proxyType = TorProxyType.SOCKS5;
      this._proxyAddress = proxyAddress;
      this._proxyPort = proxyPort;
      this._proxyUsername = proxyUsername;
      this._proxyPassword = proxyPassword;

      return true;
    }
  }

  // HTTP
  {
    reply = tlps.TorGetConfStr(TorConfigKeys.HTTPSProxy, null);
    if (!tlps.TorCommandSucceeded(reply)) {
      return false;
    }

    if (reply.retVal) {
      // addres+port
      let [proxyAddress, proxyPort] = parseAddrPort(reply.retVal);
      // username:password
      reply = tlps.TorGetConfStr(TorConfigKeys.HTTPSProxyAuthenticator, null);
      if (!tlps.TorCommandSucceeded(reply)) {
        return false;
      }

      let [proxyUsername, proxyPassword] = ["", ""];
      if (reply.retVal) {
        [proxyUsername, proxyPassword] = parseUsernamePassword(reply.retVal);
      }

      this._proxyType = TorProxyType.HTTPS;
      this._proxyAddress = proxyAddress;
      this._proxyPort = proxyPort;
      this._proxyUsername = proxyUsername;
      this._proxyPassword = proxyPassword;

      return true;
    }
  }

  // no proxy settings
  return false;
}; /* TorProxySettings::ReadFromTor() */

// attempts to write proxy settings to Tor daemon
// throws on error
// analog to tor-launcher's applyProxySettings() function
TorProxySettings.prototype.WriteSettings = function() {
  let tlps = Cc["@torproject.org/torlauncher-protocol-service;1"].getService(
    Ci.nsISupports
  ).wrappedJSObject;
  let settingsObject = {};

  // init proxy related settings to null so Tor daemon resets them
  settingsObject[TorConfigKeys.Socks4Proxy] = null;
  settingsObject[TorConfigKeys.Socks5Proxy] = null;
  settingsObject[TorConfigKeys.Socks5ProxyUsername] = null;
  settingsObject[TorConfigKeys.Socks5ProxyPassword] = null;
  settingsObject[TorConfigKeys.HTTPSProxy] = null;
  settingsObject[TorConfigKeys.HTTPSProxyAuthenticator] = null;

  switch (this._proxyType) {
    case TorProxyType.SOCKS4:
      settingsObject[TorConfigKeys.Socks4Proxy] = `${this._proxyAddress}:${
        this._proxyPort
      }`;
      break;
    case TorProxyType.SOCKS5:
      settingsObject[TorConfigKeys.Socks5Proxy] = `${this._proxyAddress}:${
        this._proxyPort
      }`;
      settingsObject[TorConfigKeys.Socks5ProxyUsername] = this._proxyUsername;
      settingsObject[TorConfigKeys.Socks5ProxyPassword] = this._proxyPassword;
      break;
    case TorProxyType.HTTPS:
      settingsObject[TorConfigKeys.HTTPSProxy] = `${this._proxyAddress}:${
        this._proxyPort
      }`;
      settingsObject[TorConfigKeys.HTTPSProxyAuthenticator] = `${
        this._proxyUsername
      }:${this._proxyPassword}`;
      break;
  }

  let errorObject = {};
  if (!tlps.TorSetConfWithReply(settingsObject, errorObject)) {
    throw errorObject.details;
  }
}; /* TorProxySettings::WriteToTor() */

// factory methods for our various supported proxies
function TorEmptyProxySettings() {
  return new TorProxySettings();
}

function TorSocks4ProxySettings(aProxyAddress, aProxyPort) {
  let retval = new TorProxySettings();
  retval._proxyType = TorProxyType.SOCKS4;
  retval._proxyAddress = aProxyAddress;
  retval._proxyPort = aProxyPort;
  return retval;
}

function TorSocks5ProxySettings(
  aProxyAddress,
  aProxyPort,
  aProxyUsername,
  aProxyPassword
) {
  let retval = new TorProxySettings();
  retval._proxyType = TorProxyType.SOCKS5;
  retval._proxyAddress = aProxyAddress;
  retval._proxyPort = aProxyPort;
  retval._proxyUsername = aProxyUsername;
  retval._proxyPassword = aProxyPassword;
  return retval;
}

function TorHTTPSProxySettings(
  aProxyAddress,
  aProxyPort,
  aProxyUsername,
  aProxyPassword
) {
  let retval = new TorProxySettings();
  retval._proxyType = TorProxyType.HTTPS;
  retval._proxyAddress = aProxyAddress;
  retval._proxyPort = aProxyPort;
  retval._proxyUsername = aProxyUsername;
  retval._proxyPassword = aProxyPassword;
  return retval;
}

"use strict";

XPCOMUtils.defineLazyScriptGetter(
  this,
  ["TorConfigKeys"],
  "chrome://browser/content/torstrings/torStrings.js"
);

function TorFirewallSettings() {
  this._allowedPorts = [];
}

TorFirewallSettings.prototype = {
  get PortsConfigurationString() {
    let portStrings = this._allowedPorts.map(port => `*:${port}`);
    return portStrings.join(",");
  },

  get CommaSeparatedListString() {
    return this._allowedPorts.join(",");
  },

  get HasPorts() {
    return this._allowedPorts.length > 0;
  },
};

// attempts to read firewall settings from Tor daemon
// throws on error
TorFirewallSettings.prototype.ReadSettings = function() {
  let tlps = Cc["@torproject.org/torlauncher-protocol-service;1"].getService(
    Ci.nsISupports
  ).wrappedJSObject;
  let reply;

  reply = tlps.TorGetConfStr(TorConfigKeys.ReachableAddresses, null);
  if (!tlps.TorCommandSucceeded(reply)) {
    return false;
  }

  let allowedPorts = [];
  if (reply.retVal) {
    allowedPorts = parseAddrPortList(reply.retVal);
  }
  this._allowedPorts = allowedPorts;
};

TorFirewallSettings.prototype.WriteSettings = function() {
  let tlps = Cc["@torproject.org/torlauncher-protocol-service;1"].getService(
    Ci.nsISupports
  ).wrappedJSObject;
  let settingsObject = {};

  // init to null so Tor daemon resets if no ports
  settingsObject[TorConfigKeys.ReachableAddresses] = null;

  if (this._allowedPorts.length > 0) {
    settingsObject[
      TorConfigKeys.ReachableAddresses
    ] = this.PortsConfigurationString;
  }

  let errorObject = {};
  if (!tlps.TorSetConfWithReply(settingsObject, errorObject)) {
    throw errorObject.details;
  }
};

function TorEmptyFirewallSettings() {
  return new TorFirewallSettings();
}

function TorCustomFirewallSettings(aPortsList) {
  let retval = new TorFirewallSettings();
  retval._allowedPorts = aPortsList;
  return retval;
}

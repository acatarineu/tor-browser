"use strict";

XPCOMUtils.defineLazyScriptGetter(
  this,
  ["TorConfigKeys"],
  "chrome://browser/content/torstrings/torStrings.js"
);

ChromeUtils.defineModuleGetter(
  this,
  "TorLauncherUtil",
  "resource://torlauncher/modules/tl-util.jsm"
);

// TODO: constants in tor strings somewhere

const kPrefDefaultBridgeType = "extensions.torlauncher.default_bridge_type";
const kPrefBranchDefaultBridge = "extensions.torlauncher.default_bridge.";
const kPrefBranchBridgeDBBridges = "extensions.torlauncher.bridgedb_bridge";

const TorBridgeSource = {
  NONE: "NONE",
  BUILTIN: "BUILTIN",
  BRIDGEDB: "BRIDGEDB",
  USERPROVIDED: "USERPROVIDED",
};

function TorBridgeSettings() {
  this._bridgeSource = TorBridgeSource.NONE;
  this._selectedDefaultBridgeType = null;
  this._bridgeStrings = [];
}

/* properties */
TorBridgeSettings.prototype = {
  get SelectedDefaultBridgeType() {
    if (this._bridgeSource == TorBridgeSource.BUILTIN) {
      return this._selectedDefaultBridgeType;
    }
    return undefined;
  },

  get BridgeSource() {
    return this._bridgeSource;
  },

  // for display
  get BridgeStrings() {
    return this._bridgeStrings.join("\n");
  },

  // raw
  get BridgeStringsArray() {
    return this._bridgeStrings;
  },
}; /* properties*/

TorBridgeSettings.DefaultBridgeTypes = function() {
  if (TorBridgeSettings._defaultBridgeTypes) {
    return TorBridgeSettings._defaultBridgeTypes;
  }

  let bridgeListBranch = Services.prefs.getBranch(kPrefBranchDefaultBridge);
  let bridgePrefs = bridgeListBranch.getChildList("", {});

  // treat as an unordered set for shoving bridge types into
  let bridgeTypes = {};
  // look for keys ending in ".N" and treat string before that as the bridge type
  let pattern = /\.[0-9]+$/;
  bridgePrefs.forEach(key => {
    let offset = key.search(pattern);
    if (offset != -1) {
      bridgeTypes[key.substring(0, offset)] = null;
    }
  });

  // TODO: insert the preffered default bridge first

  // extract the bridge type and shove into array
  let retval = [];
  for (const bt in bridgeTypes) {
    retval.push(bt);
  }

  // cache off
  TorBridgeSettings._defaultBridgeTypes = retval;
  return retval;
};

TorBridgeSettings.prototype._readDefaultBridges = function(aBridgeType) {
  let bridgeBranch = Services.prefs.getBranch(kPrefBranchDefaultBridge);
  let bridgeBranchPrefs = bridgeBranch.getChildList("", {});

  let retval = [];

  // regex matches against strings ending in ".N" where N is a positive integer
  let pattern = /\.[0-9]+$/;
  bridgeBranchPrefs.forEach(key => {
    // verify the location of the match is the correct offset required for aBridgeType
    // to fit, and that the string begins with aBridgeType
    if (
      key.search(pattern) == aBridgeType.length &&
      key.indexOf(aBridgeType) == 0
    ) {
      let bridgeStr = bridgeBranch.getCharPref(key);
      retval.push(bridgeStr);
    }
  });

  // TODO: shuffle bridge list
  return retval;
};

TorBridgeSettings.prototype._readBridgeDBBridges = function() {
  let bridgeBranch = Services.prefs.getBranch(`${kPrefBranchBridgeDBBridges}.`);
  let bridgeBranchPrefs = bridgeBranch.getChildList("", {});
  // the child prefs do not come in any particular order so sort the keys
  // so the values can be compared to what we get out off torrc
  bridgeBranchPrefs.sort();

  // just assume all of the prefs under the parent point to valid bridge string
  let retval = bridgeBranchPrefs.map(key =>
    bridgeBranch.getCharPref(key).trim()
  );

  return retval;
};

TorBridgeSettings.prototype._readTorrcBridges = function() {
  let tlps = Cc["@torproject.org/torlauncher-protocol-service;1"].getService(
    Ci.nsISupports
  ).wrappedJSObject;
  let reply;

  reply = tlps.TorGetConf(TorConfigKeys.BridgeList);
  if (!tlps.TorCommandSucceeded(reply)) {
    return false;
  }

  let retval = [];
  if (reply.lineArray) {
    reply.lineArray.forEach(line => {
      let trimmedLine = line.trim();
      if (trimmedLine) {
        retval.push(trimmedLine);
      }
    });

    return retval;
  }
};

// analagous to initBridgeSettings()
TorBridgeSettings.prototype.ReadSettings = function() {
  // restore to defaults
  this._bridgeSource = TorBridgeSource.NONE;
  this._selectedDefaultBridgeType = null;
  this._bridgeStrings = [];

  // So the way tor-launcher determines the origin of the configured bridges is a bit
  // weird and depends on inferring our scenario basd on some firefox prefs and the
  // relationship between the saved list of bridges in abotu:config vs the list saved in torrc

  // first off, if "extensions.torlauncher.default_bridge_type" is set to one of our
  // builtin default types (obfs4, meek-azure, snowflake, etc) then we provide the
  // bridges in "extensions.torlauncher.default_bridge.*" (filtered by our default_bridge_type)

  // next, we compare the list of bridges saved in torrc to the bridges stored in the
  // "extensions.torlauncher.bridgedb_bridge."" branch. If they match *exactly* then we assume
  // the bridges were retrieved from BridgeDB and use those. If the torrc list is empty then we know
  // we have no bridge settings

  // finally, if none of the previous conditions are not met, it is assumed the bridges stored in
  // torrc are user-provided

  // what we should(?) do once we excise tor-launcher entirely is explicitly store an int/enum in
  // about:config that tells us which scenario we are in so we don't have to guess

  let defaultBridgeType = null;
  try {
    // TODO: put preffered bridge type first in thi slist
    defaultBridgeType = Services.prefs.getCharPref(kPrefDefaultBridgeType);
  } catch (e) {}

  // check if source is BUILTIN
  if (defaultBridgeType) {
    this._bridgeStrings = this._readDefaultBridges(defaultBridgeType);
    this._bridgeSource = TorBridgeSource.BUILTIN;
    this._selectedDefaultBridgeType = defaultBridgeType;
    return;
  }

  let torrcBridges = this._readTorrcBridges();

  // no stored bridges means no bridge is in use
  if (torrcBridges.length == 0) {
    this._bridgeStrings = [];
    this._bridgeSource = TorBridgeSource.NONE;
    return;
  }

  let bridgedbBridges = this._readBridgeDBBridges();

  // if these two lists are equal then we got our bridges from bridgedb
  // ie: same element in identical order
  let arraysEqual = (left, right) => {
    if (left.length != right.length) {
      return false;
    }
    const length = left.length;
    for (let i = 0; i < length; ++i) {
      if (left[i] != right[i]) {
        return false;
      }
    }
    return true;
  };

  // agreement between prefs and torrc means bridgedb bridges
  if (arraysEqual(torrcBridges, bridgedbBridges)) {
    this._bridgeStrings = torrcBridges;
    this._bridgeSource = TorBridgeSource.BRIDGEDB;
    return;
  }

  // otherwise they must be user provided
  this._bridgeStrings = torrcBridges;
  this._bridgeSource = TorBridgeSource.USERPROVIDED;
};

TorBridgeSettings.prototype.WriteSettings = function() {
  let tlps = Cc["@torproject.org/torlauncher-protocol-service;1"].getService(
    Ci.nsISupports
  ).wrappedJSObject;
  let settingsObject = {};

  // init tor bridge settings to null
  settingsObject[TorConfigKeys.UseBridges] = null;
  settingsObject[TorConfigKeys.BridgeList] = null;

  // clear bridge related firefox prefs
  Services.prefs.setCharPref(kPrefDefaultBridgeType, "");
  let bridgeBranch = Services.prefs.getBranch(`${kPrefBranchBridgeDBBridges}.`);
  let bridgeBranchPrefs = bridgeBranch.getChildList("", {});
  bridgeBranchPrefs.forEach(pref =>
    Services.prefs.clearUserPref(`${kPrefBranchBridgeDBBridges}.${pref}`)
  );

  switch (this._bridgeSource) {
    case TorBridgeSource.NONE:
      break;
    case TorBridgeSource.BUILTIN:
      Services.prefs.setCharPref(
        kPrefDefaultBridgeType,
        this._selectedDefaultBridgeType
      );
      settingsObject[TorConfigKeys.UseBridges] = true;
      settingsObject[TorConfigKeys.BridgeList] = this.BridgeStringsArray;
      break;
    case TorBridgeSource.BRIDGEDB:
      // save bridges off to prefs
      for (let i = 0; i < this.BridgeStringsArray.length; ++i) {
        Services.prefs.setCharPref(
          `${kPrefBranchBridgeDBBridges}.${i}`,
          this.BridgeStringsArray[i]
        );
      }
      settingsObject[TorConfigKeys.UseBridges] = true;
      settingsObject[TorConfigKeys.BridgeList] = this.BridgeStringsArray;
      break;
    case TorBridgeSource.USERPROVIDED:
      settingsObject[TorConfigKeys.UseBridges] = true;
      settingsObject[TorConfigKeys.BridgeList] = this.BridgeStringsArray;
      break;
  }

  let errorObject = {};
  if (!tlps.TorSetConfWithReply(settingsObject, errorObject)) {
    throw errorObject.details;
  }
};

function TorNoBridgeSettings() {
  return new TorBridgeSettings();
}

function TorBuiltinBridgeSettings(aBridgeType) {
  let retval = new TorBridgeSettings();
  retval._bridgeSource = TorBridgeSource.BUILTIN;
  retval._selectedDefaultBridgeType = aBridgeType;
  retval._bridgeStrings = retval._readDefaultBridges(aBridgeType);

  return retval;
}

function TorBridgeDBBridgeSettings(aBridges) {
  let retval = new TorBridgeSettings();
  retval._bridgeSource = TorBridgeSource.BRIDGEDB;
  retval._selectedDefaultBridgeType = null;
  retval._bridgeStrings = aBridges;

  return retval;
}

function TorUserProvidedBridgeSettings(aBridges) {
  let retval = new TorBridgeSettings();
  retval._bridgeSource = TorBridgeSource.USERPROVIDED;
  retval._selectedDefaultBridgeType = null;
  retval._bridgeStrings = aBridges;

  return retval;
}

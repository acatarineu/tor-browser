// Copyright (c) 2020, The Tor Project, Inc.

"use strict";

ChromeUtils.defineModuleGetter(
  this,
  "TorStrings",
  "resource:///modules/TorStrings.jsm"
);

/*
  Onion Services Client Authentication Preferences Code

  Code to handle init and update of onion services authentication section
  in about:preferences#privacy
*/

const OnionServicesAuthPreferences =
{
  string: {
    groupBoxID: "torOnionServiceKeys",
    headerSelector: "#torOnionServiceKeys-header",
    overviewSelector: "#torOnionServiceKeys-overview",
    learnMoreSelector: "#torOnionServiceKeys-learnMore",
    savedKeysButtonSelector: "#torOnionServiceKeys-savedKeys"
  },

  init : function() {
    // populate XUL with localized strings
    this._populateXUL();
  },

  _populateXUL : function() {
    const groupbox = document.getElementById(this.string.groupBoxID);

    let elem = groupbox.querySelector(this.string.headerSelector);
    elem.textContent = TorStrings.onionServices.authPreferences.header;

    elem = groupbox.querySelector(this.string.overviewSelector);
    elem.textContent = TorStrings.onionServices.authPreferences.overview;

    elem = groupbox.querySelector(this.string.learnMoreSelector);
    elem.setAttribute("value", TorStrings.onionServices.learnMore);
    elem.setAttribute("href", TorStrings.onionServices.learnMoreURL);

    elem = groupbox.querySelector(this.string.savedKeysButtonSelector);
    elem.setAttribute("label", TorStrings.onionServices.authPreferences.savedKeys);
  },

  onViewSavedKeys() {
    gSubDialog.open("chrome://browser/content/onionservices/savedKeysDialog.xul");
  },
}; // OnionServicesAuthPreferences

Object.defineProperty(this, "OnionServicesAuthPreferences", {
  value: OnionServicesAuthPreferences,
  enumerable: true,
  writable: false
});

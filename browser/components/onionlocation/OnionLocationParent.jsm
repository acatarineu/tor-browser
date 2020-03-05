"use strict";

var EXPORTED_SYMBOLS = ["OnionLocationParent"];

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { TorStrings } = ChromeUtils.import("resource:///modules/TorStrings.jsm");

// Prefs
const NOTIFICATION_PREF = "privacy.prioritizeonions.notification";

// Element IDs
const ONIONLOCATION_BOX_ID = "onion-location-box";
const ONIONLOCATION_BUTTON_ID = "onion-location-button";
const ONIONLOCATION_LABEL_ID = "onion-label";

// Notification IDs
const NOTIFICATION_ID = "onion-location";
const NOTIFICATION_ANCHOR_ID = "onionlocation";

// Strings
const STRING_ONION_AVAILABLE = TorStrings.onionLocation.onionAvailable;
const NOTIFICATION_CANCEL_LABEL = TorStrings.onionLocation.notNow;
const NOTIFICATION_CANCEL_ACCESSKEY = TorStrings.onionLocation.notNowAccessKey;
const NOTIFICATION_OK_LABEL = TorStrings.onionLocation.alwaysPrioritize;
const NOTIFICATION_OK_ACCESSKEY =
  TorStrings.onionLocation.alwaysPrioritizeAccessKey;
const NOTIFICATION_TITLE = TorStrings.onionLocation.tryThis;
const NOTIFICATION_DESCRIPTION = TorStrings.onionLocation.description;
const NOTIFICATION_LEARN_MORE_URL = TorStrings.onionLocation.learnMoreURL;

var OnionLocationParent = {
  // Listeners are added in BrowserGlue.jsm
  receiveMessage(aMsg) {
    switch (aMsg.name) {
      case "OnionLocation:Set":
        this.setOnionLocation(aMsg.target);
        break;
    }
  },

  buttonClick(event) {
    if (event.button != 0) {
      return;
    }
    let win = event.target.ownerGlobal;
    let browser = win.gBrowser.selectedBrowser;
    this.redirect(browser);
  },

  redirect(browser) {
    browser.messageManager.sendAsyncMessage("OnionLocation:Refresh");
    this.setDisabled(browser);
  },

  onStateChange(browser) {
    delete browser._onionLocation;
    this.hideNotification(browser);
  },

  setOnionLocation(browser) {
    let win = browser.ownerGlobal;
    browser._onionLocation = true;
    if (browser === win.gBrowser.selectedBrowser) {
      this.updateOnionLocationBadge(browser);
    }
  },

  hideNotification(browser) {
    let win = browser.ownerGlobal;
    if (browser._onionLocationPrompt) {
      win.PopupNotifications.remove(browser._onionLocationPrompt);
    }
  },

  showNotification(browser) {
    let win = browser.ownerGlobal;
    let seen = Services.prefs.getBoolPref(NOTIFICATION_PREF, false);

    if (seen) {
      return;
    }

    Services.prefs.setBoolPref(NOTIFICATION_PREF, true);

    let mainAction = {
      label: NOTIFICATION_OK_LABEL,
      accessKey: NOTIFICATION_OK_ACCESSKEY,
      callback() {
        win.openPreferences("privacy-onionservices");
      },
    };

    let cancelAction = {
      label: NOTIFICATION_CANCEL_LABEL,
      accessKey: NOTIFICATION_CANCEL_ACCESSKEY,
      callback: () => {},
    };

    let options = {
      autofocus: true,
      persistent: true,
      removeOnDismissal: false,
      eventCallback(aTopic) {
        if (aTopic === "removed") {
          delete browser._onionLocationPrompt;
          delete browser.onionpopupnotificationanchor;
        }
      },
      learnMoreURL: NOTIFICATION_LEARN_MORE_URL,
      displayURI: {
        hostPort: NOTIFICATION_TITLE, // This is hacky, but allows us to have a title without extra markup/css.
      },
      hideClose: true,
    };

    // A hacky way of setting the popup anchor outside the usual url bar icon box
    // onionlocationpopupnotificationanchor comes from `${ANCHOR_ID}popupnotificationanchor`
    // From https://searchfox.org/mozilla-esr68/rev/080f9ed47742644d2ff84f7aa0b10aea5c44301a/browser/components/newtab/lib/CFRPageActions.jsm#488
    browser.onionlocationpopupnotificationanchor = win.document.getElementById(
      ONIONLOCATION_BUTTON_ID
    );

    browser._onionLocationPrompt = win.PopupNotifications.show(
      browser,
      NOTIFICATION_ID,
      NOTIFICATION_DESCRIPTION,
      NOTIFICATION_ANCHOR_ID,
      mainAction,
      [cancelAction],
      options
    );
  },

  setEnabled(browser) {
    let win = browser.ownerGlobal;
    let label = win.document.getElementById(ONIONLOCATION_LABEL_ID);
    label.textContent = STRING_ONION_AVAILABLE;
    let elem = win.document.getElementById(ONIONLOCATION_BOX_ID);
    elem.removeAttribute("hidden");
  },

  setDisabled(browser) {
    let win = browser.ownerGlobal;
    let elem = win.document.getElementById(ONIONLOCATION_BOX_ID);
    elem.setAttribute("hidden", true);
  },

  updateOnionLocationBadge(browser) {
    if (browser._onionLocation) {
      this.setEnabled(browser);
      this.showNotification(browser);
    } else {
      this.setDisabled(browser);
    }
  },
};

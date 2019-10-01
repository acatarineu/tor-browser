"use strict";

ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyGlobalGetters(this, ["DOMParser"]);
XPCOMUtils.defineLazyGetter(this, "domParser", () => {
  const parser = new DOMParser();
  parser.forceEnableDTD();
  return parser;
});

/*
  Tor String Bundle

  Strings loaded from torbutton, but provide a fallback in case torbutton addon not enabled
*/

function TorStringBundle(aBundleURLs) {
  let locations = [];
  aBundleURLs.forEach((url, index) => {
    locations.push(`<!ENTITY % dtd_${index} SYSTEM "${url}">%dtd_${index};`);
  });
  this._locations = locations;
}

// copied from testing/marionette/l10n.js
TorStringBundle.prototype.localizeEntity = function(urls, id) {
  // Use the DOM parser to resolve the entity and extract its real value
  let header = `<?xml version="1.0"?><!DOCTYPE elem [${this._locations.join(
    ""
  )}]>`;
  let elem = `<elem id="elementID">&${id};</elem>`;
  let doc = domParser.parseFromString(header + elem, "text/xml");
  let element = doc.querySelector("elem[id='elementID']");

  if (element === null) {
    throw new Error(`Entity with id='${id}' hasn't been found`);
  }

  return element.textContent;
};

TorStringBundle.prototype.getString = function(key, fallback) {
  if (key) {
    try {
      return this.localizeEntity(
        this._bundleURLs,
        `torbutton.prefs.sec_${key}`
      );
    } catch (e) {}
  }

  // on failure, assign the fallback if it exists
  if (fallback) {
    return fallback;
  }
  // otherwise return string key
  return `$(${key})`;
};

/*
  Security Level Strings
*/

const SecurityLevelStrings = (function() {
  let tsb = new TorStringBundle(["chrome://torbutton/locale/torbutton.dtd"]);
  let getString = function(key, fallback) {
    return tsb.getString(key, fallback);
  };

  // read localized strings from torbutton; but use hard-coded en-US strings as fallbacks in case of error
  let retval = {
    securityLevel: getString("caption", "Security Level"),
    customWarning: getString("custom_warning", "Custom"),
    overview: getString(
      "overview",
      "Disable certain web features that can be used to attack your security and anonymity."
    ),
    standard: {
      level: getString("standard_label", "Standard"),
      tooltip: getString("standard_tooltip", "Security Level : Standard"),
      summary: getString(
        "standard_description",
        "All Tor Browser and website features are enabled."
      ),
    },
    safer: {
      level: getString("safer_label", "Safer"),
      tooltip: getString("safer_tooltip", "Security Level : Safer"),
      summary: getString(
        "safer_description",
        "Disables website features that are often dangerous, causing some sites to lose functionality."
      ),
      description1: getString(
        "js_on_https_sites_only",
        "JavaScript is disabled on non-HTTPS sites."
      ),
      description2: getString(
        "limit_typography",
        "Some fonts and math symbols are disabled."
      ),
      description3: getString(
        "click_to_play_media",
        "Audio and video (HTML5 media), and WebGL are click-to-play."
      ),
    },
    safest: {
      level: getString("safest_label", "Safest"),
      tooltip: getString("safest_tooltip", "Security Level : Safest"),
      summary: getString(
        "safest_description",
        "Only allows website features required for static sites and basic services. These changes affect images, media, and scripts."
      ),
      description1: getString(
        "js_disabled",
        "JavaScript is disabled by default on all sites."
      ),
      description2: getString(
        "limit_graphics_and_typography",
        "Some fonts, icons, math symbols, and images are disabled."
      ),
      description3: getString(
        "click_to_play_media",
        "Audio and video (HTML5 media), and WebGL are click-to-play."
      ),
    },
    custom: {
      summary: getString(
        "custom_summary",
        "Your custom browser preferences have resulted in unusual security settings. For security and privacy reasons, we recommend you choose one of the default security levels."
      ),
    },
    learnMore: getString("learn_more_label", "Learn more"),
    learnMoreURL: (function() {
      let locale = "";
      try {
        let { getLocale } = ChromeUtils.import(
          "resource://torbutton/modules/utils.js",
          {}
        );
        locale = getLocale();
      } catch (e) {}

      if (locale == "") {
        locale = "en-US";
      }

      return (
        "https://tb-manual.torproject.org/" + locale + "/security-settings/"
      );
    })(),
    restoreDefaults: getString("restore_defaults", "Restore Defaults"),
    advancedSecuritySettings: getString(
      "advanced_security_settings",
      "Advanced Security Settings\u2026"
    ),
  };
  return retval;
})(); /* Security Level Strings */

/*
  Tor Network Settings Strings
*/
const TorNetworkSettingsStrings = (function() {
  let tsb = new TorStringBundle(["chrome://torbutton/locale/torbutton.dtd"]);
  let getString = function(key, fallback) {
    return tsb.getString(key, fallback);
  };

  let retval = {
    torNetworkSettingsHeading: getString(null, "Tor Network Settings"),
    torNetworkSettingsDescription: getString(
      null,
      "Tor Browser connects you to the Tor Network run by thousands of volunteers around the world."
    ),
    learnMore: getString(null, "Learn More"),
    bridgesHeading: getString(null, "Bridges"),
    bridgesDescription: getString(
      null,
      "Bridges help you to access the Tor network in places where Tor is blocked. This is dummy text now, but it should explain in plain words what is a bridge and how it can help them."
    ),
    useBridge: getString(null, "Use a bridge"),
    selectBridge: getString(null, "Select a bridge"),
    requestBridgeFromTorProject: getString(
      null,
      "Request a bridge from torproject.org"
    ),
    requestNewBridge: getString(null, "Request a New Bridge\u2026"),
    provideBridge: getString(null, "Provide a bridge I know"),
    provideBridgeDirections: getString(
      null,
      "Enter bridge information from a trusted source."
    ),
    provideBridgePlaceholder: getString(
      null,
      "type address:port (one per line)"
    ),
    advancedHeading: getString(null, "Advanced"),
    advancedDescription: getString(
      null,
      "Configure how Tor Browser connects to the internet."
    ),
    useLocalProxy: getString(null, "Use a local proxy"),
    proxyType: getString(null, "Proxy Type"),
    proxyAddress: getString(null, "Address"),
    proxyAddressPlaceholder: getString(null, "IP address or hostname"),
    proxyPort: getString(null, "Port"),
    proxyUsername: getString(null, "Username"),
    proxyPassword: getString(null, "Password"),
    proxyUsernamePasswordPlaceholder: getString(null, "Optional"),
    useFirewall: getString(
      null,
      "This computer goes through a firewall that only allows connections to certain ports"
    ),
    allowedPorts: getString(null, "Allowed Ports"),
    allowedPortsPlaceholder: getString(null, "Comma-seperated values"),
    requestBridgeDialogTitle: getString(null, "Request Bridge"),
    submitCaptcha: getString(null, "Submit"),
    contactingBridgeDB: getString(null, "Contacting BridgeDB. Please Wait."),
    solveTheCaptcha: getString(null, "Solve the CAPTCHA to request a bridge."),
    captchaTextboxPlaceholder: getString(
      null,
      "Enter the characters from the image"
    ),
    incorrectCaptcha: getString(
      null,
      "The solution is not correct. Please try again."
    ),
  };

  return retval;
})(); /* Tor Network Settings Strings */

/*
  Tor Deamon Configuration Key Strings
  */
const TorConfigKeys = {
  /* Bridge Conf Settings */
  UseBridges: "UseBridges",
  BridgeList: "Bridge",
  /* Proxy Conf Strings */
  Socks4Proxy: "Socks4Proxy",
  Socks5Proxy: "Socks5Proxy",
  Socks5ProxyUsername: "Socks5ProxyUsername",
  Socks5ProxyPassword: "Socks5ProxyPassword",
  HTTPSProxy: "HTTPSProxy",
  HTTPSProxyAuthenticator: "HTTPSProxyAuthenticator",
  /* Firewall Conf Strings */
  ReachableAddresses: "ReachableAddresses",
};

Object.defineProperty(this, "SecurityLevelStrings", {
  value: SecurityLevelStrings,
  enumerable: true,
  writable: false,
  configurable: true,
});

Object.defineProperty(this, "TorNetworkSettingsStrings", {
  value: TorNetworkSettingsStrings,
  enumerable: true,
  writable: false,
  configurable: true,
});

Object.defineProperty(this, "TorConfigKeys", {
  value: TorConfigKeys,
  enumerable: true,
  writable: false,
  configurable: true,
});

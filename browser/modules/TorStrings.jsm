"use strict";

var EXPORTED_SYMBOLS = ["TorStrings"];

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);
const { Services } = ChromeUtils.import(
  "resource://gre/modules/Services.jsm"
);
const { getLocale } = ChromeUtils.import(
  "resource://torbutton/modules/utils.js"
);

XPCOMUtils.defineLazyGlobalGetters(this, ["DOMParser"]);
XPCOMUtils.defineLazyGetter(this, "domParser", () => {
  const parser = new DOMParser();
  parser.forceEnableDTD();
  return parser;
});

/*
  Tor DTD String Bundle

  DTD strings loaded from torbutton/tor-launcher, but provide a fallback in case they aren't available
*/
class TorDTDStringBundle {
  constructor(aBundleURLs, aPrefix) {
    let locations = [];
    for (const [index, url] of aBundleURLs.entries()) {
      locations.push(`<!ENTITY % dtd_${index} SYSTEM "${url}">%dtd_${index};`);
    }
    this._locations = locations;
    this._prefix = aPrefix;
  }

  // copied from testing/marionette/l10n.js
  localizeEntity(urls, id) {
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
  }

  getString(key, fallback) {
    if (key) {
      try {
        return this.localizeEntity(this._bundleURLs, `${this._prefix}${key}`);
      } catch (e) {}
    }

    // on failure, assign the fallback if it exists
    if (fallback) {
      return fallback;
    }
    // otherwise return string key
    return `$(${key})`;
  }
}

/*
  Tor Property String Bundle

  Property strings loaded from torbutton/tor-launcher, but provide a fallback in case they aren't available
*/
class TorPropertyStringBundle {
  constructor(aBundleURL, aPrefix) {
    try {
      this._bundle = Services.strings.createBundle(aBundleURL);
    } catch (e) {}

    this._prefix = aPrefix;
  }

  getString(key, fallback) {
    if (key) {
      try {
        return this._bundle.GetStringFromName(`${this._prefix}${key}`);
      } catch (e) {}
    }

    // on failure, assign the fallback if it exists
    if (fallback) {
      return fallback;
    }
    // otherwise return string key
    return `$(${key})`;
  }
}

/*
  Security Level Strings
*/
var TorStrings = {
  /*
    Tor Browser Security Level Strings
  */
  securityLevel: (function() {
    let tsb = new TorDTDStringBundle(
      ["chrome://torbutton/locale/torbutton.dtd"],
      "torbutton.prefs.sec_"
    );
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
      learnMoreURL: `https://tb-manual.torproject.org/${getLocale()}/security-settings/`,
      restoreDefaults: getString("restore_defaults", "Restore Defaults"),
      advancedSecuritySettings: getString(
        "advanced_security_settings",
        "Advanced Security Settings\u2026"
      ),
    };
    return retval;
  })() /* Security Level Strings */,

  /*
    Tor about:preferences#tor Strings
  */
  settings: (function() {
    let tsb = new TorDTDStringBundle(
      ["chrome://torlauncher/locale/network-settings.dtd"],
      ""
    );
    let getString = function(key, fallback) {
      return tsb.getString(key, fallback);
    };

    let retval = {
      categoryTitle: getString("torPreferences.categoryTitle", "Tor"),
      torPreferencesHeading: getString(
        "torPreferences.torSettings",
        "Tor Settings"
      ),
      torPreferencesDescription: getString(
        "torPreferences.torSettingsDescription",
        "Tor Browser routes your traffic over the Tor Network, run by thousands of volunteers around the world."
      ),
      learnMore: getString("torPreferences.learnMore", "Learn More"),
      bridgesHeading: getString("torPreferences.bridges", "Bridges"),
      bridgesDescription: getString(
        "torPreferences.bridgesDescription",
        "Bridges help you access the Tor Network in places where Tor is blocked. Depending on where you are, one bridge may work better than another."
      ),
      useBridge: getString("torPreferences.useBridge", "Use a bridge"),
      selectBridge: getString(
        "torsettings.useBridges.default",
        "Select a bridge"
      ),
      requestBridgeFromTorProject: getString(
        "torsettings.useBridges.bridgeDB",
        "Request a bridge from torproject.org"
      ),
      requestNewBridge: getString(
        "torPreferences.requestNewBridge",
        "Request a New Bridge\u2026"
      ),
      provideBridge: getString(
        "torPreferences.provideBridge",
        "Provide a bridge"
      ),
      provideBridgeDirections: getString(
        "torsettings.useBridges.label",
        "Enter bridge information from a trusted source."
      ),
      provideBridgePlaceholder: getString(
        "torsettings.useBridges.placeholder",
        "type address:port (one per line)"
      ),
      advancedHeading: getString("torPreferences.advanced", "Advanced"),
      advancedDescription: getString(
        "torPreferences.advancedDescription",
        "Configure how Tor Browser connects to the internet."
      ),
      useLocalProxy: getString("torsettings.useProxy.checkbox", "I use a proxy to connect to the Internet"),
      proxyType: getString("torsettings.useProxy.type", "Proxy Type"),
      proxyTypeSOCKS4: getString("torsettings.useProxy.type.socks4", "SOCKS4"),
      proxyTypeSOCKS5: getString("torsettings.useProxy.type.socks5", "SOCKS5"),
      proxyTypeHTTP: getString("torsettings.useProxy.type.http", "HTTP/HTTPS"),
      proxyAddress: getString("torsettings.useProxy.address", "Address"),
      proxyAddressPlaceholder: getString(
        "torsettings.useProxy.address.placeholder",
        "IP address or hostname"
      ),
      proxyPort: getString("torsettings.useProxy.port", "Port"),
      proxyUsername: getString("torsettings.useProxy.username", "Username"),
      proxyPassword: getString("torsettings.useProxy.password", "Password"),
      proxyUsernamePasswordPlaceholder: getString(
        "torsettings.optional",
        "Optional"
      ),
      useFirewall: getString(
        "torsettings.firewall.checkbox",
        "This computer goes through a firewall that only allows connections to certain ports"
      ),
      allowedPorts: getString(
        "torsettings.firewall.allowedPorts",
        "Allowed Ports"
      ),
      allowedPortsPlaceholder: getString(
        "torPreferences.firewallPortsPlaceholder",
        "Comma-seperated values"
      ),
      requestBridgeDialogTitle: getString(
        "torPreferences.requestBridgeDialogTitle",
        "Request Bridge"
      ),
      submitCaptcha: getString(
        "torsettings.useBridges.captchaSubmit",
        "Submit"
      ),
      contactingBridgeDB: getString(
        "torPreferences.requestBridgeDialogWaitPrompt",
        "Contacting BridgeDB. Please Wait."
      ),
      solveTheCaptcha: getString(
        "torPreferences.requestBridgeDialogSolvePrompt",
        "Solve the CAPTCHA to request a bridge."
      ),
      captchaTextboxPlaceholder: getString(
        "torsettings.useBridges.captchaSolution.placeholder",
        "Enter the characters from the image"
      ),
      incorrectCaptcha: getString(
        "torPreferences.requestBridgeErrorBadSolution",
        "The solution is not correct. Please try again."
      ),
      showTorDaemonLogs: getString(
        "torPreferences.viewTorLogs",
        "View the Tor logs."
      ),
      showLogs: getString("torPreferences.viewLogs", "View Logs\u2026"),
      torLogDialogTitle: getString(
        "torPreferences.torLogsDialogTitle",
        "Tor Logs"
      ),
      copyLog: getString("torsettings.copyLog", "Copy Tor Log to Clipboard"),

      learnMoreTorBrowserURL: `https://tb-manual.torproject.org/${getLocale()}/about/`,
      learnMoreBridgesURL: `https://tb-manual.torproject.org/${getLocale()}/bridges/`,
      learnMoreNetworkSettingsURL: `about:blank`,
    };

    return retval;
  })() /* Tor Network Settings Strings */,

  /*
    Tor Onion Services Strings, e.g., for the authentication prompt.
  */
  onionServices: (function() {
    let tsb = new TorPropertyStringBundle(
      "chrome://torbutton/locale/torbutton.properties",
      "onionServices."
    );
    let getString = function(key, fallback) {
      return tsb.getString(key, fallback);
    };

    const kProblemLoadingSiteFallback = "Problem Loading Onionsite";
    const kLongDescFallback = "Details: %S";

    let retval = {
      learnMore: getString("learnMore", "Learn more"),
      learnMoreURL: `https://2019.www.torproject.org/docs/tor-manual-dev.html.${getLocale()}#_client_authorization`,
      errorPage: {
        browser: getString("errorPage.browser", "Browser"),
        network: getString("errorPage.network", "Network"),
        onionSite: getString("errorPage.onionSite", "Onionsite"),
      },
      descNotFound: { // Tor SOCKS error 0xF0
        pageTitle: getString("descNotFound.pageTitle", kProblemLoadingSiteFallback),
        header: getString("descNotFound.header", "Onionsite Not Found"),
        longDescription: getString("descNotFound.longDescription", kLongDescFallback),
      },
      descInvalid: { // Tor SOCKS error 0xF1
        pageTitle: getString("descInvalid.pageTitle", kProblemLoadingSiteFallback),
        header: getString("descInvalid.header", "Onionsite Cannot Be Reached"),
        longDescription: getString("descInvalid.longDescription", kLongDescFallback),
      },
      introFailed: { // Tor SOCKS error 0xF2
        pageTitle: getString("introFailed.pageTitle", kProblemLoadingSiteFallback),
        header: getString("introFailed.header", "Onionsite Has Disconnected"),
        longDescription: getString("introFailed.longDescription", kLongDescFallback),
      },
      rendezvousFailed: { // Tor SOCKS error 0xF3
        pageTitle: getString("rendezvousFailed.pageTitle", kProblemLoadingSiteFallback),
        header: getString("rendezvousFailed.header", "Unable to Connect to Onionsite"),
        longDescription: getString("rendezvousFailed.longDescription", kLongDescFallback),
      },
      clientAuthMissing: { // Tor SOCKS error 0xF4
        pageTitle: getString("clientAuthMissing.pageTitle", "Authorization Required"),
        header: getString("clientAuthMissing.header", "Onionsite Requires Authentication"),
        longDescription: getString("clientAuthMissing.longDescription", kLongDescFallback),
      },
      clientAuthIncorrect: { // Tor SOCKS error 0xF5
        pageTitle: getString("clientAuthIncorrect.pageTitle", "Authorization Failed"),
        header: getString("clientAuthIncorrect.header", "Onionsite Authentication Failed"),
        longDescription: getString("clientAuthIncorrect.longDescription", kLongDescFallback),
      },
      badAddress: { // Tor SOCKS error 0xF6
        pageTitle: getString("badAddress.pageTitle", kProblemLoadingSiteFallback),
        header: getString("badAddress.header", "Invalid Onionsite Address"),
        longDescription: getString("badAddress.longDescription", kLongDescFallback),
      },
      introTimedOut: { // Tor SOCKS error 0xF7
        pageTitle: getString("introTimedOut.pageTitle", kProblemLoadingSiteFallback),
        header: getString("introTimedOut.header", "Onionsite Circuit Creation Timed Out"),
        longDescription: getString("introTimedOut.longDescription", kLongDescFallback),
      },
      authPrompt: {
        description:
          getString("authPrompt.description", "%S is requesting your private key."),
        keyPlaceholder: getString("authPrompt.keyPlaceholder", "Enter your key"),
        done: getString("authPrompt.done", "Done"),
        doneAccessKey: getString("authPrompt.doneAccessKey", "d"),
        invalidKey: getString("authPrompt.invalidKey", "Invalid key"),
        failedToSetKey:
          getString("authPrompt.failedToSetKey", "Failed to set key"),
      },
      authPreferences: {
        header: getString("authPreferences.header", "Onion Services Authentication"),
        overview: getString("authPreferences.overview", "Some onion services require that you identify yourself with a key"),
        savedKeys: getString("authPreferences.savedKeys", "Saved Keys"),
        dialogTitle: getString("authPreferences.dialogTitle", "Onion Services Keys"),
        dialogIntro: getString("authPreferences.dialogIntro", "Keys for the following onionsites are stored on your computer"),
        onionSite: getString("authPreferences.onionSite", "Onionsite"),
        onionKey: getString("authPreferences.onionKey", "Key"),
        remove: getString("authPreferences.remove", "Remove"),
        removeAll: getString("authPreferences.removeAll", "Remove All"),
        failedToGetKeys: getString("authPreferences.failedToGetKeys", "Failed to get keys"),
        failedToRemoveKey: getString("authPreferences.failedToRemoveKey", "Failed to remove key"),
      },
    };

    return retval;
  })() /* Tor Onion Services Strings */,

  /*
    OnionLocation
  */
  onionLocation: (function() {
    const tsb = new TorPropertyStringBundle(
      ["chrome://torbutton/locale/torbutton.properties"],
      "onionLocation."
    );
    const getString = function(key, fallback) {
      return tsb.getString(key, fallback);
    };

    const retval = {
      alwaysPrioritize: getString(
        "alwaysPrioritize",
        "Always Prioritize Onionsites"
      ),
      alwaysPrioritizeAccessKey: getString("alwaysPrioritizeAccessKey", "a"),
      notNow: getString("notNow", "Not Now"),
      notNowAccessKey: getString("notNowAccessKey", "n"),
      description: getString(
        "description",
        "Website publishers can protect users by adding a security layer. This prevents eavesdroppers from knowing that you are the one visiting that website."
      ),
      tryThis: getString("tryThis", "Try this: Onionsite"),
      onionAvailable: getString("onionAvailable", "Onionsite available"),
      learnMore: getString("learnMore", "Learn more"),
      learnMoreURL: `https://tb-manual.torproject.org/${getLocale()}`, // TODO: replace when manual page is available.
      always: getString("always", "Always"),
      askEverytime: getString("askEverytime", "Ask you every time"),
      prioritizeOnionsDescription: getString(
        "prioritizeOnionsDescription",
        "Prioritize onionsites when they are available."
      ),
      onionServicesTitle: getString("onionServicesTitle", "Onion Services"),
    };

    return retval;
  })() /* OnionLocation */,

  /*
    Tor Deamon Configuration Key Strings
  */

  // TODO: proper camel case
  configKeys: {
    /* Bridge Conf Settings */
    useBridges: "UseBridges",
    bridgeList: "Bridge",
    /* Proxy Conf Strings */
    socks4Proxy: "Socks4Proxy",
    socks5Proxy: "Socks5Proxy",
    socks5ProxyUsername: "Socks5ProxyUsername",
    socks5ProxyPassword: "Socks5ProxyPassword",
    httpsProxy: "HTTPSProxy",
    httpsProxyAuthenticator: "HTTPSProxyAuthenticator",
    /* Firewall Conf Strings */
    reachableAddresses: "ReachableAddresses",

    /* BridgeDB Strings */
    clientTransportPlugin: "ClientTransportPlugin",
  },

  /*
    about:config preference keys
  */

  preferenceKeys: {
    defaultBridgeType: "extensions.torlauncher.default_bridge_type",
    recommendedBridgeType:
      "extensions.torlauncher.default_bridge_recommended_type",
  },

  /*
    about:config preference branches
  */
  preferenceBranches: {
    defaultBridge: "extensions.torlauncher.default_bridge.",
    bridgeDBBridges: "extensions.torlauncher.bridgedb_bridge.",
  },
};

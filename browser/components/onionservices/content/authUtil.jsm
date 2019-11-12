// Copyright (c) 2020, The Tor Project, Inc.

"use strict";

var EXPORTED_SYMBOLS = [
  "OnionAuthUtil",
];

var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

const OnionAuthUtil = {
  topic: {
    authPrompt: "tor-onion-services-auth-prompt",
  },
  message: {
    authPromptCanceled: "Tor:OnionServicesAuthPromptCanceled",
  },
  domid: {
    anchor: "tor-clientauth-notification-icon",
    notification: "tor-clientauth",
    description: "tor-clientauth-notification-desc",
    learnMore: "tor-clientauth-notification-learnmore",
    onionNameSpan: "tor-clientauth-notification-onionname",
    keyElement: "tor-clientauth-notification-key",
    warningElement: "tor-clientauth-warning",
    checkboxElement: "tor-clientauth-persistkey-checkbox",
  },

  addCancelMessageListener(aTabContent, aDocShell) {
    aTabContent.addMessageListener(this.message.authPromptCanceled,
                                   (aMessage) => {
      let failedURI = Services.io.newURI(aMessage.data.failedURI);
      aDocShell.displayLoadError(Cr.NS_ERROR_CONNECTION_REFUSED, failedURI,
                                 undefined, undefined);
    });
  },
};

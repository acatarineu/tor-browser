/* vim: set ts=2 sw=2 sts=2 et tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

var EXPORTED_SYMBOLS = ["OnionLocationChild"];

const { ActorChild } = ChromeUtils.import(
  "resource://gre/modules/ActorChild.jsm"
);

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");

function isValidOnionLocation(onionLocation) {
  if (typeof onionLocation === "string" && onionLocation) {
    try {
      let URI = Services.io.newURI(onionLocation);
      if (
        (URI.scheme === "https" || URI.scheme === "http") &&
        URI.host.endsWith(".onion")
      ) {
        return true;
      }
    } catch (e) {}
  }
  return false;
}

class OnionLocationChild extends ActorChild {
  handleEvent(event) {
    this.onPageShow(event);
  }

  onPageShow(event) {
    if (event.target != this.content.document) {
      return;
    }

    let channel = this.mm.docShell.currentDocumentChannel;
    try {
      let httpChannel = channel.QueryInterface(Ci.nsIHttpChannel);
      let onionLocation = httpChannel.getResponseHeader("Onion-Location");
      if (isValidOnionLocation(onionLocation)) {
        this.mm.sendAsyncMessage("OnionLocation:Set", onionLocation);
      }
    } catch (e) {}
  }
}

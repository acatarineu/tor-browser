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

function isSecureChannel(channel) {
  try {
    return channel.URI.scheme === "https";
  } catch (e) {}
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
      if (isSecureChannel(httpChannel) && isValidOnionLocation(onionLocation)) {
        this.mm.sendAsyncMessage("OnionLocation:Set", onionLocation);
      }
    } catch (e) {}
  }
}

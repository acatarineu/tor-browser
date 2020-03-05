"use strict";

var EXPORTED_SYMBOLS = ["OnionLocationChild"];

const { ActorChild } = ChromeUtils.import(
  "resource://gre/modules/ActorChild.jsm"
);

class OnionLocationChild extends ActorChild {
  handleEvent(event) {
    this.onPageShow(event);
  }

  onPageShow(event) {
    if (event.target != this.content.document) {
      return;
    }
    const onionLocationURI = this.content.document.onionLocationURI;
    if (onionLocationURI) {
      this.mm.sendAsyncMessage("OnionLocation:Set", onionLocationURI.asciiSpec);
    }
  }

  receiveMessage(aMessage) {
    if (aMessage.name == "OnionLocation:Refresh") {
      const document = this.content.document;
      const docShell = this.mm.docShell;
      const onionLocationURI = document.onionLocationURI;
      const refreshURI = docShell.QueryInterface(Ci.nsIRefreshURI);
      if (onionLocationURI && refreshURI) {
        refreshURI.refreshURI(
          onionLocationURI,
          document.nodePrincipal,
          0,
          false,
          true
        );
      }
    }
  }
}

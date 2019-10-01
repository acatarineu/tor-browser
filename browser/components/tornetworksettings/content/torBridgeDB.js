"use strict";

ChromeUtils.defineModuleGetter(
  this,
  "TorLauncherBridgeDB",
  "resource://torlauncher/modules/tl-bridgedb.jsm"
);

const TorBridgeDB = {
  _moatRequestor: null,
  _currentCaptchaInfo: null,

  submitCaptchaGuess(aCaptchaSolution) {
    if (this._moatRequestor && this._currentCaptchaInfo) {
      return this._moatRequestor
        .finishFetch(
          this._currentCaptchaInfo.transport,
          this._currentCaptchaInfo.challenge,
          aCaptchaSolution
        )
        .then(aBridgeInfo => {
          TorBridgeDB._moatRequestor.close();
          TorBridgeDB._moatRequestor = null;
          TorBridgeDB._currentCaptchaInfo = null;

          // array of bridge strings
          return aBridgeInfo.bridges;
        });
    }

    return new Promise((aResponse, aReject) => {
      aReject(new Error("Invalid _moatRequestor or _currentCaptchaInfo"));
    });
  },

  requestNewCaptchaImage(aProxyURI) {
    // close and clear out existing state on captcha request
    this.close();

    let svc = Cc["@torproject.org/torlauncher-protocol-service;1"].getService(
      Ci.nsISupports
    );
    let gProtocolSvc = svc.wrappedJSObject;
    let reply = gProtocolSvc.TorGetConf("ClientTransportPlugin");

    // TODO: proper error handling on reply
    // if (!gProtocolSvc.TorCommandSucceeded(reply))
    //     return;

    let meekClientPath;
    let meekTransport; // We support both "meek" and "meek_lite".
    let meekClientArgs;
    // TODO: shouldn't this early out once meek settings are found?
    reply.lineArray.forEach(aLine => {
      // Parse each ClientTransportPlugin line and look for the meek or
      // meek_lite transport. This code works a lot like the Tor daemon's
      // parse_transport_line() function.
      let tokens = aLine.split(" ");
      if (tokens.length > 2 && tokens[1] == "exec") {
        let transportArray = tokens[0].split(",").map(aStr => aStr.trim());
        let transport = transportArray.find(
          aTransport => aTransport === "meek"
        );
        if (!transport) {
          transport = transportArray.find(
            aTransport => aTransport === "meek_lite"
          );
        }
        if (transport) {
          meekTransport = transport;
          meekClientPath = tokens[2];
          meekClientArgs = tokens.slice(3);
        }
      }
    });

    // TODO: error handling on meekTransport
    // if (!meekTransport)
    // {
    //   reportMoatError(TorLauncherUtil.getLocalizedString("no_meek"));
    //   return;
    // }

    this._moatRequestor = TorLauncherBridgeDB.createMoatRequestor();

    return this._moatRequestor
      .init(aProxyURI, meekTransport, meekClientPath, meekClientArgs)
      .then(() => {
        // TODO: get this from TorLauncherUtil
        let bridgeType = "obfs4";
        return TorBridgeDB._moatRequestor.fetchBridges([bridgeType]);
      })
      .then(aCaptchaInfo => {
        // cache off the current captcha info as the challenge is needed for response
        TorBridgeDB._currentCaptchaInfo = aCaptchaInfo;
        return aCaptchaInfo.captchaImage;
      });
  },

  close() {
    console.log("torBridgeDB::close()");
    if (this._moatRequestor) {
      this._moatRequestor.close();
      this._moatRequestor = null;
    }
    this._currentCaptchaInfo = null;
  },
};

Object.defineProperty(this, "TorBridgeDB", {
  value: TorBridgeDB,
  enumerable: true,
  writeable: false,
});

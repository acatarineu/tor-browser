"use strict";

const EXPORTED_SYMBOLS = ["HttpsEverywhereControl"];

const { ExtensionMessaging } = ChromeUtils.import(
  "resource:///modules/ExtensionMessaging.jsm"
);
const { setTimeout } = ChromeUtils.import("resource://gre/modules/Timer.jsm");

const EXTENSION_ID = "https-everywhere-eff@eff.org";
const SECUREDROP_TOR_ONION_CHANNEL = {
  name: "SecureDropTorOnion",
  jwk: {
    kty: "RSA",
    e: "AQAB",
    n:
      "y0iWTVev1uYDVhLdc5uSHWke-9JlbxzqIsGkS95Pk5NsxdlkdbHpqaPr-5xL5FspX8QGo3HAT5hrUcPV_kz8x-HwGEm2-p9BQ6-yEPtr5QXQGGzNoizmj7HH-b0y5qx8iUFwAJ__PJWK4IwSgjIQqHMjmkOLc9N4bmRPULi6ZZMb-97FdeZsh34dVy2tpIzZaijRfRQSfeZkwRXZzOY-siGfOAzY_UcrHFli5zroTZAyDaetFm1z2-TdFLOvN8fi0o3mBbCB9SqhOUImPwSTNWTp2D6bHhI91mt7gr6fLnzHMGrTMh2DQ4vjt_98pe7WTUzuRCLa9Awb6JJgbYA4ySV1akAU0_iq6oCAE9PZbUgUw9UAH1ctRFml87F3HORUMMj5ZCLwRIrEXqrCJbV4f-Ius-ZO2wwlYTsEv8TmUzISpMwVjGOIpXwFIb65R_EX3_vIopauSoyZkvk3klly0Qe6KTy_gg1CZ_h2ZXPpLMwqlfFTDBPv2q8gyuzgkYXQes3FX-PbJ9Dsl5QO4icuEjV2NQ7iPwwIPAtj9cpqCD8-p9TqTKaZjOFC9-ryJpWsivGCbvN2JotmJ5Ax9rmnAMvQM09muCetFj_ZIgllcpeahaw6gxVXlSYIhb0J9V878KNuRJ2yPJFlBmgpFexvCcz8Jqs6JUfIrmUAGUXG9nE",
  },
  update_path_prefix: "https://redshiftzero.github.io/securedrop-httpse/",
  scope:
    "^https?:\\/\\/[a-z0-9-]+(?:\\.[a-z0-9-]+)*\\.securedrop\\.tor\\.onion\\/",
  replaces_default_rulesets: false,
};

class HttpsEverywhereControl {
  constructor() {
    this._extensionMessaging = null;
  }

  static async wait(seconds = 1) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
  }

  async installTorOnionUpdateChannel(retries = 5) {
    this._init();

    // FIXME: https-everywhere store is initialized asynchronously, so sending a message
    // immediately results in a `store.get is undefined` error.
    // For now, let's wait a bit and retry a few times if there is an error.
    await HttpsEverywhereControl.wait();

    try {
      await this._extensionMessaging.sendMessage(
        {
          type: "create_update_channel",
          object: SECUREDROP_TOR_ONION_CHANNEL.name,
        },
        EXTENSION_ID
      );
    } catch (e) {
      if (retries <= 0) {
        throw new Error("Could not install SecureDropTorOnion update channel");
      }
      await this.installTorOnionUpdateChannel(retries - 1);
      return;
    }

    await this._extensionMessaging.sendMessage(
      {
        type: "update_update_channel",
        object: SECUREDROP_TOR_ONION_CHANNEL,
      },
      EXTENSION_ID
    );
  }

  unload() {
    if (this._extensionMessaging) {
      this._extensionMessaging.unload();
      this._extensionMessaging = null;
    }
  }

  _init() {
    if (!this._extensionMessaging) {
      this._extensionMessaging = new ExtensionMessaging();
    }
  }
}

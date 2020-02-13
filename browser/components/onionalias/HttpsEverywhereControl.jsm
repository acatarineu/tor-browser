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
      "2IGvrYj_UwpO8EMNeEiitb8imzuJA-BGngLYtMkY72wx6aPhuWWvGs-Dlh4lHB4fi8rxfeb0N6ZwCyfCKBeHgfuTgbH14HB-ZSA47JHKEO4fSiay1jjhsGDzQlZDVdn_Wfyxi5je80pizMsOulHKEKzRx4HIcrXY1nf8iiOHEWaB0GX8H1pJjyIlqTxN9Pm5Q4h7kRLUoq3O9EE3o7q1dVeaxYM221WPqaSq9mawAhih4wo_79mb6JinG--s9F3jfqmnOvQk-xAoSTA-XNqTvO-7Mg_WajoA7Lnx1pJbGuvhqNOdodWOFxdMMNaPL8JXmPywl6zAqMESU1rXcaVKVdx1LpcmTyz8dGi3u_GTb6fo5GqXUgByvvRcOXA6DAFC7tbLEy1QinU0q4cRZJYf6s4QxgyRsCgxrcJ9kuDwDHviAm9Yn3eEFRbD2e3hRFfZyvkkLepEWywEfBGdBjQ_Kz9gkQTzmpVef1J-sSD6dnW5OEVEXAPO0sEdr5o-Ng9NSvDGZ3Sw-4AgFO6aynLnpvbVOYneppLF7MKwGVQv0tQ8XY3zBEsxidTIkvmpzKZp6QElpfCwbYnl9aQ9hQ3BmOPIhM2VunP47MPOgyAp4s2m3knwCWbPSR5Gm8agDwIGA1Va1eFAtS-YAYk8v-J20iTyuXrpWqrQmFjEnVLsav8",
  },
  update_path_prefix: "https://people.torproject.org/~acat/misc/rulesets/",
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

// Copyright (c) 2020, The Tor Project, Inc.

"use strict";

const EXPORTED_SYMBOLS = ["OnionAliasStore"];

const { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
const { HttpsEverywhereControl } = ChromeUtils.import(
  "resource:///modules/HttpsEverywhereControl.jsm"
);

function observe(topic, callback) {
  let observer = {
    observe(aSubject, aTopic, aData) {
      if (topic === aTopic) {
        callback(aSubject, aData);
      }
    },
  };
  Services.obs.addObserver(observer, topic);
  return () => Services.obs.removeObserver(observer, topic);
}

class _OnionAliasStore {
  constructor() {
    this._onionMap = new Map();
    this._removeObserver = () => {};
  }

  init() {
    this.httpsEverywhereControl = new HttpsEverywhereControl();
    this.httpsEverywhereControl.installTorOnionUpdateChannel();

    this._removeObserver = observe("http-on-before-connect", channel => {
      if (
        channel.isMainDocumentChannel &&
        channel.originalURI.host.endsWith(".tor.onion")
      ) {
        this.addMapping(channel.originalURI, channel.URI);
      }
    });
  }

  uninit() {
    this.clear();
    this._removeObserver();
    this._removeObserver = () => {};
    if (this.httpsEverywhereControl) {
      this.httpsEverywhereControl.unload();
      delete this.httpsEverywhereControl;
    }
  }

  clear() {
    this._onionMap.clear();
  }

  addMapping(shortOnionURI, longOnionURI) {
    this._onionMap.set(longOnionURI.host, shortOnionURI.host);
  }

  getShortURI(onionURI) {
    // TODO: We should make sure that the returned URI would actually be redirected by
    // https-everywhere to the original URI. One way would be to ask the extension
    // by sending a message, but that requires modifying https-everywhere code.
    if (this._onionMap.has(onionURI.host)) {
      return onionURI
        .mutate()
        .setHost(this._onionMap.get(onionURI.host))
        .finalize();
    }
    return null;
  }
}

let OnionAliasStore = new _OnionAliasStore();

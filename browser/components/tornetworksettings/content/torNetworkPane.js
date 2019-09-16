"use strict";

XPCOMUtils.defineLazyScriptGetter(this, ["TorNetworkSettingsStrings"],
                                  "chrome://browser/content/torstrings/torStrings.js");

XPCOMUtils.defineLazyScriptGetter(this, ["TorRequestBridgeDialog"],
                                  "chrome://browser/content/tornetworksettings/torNetworkRequestBridgeDialog.js");

// TODO: move these to a utilities js file or something?

// expects a string representation of an integer from 1 to 65535
let parsePort = function(aPort) {
  // ensure port string is a valid positive integer
  const validIntRegex = /^[0-9]+$/;
  if (!validIntRegex.test(aPort)) {
    throw new Error(`Invalid PORT string : '${aPort}'`);
  }

  // ensure port value is on valid range
  let port = Number.parseInt(aPort);
  if (port < 1 || port > 65535) {
    throw new Error(`Invalid PORT value, needs to be on range [0,65535] : '${port}'`);
  }

  return port;
}
// expects a string in the format: "ADDRESS:PORT"
let parseAddrPort = function(aAddrColonPort) {
  let tokens = aAddrColonPort.split(':');
  if (tokens.length != 2) {
    throw new Error(`Invalid ADDRESS:PORT string : '${aAddrColonPort}'`);
  }
  let address = tokens[0];
  let port = parsePort(tokens[1]);
  return [address, port];
};

// expects a string in the format: "USERNAME:PASSWORD"
// split on the first colon and any subsequent go into password
let parseUsernamePassword = function(aUsernameColonPassword) {
  let colonIndex = aUsernameColonPassword.indexOf(":");
  if (colonIndex < 0) {
    // we don't log the contents of the potentially password containing string
    throw new Error ("Invalid USERNAME:PASSWORD string");
  }

  let username = aUsernameColonPassword.substring(0, colonIndex);
  let password = aUsernameColonPassword.substring(colonIndex + 1);

  return [username, password];
}

// expects tring in the format: ADDRESS:PORT,ADDRESS:PORT,...
// returns array of ports (as ints)
let parseAddrPortList = function(aAddrPortList) {
  let addrPorts = aAddrPortList.split(',');
  // parse ADDRESS:PORT string and only keep the port (second element in returned array)
  let retval = addrPorts.map(addrPort => parseAddrPort(addrPort)[1]);
  return retval;
}

// expects a '/n' delimited string of bridge string, which we split and trim
let parseBridgeStrings = function(aBridgeStrings)
{
  let splitStrings = aBridgeStrings.split("\n");
  return splitStrings.map(val => val.trim());
}

// expecting a ',' delimited list of ints with possible white space between
// returns an array of ints
let parsePortList = function(aPortListString) {
  let splitStrings = aPortListString.split(",");
  return splitStrings.map(val => parsePort(val.trim()));
}

/*
  Tor Pane

  Code for populating the XUL in about:preferences#tor, handling input events, interfacing with tor-launcher
*/
const gTorPane = function()
{
  /* CSS selectors for all of the Tor Network DOM elements we need to access */
  const selectors = {
    TorNetworkSettings : {
      Header : "h1#torNetworkSettings-header",
      Description : "span#torNetworkSettings-description",
      LearnMore : "label#torNetworkSettings-learnMore",
    },
    Bridges : {
      Header : "h2#torNetworkSettings-bridges-header",
      Description : "span#torNetworkSettings-bridges-description",
      LearnMore : "label#torNetworkSettings-bridges-learnMore",
      UseBridgeCheckbox : "checkbox#torNetworkSettings-bridges-toggle",
      BridgeSelectionRadiogroup : "radiogroup#torNetworkSettings-bridges-bridgeSelection",
      BuiltinBridgeOption : "radio#torNetworkSettings-bridges-radioBuiltin",
      BuiltinBridgeList : "menulist#torNetworkSettings-bridges-builtinList",
      RequestBridgeOption : "radio#torNetworkSettings-bridges-radioRequestBridge",
      RequestBridgeButton : "button#torNetworkSettings-bridges-buttonRequestBridge",
      RequestBridgeTextarea : "textarea#torNetworkSettings-bridges-textareaRequestBridge",
      ProvideBridgeOption : "radio#torNetworkSettings-bridges-radioProvideBridge",
      ProvideBridgeDescription : "description#torNetworkSettings-bridges-descriptionProvideBridge",
      ProvideBridgeTextarea : "textarea#torNetworkSettings-bridges-textareaProvideBridge",
    },
    Advanced : {
      Header : "h2#torNetworkSettings-advanced-header",
      Description : "span#torNetworkSettings-advanced-description",
      LearnMore : "label#torNetworkSettings-advanced-learnMore",
      UseProxyCheckbox : "checkbox#torNetworkSettings-advanced-toggleProxy",
      ProxyTypeLabel : "label#torNetworkSettings-localProxy-type",
      ProxyTypeList : "menulist#torNetworkSettings-localProxy-builtinList",
      ProxyAddressLabel : "label#torNetworkSettings-localProxy-address",
      ProxyAddressTextbox : "textbox#torNetworkSettings-localProxy-textboxAddress",
      ProxyPortLabel : "label#torNetworkSettings-localProxy-port",
      ProxyPortTextbox : "input#torNetworkSettings-localProxy-textboxPort",
      ProxyUsernameLabel : "label#torNetworkSettings-localProxy-username",
      ProxyUsernameTextbox : "textbox#torNetworkSettings-localProxy-textboxUsername",
      ProxyPasswordLabel : "label#torNetworkSettings-localProxy-password",
      ProxyPasswordTextbox : "textbox#torNetworkSettings-localProxy-textboxPassword",
      UseFirewallCheckbox : "checkbox#torNetworkSettings-advanced-toggleFirewall",
      FirewallAllowedPortsLabel : "label#torNetworkSettings-advanced-allowedPorts",
      FirewallAllowedPortsTextbox : "textbox#torNetworkSettings-advanced-textboxAllowedPorts",
    }
  }; /* selectors */

  let retval = {
    // cached frequently accessed DOM elements
    _useBridgeCheckbox : null,
    _bridgeSelectionRadiogroup : null,
    _builtinBridgeOption : null,
    _builtinBridgeMenulist : null,
    _requestBridgeOption : null,
    _requestBridgeButton : null,
    _requestBridgeTextarea : null,
    _provideBridgeOption : null,
    _provideBridgeTextarea : null,
    _useProxyCheckbox : null,
    _proxyTypeLabel : null,
    _proxyTypeMenulist : null,
    _proxyAddressLabel : null,
    _proxyAddressTextbox : null,
    _proxyPortLabel : null,
    _proxyPortTextbox : null,
    _proxyUsernameLabel : null,
    _proxyUsernameTextbox : null,
    _proxyPasswordLabel : null,
    _proxyPasswordTextbox : null,
    _useFirewallCheckbox : null,
    _allowedPortsLabel : null,
    _allowedPortsTextbox : null,

    // tor network settings
    _bridgeSettings : null,
    _proxySettings : null,
    _firewallSettigs : null,

    // TODO: probably nuke these properties if they aren't really useBridge

    // getters for groups of related elements for batch enable/disable
    get _bridgeElements() {
      return [
        this._builtinBridgeOption, this._builtinBridgeMenulist,
        this._requestBridgeOption, this._requestBridgeButton,
        this._requestBridgeTextarea,
        this._provideBridgeOption,
        this._provideBridgeTextarea
      ];
    },

    get _proxyElements() {
      return [
        this._proxyTypeLabel, this._proxyTypeMenulist,
        this._proxyAddressLabel, this._proxyAddressTextbox, this._proxyPortLabel, this._proxyPortTextbox,
        this._proxyUsernameLabel, this._proxyUsernameTextbox, this._proxyPasswordLabel, this._proxyPasswordTextbox
      ];
    },

    get _firewallElements() {
      return [
        this._allowedPortsLabel, this._allowedPortsTextbox
      ];
    },

    // disables the provided list of elements
    _setElementsDisabled : function(elements, disabled) {
      for(let currentElement of elements) {
        currentElement.disabled = disabled;
      }
    },

    // populate xul with strings and cache the relevant elements
    _populateXUL : function() {

      let prefpane = document.getElementById("mainPrefPane");
      // TODO: saving to Tor would go in this callback when about:preferenes loses focus (ie user switches to another tab or closes)
      // tlps.TorSendCommand("SAVECONF");
      document.addEventListener("focusout", (val) => {
        console.log ("lose focus!");
        let tlps = Cc["@torproject.org/torlauncher-protocol-service;1"].getService(Ci.nsISupports).wrappedJSObject;
        tlps.TorSendCommand("SAVECONF");
      });

      // Heading
      prefpane.querySelector(selectors.TorNetworkSettings.Header).innerHTML = TorNetworkSettingsStrings.torNetworkSettingsHeading;
      prefpane.querySelector(selectors.TorNetworkSettings.Description).textContent = TorNetworkSettingsStrings.torNetworkSettingsDescription;
      {
        let learnMore = prefpane.querySelector(selectors.TorNetworkSettings.LearnMore);
        learnMore.setAttribute("value", TorNetworkSettingsStrings.learnMore);
        // TODO: real url
        learnMore.setAttribute("href", "https://www.example.com");
      }

      // Bridge setup
      prefpane.querySelector(selectors.Bridges.Header).innerHTML = TorNetworkSettingsStrings.bridgesHeading;
      prefpane.querySelector(selectors.Bridges.Description).textContent = TorNetworkSettingsStrings.bridgesDescription;
      {
        let learnMore = prefpane.querySelector(selectors.Bridges.LearnMore);
        learnMore.setAttribute("value", TorNetworkSettingsStrings.learnMore);
        // TODO: real url
        learnMore.setAttribute("href", "https://www.example.com");
      }

      this._useBridgeCheckbox = prefpane.querySelector(selectors.Bridges.UseBridgeCheckbox);
      this._useBridgeCheckbox.setAttribute("label", TorNetworkSettingsStrings.useBridge);
      this._bridgeSelectionRadiogroup = prefpane.querySelector(selectors.Bridges.BridgeSelectionRadiogroup);
      this._bridgeSelectionRadiogroup.value = TorBridgeSource.BUILTIN;

      // Builtin bridges
      this._builtinBridgeOption = prefpane.querySelector(selectors.Bridges.BuiltinBridgeOption);
      this._builtinBridgeOption.setAttribute("label", TorNetworkSettingsStrings.selectBridge);
      this._builtinBridgeOption.setAttribute("value", TorBridgeSource.BUILTIN);
      this._builtinBridgeMenulist = prefpane.querySelector(selectors.Bridges.BuiltinBridgeList);

      // Request bridge
      this._requestBridgeOption = prefpane.querySelector(selectors.Bridges.RequestBridgeOption);
      this._requestBridgeOption.setAttribute("label", TorNetworkSettingsStrings.requestBridgeFromTorProject);
      this._requestBridgeOption.setAttribute("value", TorBridgeSource.BRIDGEDB);
      this._requestBridgeButton = prefpane.querySelector(selectors.Bridges.RequestBridgeButton);
      this._requestBridgeButton.setAttribute("label", TorNetworkSettingsStrings.requestNewBridge);
      this._requestBridgeTextarea = prefpane.querySelector(selectors.Bridges.RequestBridgeTextarea);

      // Provide a bridge
      this._provideBridgeOption = prefpane.querySelector(selectors.Bridges.ProvideBridgeOption);
      this._provideBridgeOption.setAttribute("label", TorNetworkSettingsStrings.provideBridge);
      this._provideBridgeOption.setAttribute("value", TorBridgeSource.USERPROVIDED);
      prefpane.querySelector(selectors.Bridges.ProvideBridgeDescription).textContent = TorNetworkSettingsStrings.provideBridgeDirections;
      this._provideBridgeTextarea = prefpane.querySelector(selectors.Bridges.ProvideBridgeTextarea)
      this._provideBridgeTextarea.setAttribute("placeholder", TorNetworkSettingsStrings.provideBridgePlaceholder);

      // Advanced setup
      prefpane.querySelector(selectors.Advanced.Header).innerHTML = TorNetworkSettingsStrings.advancedHeading;
      prefpane.querySelector(selectors.Advanced.Description).textContent = TorNetworkSettingsStrings.advancedDescription;
      {
        let learnMore = prefpane.querySelector(selectors.Advanced.LearnMore);
        learnMore.setAttribute("value", TorNetworkSettingsStrings.learnMore);
        // TODO: real url
        learnMore.setAttribute("href", "https://www.example.com");
      }

      // Local Proxy
      this._useProxyCheckbox = prefpane.querySelector(selectors.Advanced.UseProxyCheckbox);
      this._useProxyCheckbox.setAttribute("label", TorNetworkSettingsStrings.useLocalProxy);
      this._proxyTypeLabel = prefpane.querySelector(selectors.Advanced.ProxyTypeLabel);
      this._proxyTypeLabel.setAttribute("value", TorNetworkSettingsStrings.proxyType);

      // TODO: get localized proxy string labels
      let mockProxies = [
        { value : TorProxyType.SOCKS4, label : "SOCKS4" },
        { value : TorProxyType.SOCKS5, label : "SOCKS5" },
        { value : TorProxyType.HTTPS, label : "HTTP/HTTPS" },
      ];
      this._proxyTypeMenulist = prefpane.querySelector(selectors.Advanced.ProxyTypeList);
      for (let currentProxy of mockProxies) {
        let menuEntry = document.createElement("menuitem");
        menuEntry.setAttribute("value", currentProxy.value);
        // TODO: localized label
        menuEntry.setAttribute("label", currentProxy.label);
        this._proxyTypeMenulist.querySelector("menupopup").append(menuEntry);
      }

      this._proxyAddressLabel = prefpane.querySelector(selectors.Advanced.ProxyAddressLabel);
      this._proxyAddressLabel.setAttribute("value", TorNetworkSettingsStrings.proxyAddress);
      this._proxyAddressTextbox = prefpane.querySelector(selectors.Advanced.ProxyAddressTextbox);
      this._proxyAddressTextbox.setAttribute("placeholder", TorNetworkSettingsStrings.proxyAddressPlaceholder);
      this._proxyPortLabel = prefpane.querySelector(selectors.Advanced.ProxyPortLabel);
      this._proxyPortLabel.setAttribute("value", TorNetworkSettingsStrings.proxyPort);
      this._proxyPortTextbox = prefpane.querySelector(selectors.Advanced.ProxyPortTextbox);
      this._proxyUsernameLabel = prefpane.querySelector(selectors.Advanced.ProxyUsernameLabel);
      this._proxyUsernameLabel.setAttribute("value", TorNetworkSettingsStrings.proxyUsername);
      this._proxyUsernameTextbox = prefpane.querySelector(selectors.Advanced.ProxyUsernameTextbox);
      this._proxyUsernameTextbox.setAttribute("placeholder", TorNetworkSettingsStrings.proxyUsernamePasswordPlaceholder);
      this._proxyPasswordLabel = prefpane.querySelector(selectors.Advanced.ProxyPasswordLabel);
      this._proxyPasswordLabel.setAttribute("value", TorNetworkSettingsStrings.proxyPassword);
      this._proxyPasswordTextbox = prefpane.querySelector(selectors.Advanced.ProxyPasswordTextbox);
      this._proxyPasswordTextbox.setAttribute("placeholder", TorNetworkSettingsStrings.proxyUsernamePasswordPlaceholder);

      // Local firewall
      this._useFirewallCheckbox = prefpane.querySelector(selectors.Advanced.UseFirewallCheckbox);
      this._useFirewallCheckbox.setAttribute("label", TorNetworkSettingsStrings.useFirewall);
      this._allowedPortsLabel = prefpane.querySelector(selectors.Advanced.FirewallAllowedPortsLabel);
      this._allowedPortsLabel.setAttribute("value", TorNetworkSettingsStrings.allowedPorts);
      this._allowedPortsTextbox = prefpane.querySelector(selectors.Advanced.FirewallAllowedPortsTextbox);
      this._allowedPortsTextbox.setAttribute("placeholder", TorNetworkSettingsStrings.allowedPortsPlaceholder);

      // Disable all relevant elements by default
      this._setElementsDisabled(
        [
          this._builtinBridgeOption,
          this._builtinBridgeMenulist,
          this._requestBridgeOption,
          this._requestBridgeButton,
          this._requestBridgeTextarea,
          this._provideBridgeOption,
          this._provideBridgeTextarea,
          this._proxyTypeLabel,
          this._proxyTypeMenulist,
          this._proxyAddressLabel,
          this._proxyAddressTextbox,
          this._proxyPortLabel,
          this._proxyPortTextbox,
          this._proxyUsernameLabel,
          this._proxyUsernameTextbox,
          this._proxyPasswordLabel,
          this._proxyPasswordTextbox,
          this._allowedPortsLabel,
          this._allowedPortsTextbox,
        ],
        true);

        // TODO: move this block to a separate function

        // load bridge settings
        let torBridgeSettings = new TorBridgeSettings();
        torBridgeSettings.ReadSettings();


        // populate the bridge list
        for (let currentBridge of TorBridgeSettings.DefaultBridgeTypes()) {
          let menuEntry = document.createElement("menuitem");
          menuEntry.setAttribute("value", currentBridge);
          // TODO: localize bridge name
          menuEntry.setAttribute("label", currentBridge);
          this._builtinBridgeMenulist.querySelector("menupopup").append(menuEntry);
        }

        this.onSelectBridgeOption(torBridgeSettings.BridgeSource);
        this.onToggleBridge(torBridgeSettings.BridgeSource != TorBridgeSource.NONE);
        switch(torBridgeSettings.BridgeSource) {
          case TorBridgeSource.NONE:
            break;
          case TorBridgeSource.BUILTIN:
            this._builtinBridgeMenulist.value = torBridgeSettings.SelectedDefaultBridgeType;
            break;
          case TorBridgeSource.BRIDGEDB:
            this._requestBridgeTextarea.value = torBridgeSettings.BridgeStrings;
            break;
          case TorBridgeSource.USERPROVIDED:
            this._provideBridgeTextarea.value = torBridgeSettings.BridgeStrings;
            break;
        }

        this._bridgeSettings = torBridgeSettings;

        // load proxy settings
        let torProxySettings = new TorProxySettings();
        torProxySettings.ReadSettings();

        if (torProxySettings.Type != TorProxyType.NONE) {
          this.onToggleProxy(true);
          this.onSelectProxyType(torProxySettings.Type);
          this._proxyAddressTextbox.value = torProxySettings.Address;
          this._proxyPortTextbox.value = torProxySettings.Port;
          this._proxyUsernameTextbox.value = torProxySettings.Username;
          this._proxyPasswordTextbox.value = torProxySettings.Password;
        }

        this._proxySettings = torProxySettings;

        // load firewall settings
        let torFirewallSettings = new TorFirewallSettings();
        torFirewallSettings.ReadSettings();

        if (torFirewallSettings.HasPorts) {
          this.onToggleFirewall(true);
          this._allowedPortsTextbox.value = torFirewallSettings.CommaSeparatedListString;
        }

        this._firewallSettigs = torFirewallSettings;
    },

    init : function() {
      this._populateXUL();
    },

    //
    // Callbacks
    //

    // callback when using bridges toggled
    onToggleBridge : function(enabled) {
      this._useBridgeCheckbox.checked = enabled;
      let disabled = !enabled;

      // first disable all the bridge related elements
      this._setElementsDisabled(
        [
          this._builtinBridgeOption, this._builtinBridgeMenulist,
          this._requestBridgeOption, this._requestBridgeButton, this._requestBridgeTextarea,
          this._provideBridgeOption, this._provideBridgeTextarea,
        ],
        disabled);

      // and selectively re-enable based on the radiogroup's current value
      if (enabled) {
        this.onSelectBridgeOption(this._bridgeSelectionRadiogroup.value);
      } else {
        this.onSelectBridgeOption(TorBridgeSource.NONE);
      }
      return this;
    },

    // callback when a bridge option is selected
    onSelectBridgeOption : function(source) {

      // disable all of the bridge elements under radio buttons
      this._setElementsDisabled(
        [
          this._builtinBridgeMenulist,
          this._requestBridgeButton, this._requestBridgeTextarea,
          this._provideBridgeTextarea
        ],
        true);

      if (source != TorBridgeSource.NONE) {
        this._bridgeSelectionRadiogroup.value = source;
      }

      switch(source) {
        case TorBridgeSource.BUILTIN:
        {
          this._setElementsDisabled([this._builtinBridgeMenulist], false);
          break;
        }
        case TorBridgeSource.BRIDGEDB:
        {
          this._setElementsDisabled([this._requestBridgeButton, this._requestBridgeTextarea], false);
          break;
        }
        case TorBridgeSource.USERPROVIDED:
        {
          this._setElementsDisabled([this._provideBridgeTextarea], false);
          break;
        }
      }
      return this;
    },

    // called when the request brige button is activated
    onRequestBridge : function() {
      let self = this;
      TorRequestBridgeDialog.openDialog(self._proxySettings.ProxyURI, aBridges => {
        //
        if (aBridges.length > 0) {
          let bridgeSettings = TorBridgeDBBridgeSettings(aBridges);
          bridgeSettings.WriteSettings();
          self._bridgeSettings = bridgeSettings;

          self._requestBridgeTextarea.value = bridgeSettings.BridgeStrings;
        }
      });
      return this;
    },

    // pushes bridge settings from UI to tor
    onUpdateBridgeSettings : function() {
      let bridgeSettings = null;

      let source = this._useBridgeCheckbox.checked ? this._bridgeSelectionRadiogroup.value : TorBridgeSource.NONE;
      switch(source) {
        case TorBridgeSource.NONE:
        {
          bridgeSettings = TorNoBridgeSettings();
          break;
        }
        case TorBridgeSource.BUILTIN:
        {
          // if there is a built-in bridge already selected, use that
          let bridgeType = this._builtinBridgeMenulist.value;
          if (bridgeType) {
            bridgeSettings = TorBuiltinBridgeSettings(bridgeType);
          } else {
            bridgeSettings = TorNoBridgeSettings();
          }
          break;
        }
        case TorBridgeSource.BRIDGEDB:
        {
          // if there are bridgedb bridges saved in the text area, use them
          let bridgeStrings = this._requestBridgeTextarea.value;
          if (bridgeStrings) {
            let bridgeStringList = parseBridgeStrings(bridgeStrings);
            bridgeSettings = TorBridgeDBBridgeSettings(bridgeStringList);
          } else {
            bridgeSettings = TorNoBridgeSettings();
          }
          break;
        }
        case TorBridgeSource.USERPROVIDED:
        {
          // if bridges already exist in the text area, use them
          let bridgeStrings = this._provideBridgeTextarea.value;
          if (bridgeStrings) {
            let bridgeStringList = parseBridgeStrings(bridgeStrings);
            bridgeSettings = TorUserProvidedBridgeSettings(bridgeStringList);
          } else {
            bridgeSettings = TorNoBridgeSettings();
          }
          break;
        }
      }
      bridgeSettings.WriteSettings();
      this._bridgeSettings = bridgeSettings;
      return this;
    },

    // callback when proxy is toggled
    onToggleProxy : function(enabled) {
      this._useProxyCheckbox.checked = enabled;
      let disabled = !enabled;

      this._setElementsDisabled(this._proxyElements, disabled);
      return this;
    },

    // callback when proxy type is changed
    onSelectProxyType : function(value) {
      this._proxyTypeMenulist.value = value;
      switch(value) {
        case TorProxyType.NONE:
        {
          this._setElementsDisabled(
            [
              this._proxyAddressLabel, this._proxyAddressTextbox, this._proxyPortLabel, this._proxyPortTextbox,
              this._proxyUsernameLabel, this._proxyUsernameTextbox, this._proxyPasswordLabel, this._proxyPasswordTextbox
            ], true); // ENABLE

          this._proxyAddressTextbox.value = "";
          this._proxyPortTextbox.value = "";
          this._proxyUsernameTextbox.value = "";
          this._proxyPasswordTextbox.value = "";
          break;
        }
        case TorProxyType.SOCKS4:
        {
          this._setElementsDisabled(
            [
              this._proxyAddressLabel, this._proxyAddressTextbox, this._proxyPortLabel, this._proxyPortTextbox
            ], false); // ENABLE
          this._setElementsDisabled(
            [
              this._proxyUsernameLabel, this._proxyUsernameTextbox, this._proxyPasswordLabel, this._proxyPasswordTextbox
            ], true); // DISABLE

          this._proxyUsernameTextbox.value = "";
          this._proxyPasswordTextbox.value = "";
          break;
        }
        case TorProxyType.SOCKS5:
        case TorProxyType.HTTPS:
        {
          this._setElementsDisabled(
            [
              this._proxyAddressLabel, this._proxyAddressTextbox, this._proxyPortLabel, this._proxyPortTextbox,
              this._proxyUsernameLabel, this._proxyUsernameTextbox, this._proxyPasswordLabel, this._proxyPasswordTextbox
            ], false); // ENABLE
          break;
        }
      }
      return this;
    },

    // pushes proxy settings from UI to tor
    onUpdateProxySettings : function() {

      const proxyType = this._useProxyCheckbox.checked ? this._proxyTypeMenulist.value : TorProxyType.NONE;
      const addressString = this._proxyAddressTextbox.value;
      const portString = this._proxyPortTextbox.value;
      const usernameString = this._proxyUsernameTextbox.value;
      const passwordString = this._proxyPasswordTextbox.value;

      let proxySettings = null;

      switch (proxyType) {
        case TorProxyType.NONE:
          proxySettings = TorEmptyProxySettings();
          break;
        case TorProxyType.SOCKS4:
          proxySettings = TorSocks4ProxySettings(addressString, parsePort(portString));
          break;
        case TorProxyType.SOCKS5:
          proxySettings = TorSocks5ProxySettings(addressString, parsePort(portString), usernameString, passwordString);
          break;
        case TorProxyType.HTTPS:
          proxySettings = TorHTTPSProxySettings(addressString, parsePort(portString), usernameString, passwordString);
          break;
      }

      proxySettings.WriteSettings();
      this._proxySettings = proxySettings;
      return this;
    },

    // pushes firewall settings from UI to tor
    onUpdateFirewallSettings : function() {
      let portListString = this._useFirewallCheckbox.checked ? this._allowedPortsTextbox.value : "";
      let firewallSettings = null;

      if (portListString) {
        firewallSettings = TorCustomFirewallSettings(parsePortList(portListString));
      } else {
        firewallSettings = TorEmptyFirewallSettings();
      }

      firewallSettings.WriteSettings();
      this._firewallSettigs = firewallSettings;
      return this;
    },

    // callback when firewall proxy is toggled
    onToggleFirewall : function(enabled) {
      this._useFirewallCheckbox.checked = enabled;
      let disabled =!enabled;

      this._setElementsDisabled(
        [
          this._allowedPortsLabel,
          this._allowedPortsTextbox,
        ],
        disabled);

      return this;
    },
  };
  return retval;
}(); /* gTorPane */
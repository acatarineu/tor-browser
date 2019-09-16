"use strinct";

ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
ChromeUtils.import("resource://gre/modules/Services.jsm");

XPCOMUtils.defineLazyScriptGetter(this, ["TorNetworkSettingsStrings"],
                                  "chrome://browser/content/torstrings/torStrings.js");
XPCOMUtils.defineLazyScriptGetter(this, ["TorBridgeDB"],
                                  "chrome://browser/content/tornetworksettings/torBridgeDB.js");

const TorRequestBridgeDialog = function()
{
  const selectors = {
    SubmitButton : "accept",  /* not really a selector but a key for dialog's getButton */
    DialogDescription : "description#torNetworkSettings-requestBridge-description",
    SubmitCommand : "command#torNetworkSettings-requestBridge-submitCommand",
    CaptchaImage : "image#torNetworkSettings-requestBridge-captchaImage",
    CaptchaEntryTextbox : "textbox#torNetworkSettings-requestBridge-captchaTextbox",
    RefreshCaptchaCommand : "command#torNetworkSettings-requestBridge-refreshCaptchaCommand",
    RefreshCaptchaButton : "button#torNetworkSettings-requestBridge-refreshCaptchaButton",
    IncorrectCaptchaHbox : "hbox#torNetworkSettings-requestBridge-incorrectCaptchaHbox",
    IncorrectCaptchaLabel : "label#torNetworkSettings-requestBridge-incorrectCaptchaError",
  }; /* selectors */

  let retval = {
    _dialog : null,
    _submitCommand : null,
    _submitButton : null,
    _dialogDescription : null,
    _captchaHbox : null,
    _captchaImage : null,
    _captchaEntryTextbox : null,
    _captchaRefreshCommand : null,
    _captchaRefreshButton : null,
    _incorrectCaptchaHbox : null,
    _incorrectCaptchaLabel : null,
    _bridges : [],
    _proxyURI : null,

    _populateXUL : function(dialog) {

      this._dialog = dialog;
      this._dialog.setAttribute("title", TorNetworkSettingsStrings.requestBridgeDialogTitle);

      this._submitCommand = this._dialog.querySelector(selectors.SubmitCommand)

      this._submitButton = this._dialog.getButton(selectors.SubmitButton);
      this._submitButton.setAttribute("label", TorNetworkSettingsStrings.submitCaptcha);
      this._submitButton.setAttribute("command", this._submitCommand.id);
      this._submitButton.disabled = true;

      this._dialogDescription = this._dialog.querySelector(selectors.DialogDescription);
      this._dialogDescription.textContent = TorNetworkSettingsStrings.contactingBridgeDB;

      this._captchaImage = this._dialog.querySelector(selectors.CaptchaImage);

      // request captcha from bridge db
      TorBridgeDB.requestNewCaptchaImage(this._proxyURI).then((uri) => {
        TorRequestBridgeDialog._setCaptchaImage(uri);
      });

      this._captchaEntryTextbox = this._dialog.querySelector(selectors.CaptchaEntryTextbox);
      this._captchaEntryTextbox.setAttribute("placeholder", TorNetworkSettingsStrings.captchaTextboxPlaceholder);
      this._captchaEntryTextbox.disabled = true;
      this._captchaEntryTextbox.onkeypress = (evt) => {
        const ENTER_KEY = 13;
        if (evt.keyCode == ENTER_KEY) {
           // logically same as pressing the 'submit' button of the parent dialog
          TorRequestBridgeDialog.onSubmitCaptcha();
          return false;
        }
        return true;
      };
      // disable submit
      this._captchaEntryTextbox.oninput = () => {
        this._submitButton.disabled = (this._captchaEntryTextbox.value == "");
      };

      this._captchaRefreshCommand = this._dialog.querySelector(selectors.RefreshCaptchaCommand);
      this._captchaRefreshButton = this._dialog.querySelector(selectors.RefreshCaptchaButton);
      this._captchaRefreshButton.setAttribute("command", this._captchaRefreshCommand.id);
      this._captchaRefreshButton.disabled = true;

      this._incorrectCaptchaHbox = this._dialog.querySelector(selectors.IncorrectCaptchaHbox);
      this._incorrectCaptchaLabel = this._dialog.querySelector(selectors.IncorrectCaptchaLabel);
      this._incorrectCaptchaLabel.setAttribute("value", TorNetworkSettingsStrings.incorrectCaptcha);

      return true;
    },

    _setCaptchaImage : function(uri) {
      this._captchaImage.src = uri;
      this._dialogDescription.textContent = TorNetworkSettingsStrings.solveTheCaptcha;
      this._setUIDisabled(false);
      this._captchaEntryTextbox.focus();
      this._captchaEntryTextbox.select();
    },

    _setUIDisabled : function(disabled) {
      this._submitButton.disabled = this._captchaGuessIsEmpty() || disabled;
      this._captchaEntryTextbox.disabled = disabled;
      this._captchaRefreshButton.disabled = disabled;
    },

    _captchaGuessIsEmpty : function () {
      return (this._captchaEntryTextbox.value == "");
    },

    get bridges() {
      return this._bridges;
    },

    init : function(dialog) {
      this._bridges = [];

      console.log(`proxy uri : ${this._proxyURI}`);

      // defer to later until firefox has populated the dialog with all our elements
      window.setTimeout(function() {TorRequestBridgeDialog._populateXUL(dialog);}, 0);
    },

    close : function() {
      TorBridgeDB.close();
    },

    /*
      Event Handlers
    */
    onSubmitCaptcha : function() {

      let captchaText = this._captchaEntryTextbox.value.trim();
       // noop if the field is empty
      if (captchaText == "") {
        return;
      }

       // freeze ui while we make request
      this._setUIDisabled(true);
      this._incorrectCaptchaHbox.style.visibility = "hidden";

      TorBridgeDB.submitCaptchaGuess(captchaText)
      .then((aBridges) =>
      {
        for(let currentBridge of aBridges) {
          console.log(currentBridge);
        }

        TorRequestBridgeDialog._bridges = aBridges;

        this._submitButton.disabled = false;
        TorRequestBridgeDialog._dialog.acceptDialog();

      })
      .catch(aError =>
      {
        console.log("Error: ", aError);

        TorBridgeDB._bridges = [];
        TorRequestBridgeDialog._setUIDisabled(false);
        // TODO: set the error message here
        TorRequestBridgeDialog._incorrectCaptchaHbox.style.visibility = "visible";
      });
    },

    onRefreshCaptcha : function() {
      this._setUIDisabled(true);
      this._captchaImage.src = "";
      this._dialogDescription.textContent = TorNetworkSettingsStrings.contactingBridgeDB;
      this._captchaEntryTextbox.value = "";

      TorBridgeDB.requestNewCaptchaImage(this._proxyURI).then((uri) => {
        TorRequestBridgeDialog._setCaptchaImage(uri);
      });
    },

    openDialog : function(aProxyURI, aCloseCallback) {
      let self = this;
      this._proxyURI = aProxyURI;
      gSubDialog.open("chrome://browser/content/tornetworksettings/torNetworkRequestBridgeDialog.xul", "resizable=yes", self, (arg) =>
      {
        self.close()
        aCloseCallback(self._bridges);
      });
    },
  };
  return retval;
}(); /* TorRequestBridgeDialog */

Object.defineProperty(this, "TorRequestBridgeDialog", {
    value: TorRequestBridgeDialog,
    enumerable: true,
    writable: false
});
// Base preferences file used by the mochitest
/* globals user_pref */
/* eslint quotes: 0 */

// XXX: Bug 1617611 - Fix all the tests broken by "cookies sameSite=lax by default"
user_pref("network.cookie.sameSite.laxByDefault", false);

user_pref("network.file.path_blacklist", '');
user_pref("extensions.torbutton.use_nontor_proxy", true);
user_pref("browser.privatebrowsing.autostart", false);
user_pref("security.nocertdb", false);

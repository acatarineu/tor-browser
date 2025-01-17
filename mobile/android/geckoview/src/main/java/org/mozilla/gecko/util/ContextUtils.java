/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

package org.mozilla.gecko.util;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.provider.Settings;
import android.support.annotation.NonNull;
import android.text.TextUtils;

public class ContextUtils {
    private static final String INSTALLER_GOOGLE_PLAY = "com.android.vending";
    private static final String INSTALLER_FDROID = "org.fdroid.fdroid";

    private ContextUtils() {}

    /**
     * @return {@link android.content.pm.PackageInfo#firstInstallTime} for the context's package.
     */
    public static PackageInfo getCurrentPackageInfo(final Context context) {
        try {
            return context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
        } catch (PackageManager.NameNotFoundException e) {
            throw new AssertionError("Should not happen: Can't get package info of own package");
        }
    }

    public static boolean isPackageInstalled(final Context context, final String packageName) {
        try {
            PackageManager pm = context.getPackageManager();
            pm.getPackageInfo(packageName, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    public static boolean isInstalledFromAppStore(final Context context) {
        final String installerPackageName = context.getPackageManager().getInstallerPackageName(context.getPackageName());

        if (TextUtils.isEmpty(installerPackageName)) {
            return false;
        }

        return INSTALLER_GOOGLE_PLAY.equals(installerPackageName) || INSTALLER_FDROID.equals(installerPackageName);
    }

    public static boolean isApplicationDebuggable(final @NonNull Context context) {
        final ApplicationInfo applicationInfo = context.getApplicationInfo();
        return (applicationInfo.flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    public static boolean isApplicationCurrentDebugApp(final @NonNull Context context) {
        final ApplicationInfo applicationInfo = context.getApplicationInfo();

        final String currentDebugApp;
        if (Build.VERSION.SDK_INT >= 17) {
            currentDebugApp = Settings.Global.getString(context.getContentResolver(),
                    Settings.Global.DEBUG_APP);
        } else {
            currentDebugApp = Settings.System.getString(context.getContentResolver(),
                    Settings.System.DEBUG_APP);
        }
        return applicationInfo.packageName.equals(currentDebugApp);
    }
}

package com.diazelectricite.trikker;

import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Environment;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Descarca noul .apk cu managerul de descarcari al Android (notificare normala); la final atingi notificarea si apesi Instaleaza. */
@CapacitorPlugin(name = "UpdatePlugin")
public class UpdatePlugin extends Plugin {
    @PluginMethod
    public void download(final PluginCall call) {
        String url = call.getString("url");
        String name = call.getString("name", "update.apk");
        if (url == null || !url.startsWith("https://github.com/")) { call.reject("Adresa nu e permisa"); return; }
        try {
            DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
            r.setTitle(name);
            r.setDescription("Actualizare aplicatie");
            r.setMimeType("application/vnd.android.package-archive");
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name);
            long id = dm.enqueue(r);
            JSObject o = new JSObject();
            o.put("id", id);
            call.resolve(o);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }
}

package com.diazelectricite.trikker;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.util.Base64;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Descarca noul .apk cu managerul de descarcari si, cand e gata, deschide direct instalarea (fara sa cauti fisierul). */
@CapacitorPlugin(name = "UpdatePlugin")
public class UpdatePlugin extends Plugin {
    private long dlId = -1;
    private BroadcastReceiver rec;

    @PluginMethod
    public void download(final PluginCall call) {
        String url = call.getString("url");
        String name = call.getString("name", "update.apk");
        if (url == null || !url.startsWith("https://github.com/")) { call.reject("Adresa nu e permisa"); return; }
        try {
            final Context ctx = getContext();
            // fiecare descarcare are nume unic, ca sa nu se confunde cu fisiere vechi
            String uniq = name.replace(".apk", "") + "-" + (System.currentTimeMillis() / 1000) + ".apk";
            DownloadManager dm = (DownloadManager) ctx.getSystemService(Context.DOWNLOAD_SERVICE);
            DownloadManager.Request r = new DownloadManager.Request(Uri.parse(url));
            r.setTitle(uniq);
            r.setDescription("Actualizare aplicatie");
            r.setMimeType("application/vnd.android.package-archive");
            r.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            r.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, uniq);
            dlId = dm.enqueue(r);
            if (rec != null) { try { ctx.unregisterReceiver(rec); } catch (Exception e) { } }
            rec = new BroadcastReceiver() {
                @Override public void onReceive(Context c, Intent i) {
                    long id = i.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                    if (id != dlId) return;
                    try { c.unregisterReceiver(this); } catch (Exception e) { }
                    rec = null;
                    installNow(c, id);
                }
            };
            ContextCompat.registerReceiver(ctx, rec, new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE), ContextCompat.RECEIVER_EXPORTED);
            JSObject o = new JSObject();
            o.put("id", dlId);
            call.resolve(o);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    /** Scrie PDF-ul si deschide aplicatia de email cu destinatarul, subiectul, mesajul si PDF-ul atasat. */
    @PluginMethod
    public void sendMail(final PluginCall call) {
        try {
            Context ctx = getContext();
            String name = call.getString("name", "copie.pdf").replaceAll("[^A-Za-z0-9._ -]", "_");
            byte[] data = Base64.decode(call.getString("data", ""), Base64.DEFAULT);
            File dir = new File(ctx.getCacheDir(), "share"); dir.mkdirs();
            File f = new File(dir, name);
            FileOutputStream o = new FileOutputStream(f); o.write(data); o.close();
            Uri u = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".vtshare", f);
            Intent i = new Intent(Intent.ACTION_SEND);
            i.setType("application/pdf");
            String to = call.getString("to", "");
            if (to != null && !to.isEmpty()) i.putExtra(Intent.EXTRA_EMAIL, new String[]{to});
            i.putExtra(Intent.EXTRA_SUBJECT, call.getString("subject", ""));
            i.putExtra(Intent.EXTRA_TEXT, call.getString("text", ""));
            i.putExtra(Intent.EXTRA_STREAM, u);
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent ch = Intent.createChooser(i, "Trimite copia clientului");
            ch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(ch);
            call.resolve();
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    private void installNow(Context c, long id) {
        try {
            DownloadManager dm = (DownloadManager) c.getSystemService(Context.DOWNLOAD_SERVICE);
            Uri u = dm.getUriForDownloadedFile(id);
            if (u == null) return;
            if (Build.VERSION.SDK_INT >= 26 && !c.getPackageManager().canRequestPackageInstalls()) {
                Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + c.getPackageName()));
                s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                c.startActivity(s);               // permite o data "Instaleaza aplicatii necunoscute", apoi reapesi Cauta actualizari
                return;
            }
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(u, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            c.startActivity(i);
        } catch (Exception e) { /* ramane notificarea de descarcare */ }
    }
}

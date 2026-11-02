package com.diazelectricite.trikker;

import android.content.Context;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PrintPlugin")
public class PrintPlugin extends Plugin {
    @PluginMethod
    public void print(final PluginCall call) {
        final String name = call.getString("name", "Trikker");
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    WebView wv = getBridge().getWebView();
                    PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
                    PrintDocumentAdapter adapter = wv.createPrintDocumentAdapter(name);
                    PrintAttributes attrs = new PrintAttributes.Builder()
                            .setMediaSize(PrintAttributes.MediaSize.ISO_A4.asLandscape())
                            .build();
                    pm.print(name, adapter, attrs);
                    call.resolve();
                } catch (Exception e) {
                    call.reject(String.valueOf(e.getMessage()));
                }
            }
        });
    }
}

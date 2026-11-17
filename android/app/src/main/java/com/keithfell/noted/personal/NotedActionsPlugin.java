package com.keithfell.noted.personal;

import android.content.Intent;
import android.net.Uri;
import android.provider.CalendarContract;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** User-reviewed Android drafts; no account tokens or direct calendar/mail access. */
@CapacitorPlugin(name = "NotedActions")
public class NotedActionsPlugin extends Plugin {
    private void launch(PluginCall call, Intent intent, String preferredPackage, String missing) {
        getActivity().runOnUiThread(() -> {
            try {
                Intent preferred = new Intent(intent).setPackage(preferredPackage);
                if (preferred.resolveActivity(getContext().getPackageManager()) != null) {
                    getActivity().startActivity(preferred);
                } else if (intent.resolveActivity(getContext().getPackageManager()) != null) {
                    getActivity().startActivity(intent);
                } else { call.reject(missing); return; }
                call.resolve();
            } catch (Exception e) { call.reject(missing); }
        });
    }
    @PluginMethod public void calendar(PluginCall call) {
        Double start = call.getDouble("start"), end = call.getDouble("end");
        if (start == null || end == null || !Double.isFinite(start) || !Double.isFinite(end) || end <= start) {
            call.reject("Choose a date and time for this to-do first."); return;
        }
        Intent intent = new Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI);
        intent.putExtra(CalendarContract.Events.TITLE, call.getString("title", "Noted follow-up"));
        intent.putExtra(CalendarContract.Events.DESCRIPTION, call.getString("description", ""));
        intent.putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, start.longValue());
        intent.putExtra(CalendarContract.EXTRA_EVENT_END_TIME, end.longValue());
        launch(call, intent, "com.google.android.calendar", "Install a calendar app to add this event.");
    }
    @PluginMethod public void email(PluginCall call) {
        String to = call.getString("to", "").trim();
        if (to.isEmpty() || to.contains("\n") || to.contains("\r")) { call.reject("Add a customer email address first."); return; }
        Uri uri = Uri.parse("mailto:" + Uri.encode(to) + "?subject=" + Uri.encode(call.getString("subject", "")) + "&body=" + Uri.encode(call.getString("body", "")));
        launch(call, new Intent(Intent.ACTION_SENDTO, uri), "com.google.android.gm", "Install Gmail or another email app to write this message.");
    }
}
